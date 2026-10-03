"""Autentikasi & sesi: FR-AKN-05 (login), FR-AKN-06 (logout), NFR-SEC-04 (kedaluwarsa), OQ-04/16/17.

Batas transaksi ada di sini: setiap fungsi yang menulis melakukan commit sendiri.
"""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta
from functools import lru_cache

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.core.keamanan import hash_password, verifikasi_password
from app.core.waktu import sekarang_wib
from app.models import Admin, Anggota, Sesi
from app.models.status import Role

NAMA_COOKIE = "sesi_perpus"
# NFR-SEC-04 + ASUMSI(OQ-17): menganggur >= 8 jam berarti sesi berakhir (tepat 8 jam sudah ditolak).
BATAS_MENGANGGUR = timedelta(hours=8)


@dataclass(frozen=True)
class Pengguna:
    """Identitas pemilik sesi. Endpoint area anggota mengambil `id` dari sini, bukan dari klien."""

    role: Role
    id: int
    nama: str
    email: str


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@lru_cache
def _hash_tiruan() -> str:
    """Hash argon2 pembanding saat email tak terdaftar, agar waktu respons tidak membocorkannya."""
    return hash_password(secrets.token_urlsafe(16))


def _galat_login() -> GalatBisnis:
    # ASUMSI(OQ-16): satu pesan untuk email tak terdaftar maupun password salah.
    return GalatBisnis(
        kode="AKN_LOGIN_GAGAL",
        pesan="Email atau password salah.",
        rujukan="FR-AKN-05",
        status_code=401,
    )


def _galat_belum_login() -> GalatBisnis:
    return GalatBisnis(
        kode="AKN_BELUM_LOGIN",
        pesan="Silakan login terlebih dahulu.",
        rujukan="NFR-SEC-03",
        status_code=401,
    )


def _cari_akun(db: Session, email: str) -> tuple[Role, Admin | Anggota] | None:
    """ASUMSI(OQ-09): email dibandingkan tanpa peka huruf besar-kecil dan spasi tepi.
    ASUMSI(OQ-02): email unik lintas admin dan anggota, jadi paling banyak satu yang cocok."""
    kunci = email.strip().lower()
    admin = db.scalar(select(Admin).where(func.lower(func.trim(Admin.email)) == kunci))
    if admin is not None:
        return Role.ADMIN, admin
    anggota = db.scalar(select(Anggota).where(func.lower(func.trim(Anggota.email)) == kunci))
    if anggota is not None:
        return Role.ANGGOTA, anggota
    return None


def login(
    db: Session, *, email: str, password: str, token_lama: str | None = None
) -> tuple[str, Pengguna]:
    """FR-AKN-05: verifikasi email + password (argon2, NFR-SEC-01) lalu buat sesi baru (OQ-04).

    Token selalu baru (tanpa session fixation); sesi `token_lama` di perangkat ini dihapus.
    Sesi kedaluwarsa milik siapa pun ikut dibersihkan di sini (tanpa cron).
    """
    ditemukan = _cari_akun(db, email)
    if ditemukan is None:
        verifikasi_password(password, _hash_tiruan())
        raise _galat_login()
    role, akun = ditemukan
    if not verifikasi_password(password, akun.password_hash):
        raise _galat_login()

    sekarang = sekarang_wib()
    db.execute(delete(Sesi).where(Sesi.terakhir_aktif <= sekarang - BATAS_MENGANGGUR))
    if token_lama:
        db.execute(delete(Sesi).where(Sesi.token_hash == _hash_token(token_lama)))
    token = secrets.token_urlsafe(32)
    db.add(
        Sesi(
            token_hash=_hash_token(token),
            role=role,
            admin_id=akun.id if role is Role.ADMIN else None,
            anggota_id=akun.id if role is Role.ANGGOTA else None,
            dibuat_pada=sekarang,
            terakhir_aktif=sekarang,
        )
    )
    db.commit()
    return token, Pengguna(role=role, id=akun.id, nama=akun.nama, email=akun.email)


def cabut_sesi_anggota(db: Session, anggota_id: int, *, kecuali_token: str | None) -> None:
    """ASUMSI(OQ-32): cabut sesi anggota setelah password berubah. `kecuali_token` = sesi perangkat
    yang sedang dipakai (anggota ganti sendiri); None = semua sesi (admin menetapkan password).

    Tidak commit: dijalankan dalam transaksi yang sama dengan perubahan password."""
    q = delete(Sesi).where(Sesi.anggota_id == anggota_id)
    if kecuali_token:
        q = q.where(Sesi.token_hash != _hash_token(kecuali_token))
    db.execute(q)


def logout(db: Session, token: str | None) -> None:
    """FR-AKN-06: hapus sesi di server. Idempoten: tanpa sesi pun tidak galat."""
    if token:
        db.execute(delete(Sesi).where(Sesi.token_hash == _hash_token(token)))
        db.commit()


def pengguna_dari_token(db: Session, token: str | None) -> Pengguna:
    """NFR-SEC-03/04: validasi sesi dan geser kedaluwarsanya (menulis `terakhir_aktif`)."""
    if not token:
        raise _galat_belum_login()
    sesi = db.scalar(select(Sesi).where(Sesi.token_hash == _hash_token(token)))
    if sesi is None:
        raise _galat_belum_login()

    sekarang = sekarang_wib()
    if sekarang - sesi.terakhir_aktif >= BATAS_MENGANGGUR:  # ASUMSI(OQ-17)
        db.delete(sesi)
        db.commit()
        raise GalatBisnis(
            kode="AKN_SESI_KEDALUWARSA",
            pesan="Sesi berakhir karena tidak ada aktivitas selama 8 jam. Silakan login kembali.",
            rujukan="NFR-SEC-04",
            status_code=401,
        )

    sesi.terakhir_aktif = sekarang
    role = Role(sesi.role)
    akun = db.get(Admin, sesi.admin_id) if role is Role.ADMIN else db.get(Anggota, sesi.anggota_id)
    db.commit()
    return Pengguna(role=role, id=akun.id, nama=akun.nama, email=akun.email)

"""Profil anggota & pengelolaan anggota oleh admin: FR-AKN-07..11, K-03, K-05, K-06, OQ-32, OQ-33.

NIK dan foto tidak pernah diubah di sini (K-05; isian asing ditolak schema `extra="forbid"`).
Foto hanya dibaca untuk pemiliknya dan admin (OQ-42), lewat `berkas.berkas_tersimpan()` yang sama
dengan cover publik: path hanya dari DB, wajib di dalam `STORAGE_DIR`, Content-Type dari ekstensi.
Email diperiksa dengan helper yang sama dengan pendaftaran: lintas admin–anggota, tak peka huruf,
pesan tidak membedakan admin/anggota (OQ-02, OQ-09). Password tidak di-trim dan tidak pernah
keluar dari fungsi ini selain sebagai hash argon2id (NFR-SEC-01).
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.core.keamanan import hash_password, verifikasi_password
from app.core.validasi import (
    PANJANG_MIN_PASSWORD,
    email_valid,
    normalisasi_kode,
    password_cukup_panjang,
)
from app.models import Anggota
from app.services import autentikasi, berkas, pendaftaran

_LABEL = pendaftaran.LABEL_ISIAN | {
    "password_lama": "Password lama",
    "password_baru": "Password baru",
}
_CONSTRAINT_EMAIL = "uq_anggota_email_lower"
_PESAN_PASSWORD_LAMA = {"kosong": "Password lama wajib diisi.", "salah": "Password lama salah."}
# OQ-42 (keputusan Ayen 2026-10-07): foto = data pribadi; tidak disimpan cache bersama/perangkat.
CACHE_CONTROL_FOTO = "private, no-store"


@dataclass(frozen=True)
class ProfilAnggota:
    kode: str
    nama: str
    alamat: str
    email: str
    telepon: str
    nik: str
    tanggal_daftar: date
    ada_foto: bool  # OQ-42: berkas foto benar-benar dapat disajikan


# --------------------------------------------------------------------------------------- galat


def _galat_isian(isian: dict[str, str], rujukan: list[str]) -> GalatBisnis:
    urut = list(dict.fromkeys(rujukan))
    return GalatBisnis(
        kode="AKN_ISIAN_TIDAK_VALID",
        pesan=f"Periksa isian: {', '.join(_LABEL[k] for k in isian)}.",
        rujukan=", ".join(urut),
        status_code=422,
        isian=isian,
    )


def _galat_email_duplikat() -> GalatBisnis:
    """FR-AKN-08/K-06: pesan sama untuk email milik admin maupun anggota (sejalan OQ-16)."""
    return GalatBisnis(
        kode="AKN_DATA_DUPLIKAT",
        pesan="Perubahan ditolak: email sudah terdaftar.",
        rujukan="FR-AKN-08",
        status_code=409,
        isian={"email": "Email sudah terdaftar."},
    )


def _galat_tidak_ada(kode: str, rujukan: str) -> GalatBisnis:
    return GalatBisnis(
        kode="AKN_ANGGOTA_TIDAK_ADA",
        pesan=f"Anggota dengan ID {kode} tidak ditemukan.",
        rujukan=rujukan,
        status_code=404,
    )


# --------------------------------------------------------------------------------------- bantu


def _profil(a: Anggota) -> ProfilAnggota:
    return ProfilAnggota(
        kode=a.kode,
        nama=a.nama,
        alamat=a.alamat,
        email=a.email,
        telepon=a.telepon,
        nik=a.nik,
        tanggal_daftar=a.tanggal_daftar,
        ada_foto=berkas.berkas_tersimpan(a.foto_path) is not None,
    )


def _foto(a: Anggota) -> berkas.BerkasTersimpan:
    """ASUMSI(OQ-42): tanpa foto, berkas hilang, atau path di luar `STORAGE_DIR` → 404."""
    tersimpan = berkas.berkas_tersimpan(a.foto_path)
    if tersimpan is None:
        raise GalatBisnis(
            kode="AKN_FOTO_TIDAK_ADA",
            pesan="Foto anggota tidak tersedia.",
            rujukan="OQ-42",
            status_code=404,
        )
    return tersimpan


def _per_kode(db: Session, kode: str, rujukan: str) -> Anggota:
    kode = normalisasi_kode(kode)
    a = db.scalar(select(Anggota).where(Anggota.kode == kode))
    if a is None:
        raise _galat_tidak_ada(kode, rujukan)
    return a


def _periksa_data_diri(
    isian: dict[str, str],
    rujukan: list[str],
    *,
    rujukan_wajib: str,
    nama: str,
    alamat: str,
    email: str,
    telepon: str,
) -> None:
    """FR-AKN-07/11: aturan isian sama dengan pendaftaran (wajib, email valid; OQ-31 telepon)."""
    for k, v in {"nama": nama, "alamat": alamat, "email": email, "telepon": telepon}.items():
        if not v:
            isian[k] = f"{_LABEL[k]} wajib diisi."
            rujukan.append(rujukan_wajib)
    if email and not email_valid(email):
        isian["email"] = "Format email tidak valid."
        rujukan.append("FR-AKN-08")


def _periksa_password_baru(isian: dict[str, str], rujukan: list[str], password_baru: str) -> None:
    if not password_cukup_panjang(password_baru):  # NFR-SEC-02; tanpa aturan kompleksitas lain
        isian["password_baru"] = f"Password baru minimal {PANJANG_MIN_PASSWORD} karakter."
        rujukan.append("NFR-SEC-02")


def _simpan_data_diri(
    db: Session,
    a: Anggota,
    *,
    rujukan_wajib: str,
    nama: str,
    alamat: str,
    email: str,
    telepon: str,
    password_baru: str | None = None,
) -> ProfilAnggota:
    """Validasi → cek email unik (kecuali diri sendiri) → simpan + (opsional) password & cabut
    semua sesi, dalam satu transaksi DB (OQ-32)."""
    nama, alamat, email, telepon = nama.strip(), alamat.strip(), email.strip(), telepon.strip()
    isian: dict[str, str] = {}
    rujukan: list[str] = []
    _periksa_data_diri(
        isian,
        rujukan,
        rujukan_wajib=rujukan_wajib,
        nama=nama,
        alamat=alamat,
        email=email,
        telepon=telepon,
    )
    if password_baru is not None:
        _periksa_password_baru(isian, rujukan, password_baru)
    if isian:
        raise _galat_isian(isian, rujukan)
    # FR-AKN-08, K-06. ASUMSI(OQ-02, OQ-09): helper yang sama dengan pendaftaran.
    if pendaftaran.email_terpakai(db, email, kecuali_anggota_id=a.id):
        raise _galat_email_duplikat()

    a.nama, a.alamat, a.email, a.telepon = nama, alamat, email, telepon
    if password_baru is not None:
        a.password_hash = hash_password(password_baru)  # K-03
        autentikasi.cabut_sesi_anggota(db, a.id, kecuali_token=None)  # ASUMSI(OQ-32): semua
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        diag = getattr(exc.orig, "diag", None)
        if getattr(diag, "constraint_name", None) != _CONSTRAINT_EMAIL:
            raise
        raise _galat_email_duplikat() from exc
    except BaseException:
        db.rollback()
        raise
    return _profil(a)


# --------------------------------------------------------------------------------------- anggota


def profil(db: Session, anggota_id: int) -> ProfilAnggota:
    """FR-AKN-07: profil sendiri (`anggota_id` selalu dari sesi, NFR-SEC-03)."""
    return _profil(db.get(Anggota, anggota_id))


def ubah_profil(
    db: Session, anggota_id: int, *, nama: str, alamat: str, email: str, telepon: str
) -> ProfilAnggota:
    """FR-AKN-07/08: nama, alamat, email, telepon. Tidak mencabut sesi (OQ-32)."""
    return _simpan_data_diri(
        db,
        db.get(Anggota, anggota_id),
        rujukan_wajib="FR-AKN-07",
        nama=nama,
        alamat=alamat,
        email=email,
        telepon=telepon,
    )


def ganti_password(
    db: Session,
    anggota_id: int,
    *,
    password_lama: str,
    password_baru: str,
    token_sesi_kini: str | None,
) -> None:
    """FR-AKN-09: wajib password lama yang benar. ASUMSI(OQ-32): sesi lain akun ini dicabut,
    sesi perangkat ini tetap; dalam satu transaksi DB dengan perubahan password."""
    a = db.get(Anggota, anggota_id)
    isian: dict[str, str] = {}
    rujukan: list[str] = []
    if not password_lama:
        isian["password_lama"] = _PESAN_PASSWORD_LAMA["kosong"]
        rujukan.append("FR-AKN-09")
    elif not verifikasi_password(password_lama, a.password_hash):
        isian["password_lama"] = _PESAN_PASSWORD_LAMA["salah"]
        rujukan.append("FR-AKN-09")
    _periksa_password_baru(isian, rujukan, password_baru)
    if isian:
        raise _galat_isian(isian, rujukan)

    a.password_hash = hash_password(password_baru)
    autentikasi.cabut_sesi_anggota(db, a.id, kecuali_token=token_sesi_kini)
    try:
        db.commit()
    except BaseException:
        db.rollback()
        raise


# --------------------------------------------------------------------------------------- admin


def _escape_like(teks: str) -> str:
    return teks.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def cari(
    db: Session, *, q: str | None, halaman: int, per_halaman: int
) -> tuple[list[ProfilAnggota], int]:
    """FR-AKN-10. ASUMSI(OQ-33): kode persis (normalisasi) OR NIK persis OR nama sebagian tak peka
    huruf; `q` kosong → semua. Urut nama A–Z lalu kode (§B daftar berhalaman)."""
    q = (q or "").strip()
    query = select(Anggota)
    if q:
        query = query.where(
            or_(
                Anggota.kode == normalisasi_kode(q),
                Anggota.nik == q,
                Anggota.nama.ilike(f"%{_escape_like(q)}%", escape="\\"),
            )
        )
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    baris = db.scalars(
        query.order_by(func.lower(Anggota.nama), Anggota.kode)
        .offset((halaman - 1) * per_halaman)
        .limit(per_halaman)
    ).all()
    return [_profil(a) for a in baris], total


def detail(db: Session, kode: str) -> ProfilAnggota:
    return _profil(_per_kode(db, kode, "FR-AKN-10"))


def foto_sendiri(db: Session, anggota_id: int) -> berkas.BerkasTersimpan:
    """ASUMSI(OQ-42): foto milik anggota yang login (`anggota_id` selalu dari sesi, NFR-SEC-03)."""
    return _foto(db.get(Anggota, anggota_id))


def foto_anggota(db: Session, kode: str) -> berkas.BerkasTersimpan:
    """ASUMSI(OQ-42): foto anggota untuk admin; kode dinormalisasi seperti `detail`."""
    return _foto(_per_kode(db, kode, "FR-AKN-10"))


def ubah_oleh_admin(
    db: Session,
    kode: str,
    *,
    nama: str,
    alamat: str,
    email: str,
    telepon: str,
    password_baru: str | None,
) -> ProfilAnggota:
    """FR-AKN-11, K-03: ubah data selain NIK/foto; `password_baru` (opsional, tanpa password lama)
    mencabut semua sesi anggota itu (OQ-32). Sesi admin tidak tersentuh."""
    return _simpan_data_diri(
        db,
        _per_kode(db, kode, "FR-AKN-11"),
        rujukan_wajib="FR-AKN-11",
        nama=nama,
        alamat=alamat,
        email=email,
        telepon=telepon,
        password_baru=password_baru,
    )

"""Pendaftaran anggota: FR-AKN-01..04, BR-03, BR-04, NFR-SEC-01/02/06, OQ-02/03/09/30/31.

Urutan: kumpulkan semua galat isian (422, termasuk foto) → cek duplikat (409) → simpan berkas foto
→ insert + commit. Berkas foto tidak pernah tersimpan bila ada galat isian/duplikat, dan dihapus
bila langkah setelahnya gagal. Akun langsung aktif (BR-03); tidak ada login otomatis (OQ-30).
Password tidak di-trim, tidak dicatat, dan tidak pernah keluar dari fungsi ini selain sebagai hash.
"""

import re
from dataclasses import dataclass
from typing import BinaryIO

from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.core.keamanan import hash_password
from app.core.validasi import PANJANG_MIN_PASSWORD, email_valid, password_cukup_panjang
from app.core.waktu import hari_ini_wib
from app.models import Admin, Anggota
from app.services import berkas

_NIK = re.compile(r"[0-9]{16}")  # FR-AKN-03: hanya digit ASCII, sama dengan CHECK di DB
_SEQUENCE_HABIS = "2200H"  # SQLSTATE sequence_generator_limit_exceeded
LABEL_ISIAN = {
    "nama": "Nama",
    "alamat": "Alamat",
    "email": "Email",
    "telepon": "Telepon",
    "nik": "NIK",
    "password": "Password",
    "foto": "Foto",
}
_PESAN_DUPLIKAT = {"nik": "NIK sudah terdaftar.", "email": "Email sudah terdaftar."}
_CONSTRAINT_DUPLIKAT = {"uq_anggota_nik": "nik", "uq_anggota_email_lower": "email"}


@dataclass(frozen=True)
class HasilDaftar:
    kode: str
    nama: str
    email: str
    isi_qr: str


def galat_isian(isian: dict[str, str], rujukan: list[str]) -> GalatBisnis:
    """422 `AKN_ISIAN_TIDAK_VALID` dengan galat per isian (dipakai pendaftaran & ubah profil)."""
    urut = list(dict.fromkeys(rujukan))  # tanpa duplikat, urutan pertama muncul
    return GalatBisnis(
        kode="AKN_ISIAN_TIDAK_VALID",
        pesan=f"Periksa isian: {', '.join(LABEL_ISIAN[k] for k in isian)}.",
        rujukan=", ".join(urut),
        status_code=422,
        isian=isian,
    )


def _galat_duplikat(isian: list[str]) -> GalatBisnis:
    """FR-AKN-02: sebut isian yang duplikat. Email milik admin dan anggota tidak dibedakan
    (tidak membocorkan akun admin; sejalan dengan OQ-16)."""
    sebutan = " dan ".join("NIK" if k == "nik" else "email" for k in isian)
    return GalatBisnis(
        kode="AKN_DATA_DUPLIKAT",
        pesan=f"Pendaftaran ditolak: {sebutan} sudah terdaftar.",
        rujukan="FR-AKN-02",
        status_code=409,
        isian={k: _PESAN_DUPLIKAT[k] for k in isian},
    )


def _periksa_isian(
    *,
    nama: str,
    alamat: str,
    email: str,
    telepon: str,
    nik: str,
    password: str,
    foto: BinaryIO | None,
) -> berkas.GambarSah | None:
    """FR-AKN-01/03, NFR-SEC-02/06: semua galat isian dikumpulkan sekaligus (IR-UI-04)."""
    isian: dict[str, str] = {}
    rujukan: list[str] = []
    wajib = {  # teks sudah di-trim pemanggil; password apa adanya
        "nama": nama,
        "alamat": alamat,
        "email": email,
        "telepon": telepon,
        "nik": nik,
        "password": password,
    }
    for k, v in wajib.items():
        if not v:
            isian[k] = f"{LABEL_ISIAN[k]} wajib diisi."
            rujukan.append("FR-AKN-01")
    if nik and not _NIK.fullmatch(nik):
        isian["nik"] = "NIK harus tepat 16 digit angka."
        rujukan.append("FR-AKN-03")
    if email and not email_valid(email):
        isian["email"] = "Format email tidak valid."
        rujukan.append("FR-AKN-03")
    if password and not password_cukup_panjang(password):
        isian["password"] = f"Password minimal {PANJANG_MIN_PASSWORD} karakter."
        rujukan.append("NFR-SEC-02")
    gambar = None
    if foto is not None:
        try:
            gambar = berkas.periksa_gambar(foto, label="Foto", prefiks="AKN_FOTO")
        except GalatBisnis as g:
            isian["foto"] = g.pesan
            rujukan.append("NFR-SEC-06")
    if isian:
        raise galat_isian(isian, rujukan)
    return gambar


def email_terpakai(db: Session, email: str, *, kecuali_anggota_id: int | None = None) -> bool:
    """FR-AKN-02/08, K-06. ASUMSI(OQ-02, OQ-09): email unik lintas admin & anggota, tak peka
    huruf. Keunikan terhadap tabel admin hanya dijaga di sini (tak ada constraint DB antartabel).
    `kecuali_anggota_id`: anggota yang sedang mengubah emailnya sendiri."""
    email_sama = email.strip().lower()
    q_anggota = select(Anggota.id).where(func.lower(func.trim(Anggota.email)) == email_sama)
    if kecuali_anggota_id is not None:
        q_anggota = q_anggota.where(Anggota.id != kecuali_anggota_id)
    return (
        db.scalar(q_anggota) is not None
        or db.scalar(select(Admin.id).where(func.lower(func.trim(Admin.email)) == email_sama))
        is not None
    )


def _cari_duplikat(db: Session, *, nik: str, email: str) -> list[str]:
    """FR-AKN-02. ASUMSI(OQ-02, OQ-09): email unik lintas admin & anggota, tak peka huruf."""
    duplikat = []
    if db.scalar(select(Anggota.id).where(Anggota.nik == nik)) is not None:
        duplikat.append("nik")
    if email_terpakai(db, email):
        duplikat.append("email")
    return duplikat


def daftar(
    db: Session,
    *,
    nama: str,
    alamat: str,
    email: str,
    telepon: str,
    nik: str,
    password: str,
    foto: BinaryIO | None,
) -> HasilDaftar:
    """FR-AKN-01..04: buat akun anggota aktif dengan satu ID (kode) dan isi QR = ID."""
    nama, alamat, email = nama.strip(), alamat.strip(), email.strip()
    telepon = telepon.strip()  # ASUMSI(OQ-31): wajib, tanpa validasi format
    nik = nik.strip()
    gambar = _periksa_isian(
        nama=nama,
        alamat=alamat,
        email=email,
        telepon=telepon,
        nik=nik,
        password=password,
        foto=foto,
    )
    duplikat = _cari_duplikat(db, nik=nik, email=email)
    if duplikat:
        raise _galat_duplikat(duplikat)

    path_foto = berkas.simpan(gambar, "foto") if gambar is not None else None
    try:
        a = Anggota(
            nama=nama,
            alamat=alamat,
            email=email,
            telepon=telepon,
            nik=nik,
            foto_path=path_foto,
            password_hash=hash_password(password),  # NFR-SEC-01
            tanggal_daftar=hari_ini_wib(),  # K-07
        )
        db.add(a)
        db.flush()
        kode = db.scalar(select(Anggota.kode).where(Anggota.id == a.id))
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        berkas.hapus(path_foto)
        diag = getattr(exc.orig, "diag", None)
        isian = _CONSTRAINT_DUPLIKAT.get(getattr(diag, "constraint_name", None) or "")
        if isian is None:
            raise
        raise _galat_duplikat([isian]) from exc
    except DBAPIError as exc:
        db.rollback()
        berkas.hapus(path_foto)
        if getattr(exc.orig, "sqlstate", None) != _SEQUENCE_HABIS:
            raise
        raise GalatBisnis(  # ASUMSI(OQ-03): AGT-000001 … AGT-999999
            kode="AKN_KODE_ANGGOTA_HABIS",
            pesan="Kode anggota sudah habis (maksimal AGT-999999); pendaftaran tidak dapat "
            "diproses. Hubungi pengelola perpustakaan.",
            rujukan="FR-AKN-04",
            status_code=409,
        ) from exc
    except BaseException:
        db.rollback()
        berkas.hapus(path_foto)
        raise
    return HasilDaftar(kode=kode, nama=nama, email=email, isi_qr=kode)  # FR-AKN-04, BR-04

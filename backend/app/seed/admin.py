"""Seed akun admin awal (FR-AKN-12, K-04, DR-01).

Admin hanya dibuat lewat seed ini; tidak ada menu kelola admin. Password tidak pernah dicetak.
"""

from enum import Enum

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.keamanan import hash_password
from app.core.validasi import PANJANG_MIN_PASSWORD, email_valid, password_cukup_panjang
from app.models import Admin, Anggota


class GalatSeed(Exception):
    """Galat seed. Pesan Bahasa Indonesia dan tidak pernah memuat password."""


class HasilSeedAdmin(Enum):
    DIBUAT = "dibuat"
    SUDAH_ADA = "sudah_ada"


def _email_sama(kolom, email: str):
    # ASUMSI(OQ-09): perbandingan email tanpa peka huruf besar-kecil dan spasi tepi
    return func.lower(func.trim(kolom)) == email.lower()


def seed_admin(
    db: Session, *, nama: str | None, email: str | None, password: str | None
) -> HasilSeedAdmin:
    """Buat satu admin awal bila belum ada. Tidak commit; pemanggil yang memegang transaksi.

    ASUMSI(OQ-14): bila admin dengan email itu sudah ada, tidak ada yang diubah (termasuk password).
    """
    nama = (nama or "").strip()
    email = (email or "").strip()
    password = password or ""

    kosong = [
        env
        for env, nilai in (
            ("ADMIN_AWAL_NAMA", nama),
            ("ADMIN_AWAL_EMAIL", email),
            ("ADMIN_AWAL_PASSWORD", password),
        )
        if not nilai
    ]
    if kosong:
        raise GalatSeed(f"Variabel lingkungan wajib belum diisi: {', '.join(kosong)}.")
    if not email_valid(email):  # FR-AKN-03
        raise GalatSeed(f"Format email admin tidak valid: {email}.")

    if db.scalar(select(Admin.id).where(_email_sama(Admin.email, email))) is not None:
        return HasilSeedAdmin.SUDAH_ADA
    # ASUMSI(OQ-02): email unik lintas admin dan anggota
    if db.scalar(select(Anggota.id).where(_email_sama(Anggota.email, email))) is not None:
        raise GalatSeed(f"Email {email} sudah dipakai oleh akun anggota.")

    if not password_cukup_panjang(password):  # NFR-SEC-02
        raise GalatSeed(f"Password admin minimal {PANJANG_MIN_PASSWORD} karakter.")

    db.add(Admin(nama=nama, email=email, password_hash=hash_password(password)))  # NFR-SEC-01
    db.flush()
    return HasilSeedAdmin.DIBUAT

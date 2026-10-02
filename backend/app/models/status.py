"""Kosakata status tersimpan (domain-rules §2). Disimpan sebagai kode; label UI dipetakan di klien.

`Terlambat` sengaja tidak ada: ia kondisi turunan (FR-DND-05), bukan status tersimpan.
"""

from enum import StrEnum

from sqlalchemy import CheckConstraint


class StatusEksemplar(StrEnum):
    TERSEDIA = "TERSEDIA"
    DIPINJAM = "DIPINJAM"
    HILANG = "HILANG"
    RUSAK = "RUSAK"


# Label UI persis seperti IR-UI-03; dipakai juga di pesan galat (IR-UI-04).
LABEL_STATUS_EKSEMPLAR = {
    StatusEksemplar.TERSEDIA: "Tersedia",
    StatusEksemplar.DIPINJAM: "Dipinjam",
    StatusEksemplar.HILANG: "Hilang",
    StatusEksemplar.RUSAK: "Rusak",
}


class StatusItem(StrEnum):
    DIPINJAM = "DIPINJAM"
    DIKEMBALIKAN = "DIKEMBALIKAN"
    HILANG = "HILANG"
    RUSAK = "RUSAK"


class StatusTransaksi(StrEnum):
    AKTIF = "AKTIF"
    SELESAI = "SELESAI"


class StatusTagihan(StrEnum):
    BELUM_LUNAS = "BELUM_LUNAS"
    LUNAS = "LUNAS"


class JenisTagihan(StrEnum):
    DENDA = "DENDA"
    PENGGANTIAN = "PENGGANTIAN"


class CaraPenyelesaian(StrEnum):
    TUNAI = "TUNAI"
    TRANSFER = "TRANSFER"
    BUKU_PENGGANTI = "BUKU_PENGGANTI"


class Role(StrEnum):
    """Dua role terautentikasi (BR-02). Pengunjung umum bukan role."""

    ADMIN = "ADMIN"
    ANGGOTA = "ANGGOTA"


def ck_nilai(kolom: str, nilai: type[StrEnum], nama: str | None = None) -> CheckConstraint:
    """CHECK `kolom IN (...)` dari sebuah StrEnum. Kolom NULL lolos (atur NOT NULL terpisah)."""
    daftar = ", ".join(f"'{v.value}'" for v in nilai)
    return CheckConstraint(f"{kolom} IN ({daftar})", name=nama or kolom)

"""Pembuat data uji minimal untuk test skema. Nilai default sah; override lewat kwargs."""

from datetime import date, timedelta
from itertools import count

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Admin,
    Anggota,
    Eksemplar,
    ItemTransaksi,
    JudulBuku,
    Kategori,
    Rak,
    Tagihan,
    TransaksiPeminjaman,
)

_no = count(1)
TGL = date(2026, 10, 1)


def _n() -> int:
    return next(_no)


def simpan(db: Session, obj):
    db.add(obj)
    db.flush()
    return obj


def harus_gagal(db: Session, obj, constraint: str | set[str] | None = None) -> IntegrityError:
    """Flush `obj` dalam savepoint dan pastikan ditolak DB (opsional: oleh constraint tertentu)."""
    with pytest.raises(IntegrityError) as info, db.begin_nested():
        db.add(obj)
        db.flush()
    if constraint is not None:
        harapan = {constraint} if isinstance(constraint, str) else constraint
        assert info.value.orig.diag.constraint_name in harapan, info.value.orig
    return info.value


def admin(db: Session, **kw) -> Admin:
    n = _n()
    data = {"nama": f"Admin {n}", "email": f"admin{n}@perpus.test", "password_hash": "x"}
    return simpan(db, Admin(**(data | kw)))


def anggota(db: Session, **kw) -> Anggota:
    n = _n()
    data = {
        "nama": f"Anggota {n}",
        "alamat": "Jl. Uji 1",
        "email": f"anggota{n}@perpus.test",
        "telepon": "081234567890",
        "nik": f"{n:016d}",
        "password_hash": "x",
        "tanggal_daftar": TGL,
    }
    return simpan(db, Anggota(**(data | kw)))


def kategori(db: Session, **kw) -> Kategori:
    return simpan(db, Kategori(**({"nama": f"Kategori {_n()}"} | kw)))


def rak(db: Session, **kw) -> Rak:
    return simpan(db, Rak(**({"kode": f"R-{_n()}"} | kw)))


def judul(db: Session, **kw) -> JudulBuku:
    n = _n()
    data = {
        "isbn": f"978{n:010d}",
        "judul": f"Judul {n}",
        "penulis": "Penulis",
        "penerbit": "Penerbit",
        "tahun": 2020,
        "harga": 100_000,
    }
    if "kategori_id" not in kw:
        data["kategori_id"] = kategori(db).id
    return simpan(db, JudulBuku(**(data | kw)))


def eksemplar(db: Session, **kw) -> Eksemplar:
    data = {}
    if "judul_buku_id" not in kw:
        data["judul_buku_id"] = judul(db).id
    if "rak_id" not in kw:
        data["rak_id"] = rak(db).id
    return simpan(db, Eksemplar(**(data | kw)))


def transaksi(db: Session, **kw) -> TransaksiPeminjaman:
    data = {"tanggal_transaksi": TGL, "status": "AKTIF"}
    if "anggota_id" not in kw:
        data["anggota_id"] = anggota(db).id
    if "admin_id" not in kw:
        data["admin_id"] = admin(db).id
    return simpan(db, TransaksiPeminjaman(**(data | kw)))


def item_baru(db: Session, **kw) -> ItemTransaksi:
    """Objek item (belum disimpan) berstatus DIPINJAM yang sah."""
    data = {"tanggal_pinjam": TGL, "jatuh_tempo": TGL + timedelta(days=30), "status": "DIPINJAM"}
    if "transaksi_id" not in kw:
        data["transaksi_id"] = transaksi(db).id
    if "eksemplar_id" not in kw:
        data["eksemplar_id"] = eksemplar(db).id
    return ItemTransaksi(**(data | kw))


def item(db: Session, **kw) -> ItemTransaksi:
    return simpan(db, item_baru(db, **kw))


def tagihan_baru(db: Session, **kw) -> Tagihan:
    data = {"jenis": "DENDA", "nominal": 10_000, "status": "BELUM_LUNAS", "tanggal_dibentuk": TGL}
    if "item_transaksi_id" not in kw:
        data["item_transaksi_id"] = item(db).id
    return Tagihan(**(data | kw))

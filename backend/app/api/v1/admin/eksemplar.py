"""Router admin: eksemplar (FR-BKU-04..09, K-02). Didaftarkan ke `router_admin` (NFR-SEC-03).

Sengaja TIDAK ada: endpoint ubah status generik, pemulihan Rusak → Tersedia (domain §3/§13),
dan hapus eksemplar (ASUMSI(OQ-20)).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.eksemplar import (
    EksemplarKeluar,
    LabelEksemplar,
    RekapStokKeluar,
    StokJudul,
    TambahEksemplar,
    UbahRak,
)
from app.services import eksemplar as layanan

router = APIRouter(tags=["eksemplar"])
DB = Annotated[Session, Depends(get_db)]


@router.post("/judul/{judul_id}/eksemplar", response_model=list[EksemplarKeluar], status_code=201)
def tambah_eksemplar(judul_id: int, data: TambahEksemplar, db: DB):
    """FR-BKU-04: tambah satu atau beberapa eksemplar sekaligus (atomik)."""
    return layanan.tambah(db, judul_id=judul_id, jumlah=data.jumlah, rak_id=data.rak_id)


@router.get("/judul/{judul_id}/eksemplar", response_model=StokJudul)
def stok_judul(judul_id: int, db: DB):
    """FR-BKU-09: rekap stok per judul + daftar eksemplarnya."""
    rekap, data = layanan.stok_judul(db, judul_id)
    return StokJudul(
        judul_id=judul_id,
        rekap=RekapStokKeluar.model_validate(rekap),
        data=[EksemplarKeluar.model_validate(e) for e in data],
    )


# Didaftarkan sebelum /eksemplar/{eksemplar_id}/... agar "label" tidak dibaca sebagai id.
@router.get("/eksemplar/label", response_model=list[LabelEksemplar])
def data_label(db: DB, id: Annotated[list[int], Query()] = []):  # noqa: A002, B006
    """FR-BKU-06: data label (kode, judul singkat, isi QR). Cetak A4 di frontend (WP 5.4.7)."""
    return layanan.data_label(db, id)


@router.put("/eksemplar/{eksemplar_id}/rak", response_model=EksemplarKeluar)
def ubah_rak(eksemplar_id: int, data: UbahRak, db: DB):
    """FR-BKU-05: ubah rak; status tidak berubah (ASUMSI(OQ-21))."""
    return layanan.ubah_rak(db, eksemplar_id, rak_id=data.rak_id)


@router.post("/eksemplar/{eksemplar_id}/rusak", response_model=EksemplarKeluar)
def tandai_rusak(eksemplar_id: int, db: DB):
    """FR-BKU-07 / K-02: Tersedia → Rusak tanpa tagihan. FR-BKU-08: Dipinjam ditolak."""
    return layanan.tandai_rusak(db, eksemplar_id)

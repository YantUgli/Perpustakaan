"""Router admin: pengembalian (FR-KMB-01..08). Didaftarkan ke `router_admin` (NFR-SEC-03).

Satu permintaan = satu eksemplar; pengembalian sebagian terjadi dengan sendirinya (FR-KMB-07).
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.pengembalian import KonfirmasiMasuk, PengembalianKeluar, PratinjauKeluar
from app.services import pengembalian as layanan

router = APIRouter(prefix="/pengembalian", tags=["pengembalian"])
DB = Annotated[Session, Depends(get_db)]


@router.get("/{kode_eksemplar}", response_model=PratinjauKeluar)
def pratinjau(kode_eksemplar: str, db: DB):
    """FR-KMB-01..04: item aktif, peminjam, hari terlambat, dan denda sebelum konfirmasi."""
    return PratinjauKeluar.dari(layanan.pratinjau(db, kode_eksemplar))


@router.post("", response_model=PengembalianKeluar, status_code=201)
def konfirmasi(data: KonfirmasiMasuk, db: DB):
    """FR-KMB-05..08: tanggal kembali = hari ini WIB (OQ-25), tagihan denda bila > 0."""
    return PengembalianKeluar.dari(layanan.konfirmasi(db, kode_eksemplar=data.kode_eksemplar))

"""Router admin: hilang/rusak (FR-HLR-01..05). Didaftarkan ke `router_admin` (NFR-SEC-03).

Sengaja TIDAK ada: menu lapor hilang anggota (K-01) dan jalur otomatis ke Hilang (FR-HLR-05).
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import butuh_admin
from app.db import get_db
from app.models.status import StatusItem
from app.schemas.hilang_rusak import CatatMasuk, DaftarItemKeluar, PencatatanKeluar
from app.services import hilang_rusak as layanan
from app.services.autentikasi import Pengguna

router = APIRouter(prefix="/hilang-rusak", tags=["hilang-rusak"])
DB = Annotated[Session, Depends(get_db)]
Admin = Annotated[Pengguna, Depends(butuh_admin)]


@router.get("/anggota/{kode}", response_model=DaftarItemKeluar)
def daftar_item_anggota(kode: str, db: DB):
    """FR-HLR-01: item Dipinjam milik anggota (kode dari QR atau diketik). Tidak mengubah data."""
    return DaftarItemKeluar.dari(layanan.daftar_item_anggota(db, kode))


@router.post("", response_model=PencatatanKeluar, status_code=201)
def catat(data: CatatMasuk, db: DB, admin: Admin):
    """FR-HLR-01..04: catat Hilang/Rusak + tagihan Penggantian; admin pencatat dari sesi."""
    return PencatatanKeluar.dari(
        layanan.catat(
            db,
            item_id=data.item_id,
            jenis=StatusItem(data.jenis),
            tanggal_kejadian=data.tanggal_kejadian,
            keterangan=data.keterangan,
            admin_id=admin.id,
        )
    )

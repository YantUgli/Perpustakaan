"""Router admin: data anggota (FR-AKN-10/11, K-03). Didaftarkan ke `router_admin` (NFR-SEC-03).

Sengaja TIDAK ada: tambah anggota oleh admin, nonaktifkan/hapus anggota (domain-rules §13),
ubah NIK/foto (K-05).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.anggota import HalamanAnggota, ProfilKeluar, UbahAnggotaAdminMasuk
from app.services import anggota as layanan

router = APIRouter(prefix="/anggota", tags=["anggota"])
DB = Annotated[Session, Depends(get_db)]


@router.get("", response_model=HalamanAnggota)
def cari(
    db: DB,
    q: Annotated[str | None, Query(description="ID (kode), NIK, atau nama (OQ-33)")] = None,
    halaman: Annotated[int, Query(ge=1)] = 1,
    per_halaman: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """FR-AKN-10: daftar & pencarian anggota."""
    data, total = layanan.cari(db, q=q, halaman=halaman, per_halaman=per_halaman)
    return HalamanAnggota(
        data=[ProfilKeluar.dari(p) for p in data],
        total=total,
        halaman=halaman,
        per_halaman=per_halaman,
    )


@router.get("/{kode}", response_model=ProfilKeluar)
def detail(kode: str, db: DB):
    return ProfilKeluar.dari(layanan.detail(db, kode))


@router.put("/{kode}", response_model=ProfilKeluar)
def ubah(kode: str, data: UbahAnggotaAdminMasuk, db: DB):
    """FR-AKN-11, K-03: ubah data selain NIK/foto; `password_baru` mencabut semua sesi (OQ-32)."""
    return ProfilKeluar.dari(layanan.ubah_oleh_admin(db, kode, **data.model_dump()))

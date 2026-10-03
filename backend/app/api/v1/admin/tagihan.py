"""Router admin: tagihan (FR-TGH-01..06). Didaftarkan ke `router_admin` (NFR-SEC-03).

Sengaja TIDAK ada endpoint ubah atau hapus tagihan (FR-TGH-06), pembayaran sebagian, payment
gateway, maupun verifikasi bukti transfer (domain-rules §13).
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import butuh_admin
from app.db import get_db
from app.models.status import CaraPenyelesaian
from app.schemas.tagihan import HalamanTagihan, PenyelesaianMasuk, TagihanKeluar
from app.services import tagihan as layanan
from app.services.autentikasi import Pengguna

router = APIRouter(prefix="/tagihan", tags=["tagihan"])
DB = Annotated[Session, Depends(get_db)]
Admin = Annotated[Pengguna, Depends(butuh_admin)]


@router.get("", response_model=HalamanTagihan)
def daftar(
    db: DB,
    status: Literal["BELUM_LUNAS", "LUNAS"] | None = None,
    jenis: Literal["DENDA", "PENGGANTIAN"] | None = None,
    anggota: Annotated[str | None, Query(description="Kode anggota (OQ-29)")] = None,
    halaman: Annotated[int, Query(ge=1)] = 1,
    per_halaman: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """FR-TGH-01: daftar tagihan dengan filter status, jenis, dan anggota."""
    data, total = layanan.daftar(
        db,
        status=status,
        jenis=jenis,
        anggota_kode=anggota,
        halaman=halaman,
        per_halaman=per_halaman,
    )
    return HalamanTagihan(
        data=[TagihanKeluar.dari(t) for t in data],
        total=total,
        halaman=halaman,
        per_halaman=per_halaman,
    )


@router.get("/{tagihan_id}", response_model=TagihanKeluar)
def detail(tagihan_id: int, db: DB):
    return TagihanKeluar.dari(layanan.detail(db, tagihan_id))


@router.post("/{tagihan_id}/penyelesaian", response_model=TagihanKeluar)
def selesaikan(tagihan_id: int, data: PenyelesaianMasuk, db: DB, admin: Admin):
    """FR-TGH-02..05: Tunai/Transfer (nominal sama persis) atau Buku Pengganti."""
    return TagihanKeluar.dari(
        layanan.selesaikan(
            db,
            tagihan_id,
            cara=CaraPenyelesaian(data.cara),
            nominal=data.nominal,
            tanggal=data.tanggal,
            admin_id=admin.id,
        )
    )

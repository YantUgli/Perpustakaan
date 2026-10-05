"""Router publik katalog (BR-01, FR-KTL-01..04, OQ-43): tanpa login.

Setiap route di sini wajib tercantum di `ROUTE_PUBLIK` (tests/test_autentikasi.py).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.katalog import HalamanKatalog, JudulKatalogKeluar
from app.schemas.koleksi import KategoriKeluar
from app.services import katalog, koleksi

router = APIRouter(prefix="/katalog", tags=["katalog"])
DB = Annotated[Session, Depends(get_db)]


@router.get("/judul", response_model=HalamanKatalog)
def cari_judul(
    db: DB,
    q: Annotated[str | None, Query(description="Judul, penulis, ISBN, atau kategori")] = None,
    halaman: Annotated[int, Query(ge=1)] = 1,
    per_halaman: Annotated[int, Query(ge=1, le=100)] = 20,
):
    data, total = katalog.cari_judul(db, q=q, halaman=halaman, per_halaman=per_halaman)
    return HalamanKatalog(
        data=[JudulKatalogKeluar.dari(j) for j in data],
        total=total,
        halaman=halaman,
        per_halaman=per_halaman,
    )


@router.get("/judul/{judul_id}", response_model=JudulKatalogKeluar)
def detail_judul(judul_id: int, db: DB):
    return JudulKatalogKeluar.dari(katalog.detail_judul(db, judul_id))


@router.get(
    "/judul/{judul_id}/cover",
    response_class=FileResponse,
    responses={200: {"content": {"image/jpeg": {}, "image/png": {}}}},
)
def cover_judul(judul_id: int, db: DB) -> FileResponse:
    berkas = katalog.cover_judul(db, judul_id)
    return FileResponse(berkas.path, media_type=berkas.media_type)


@router.get("/kategori", response_model=list[KategoriKeluar])
def daftar_kategori(db: DB):
    """ASUMSI(OQ-43): semua kategori (id, nama), urut A–Z tak peka huruf.

    Tanpa halaman, hitungan buku, maupun filter; termasuk kategori yang belum punya judul.
    Urutan sama dengan daftar admin (`koleksi.daftar_kategori`).
    """
    return koleksi.daftar_kategori(db)

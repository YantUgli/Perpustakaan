"""Router publik katalog (BR-01, FR-KTL-01..04, OQ-43, OQ-44): tanpa login.

Setiap route di sini wajib tercantum di `ROUTE_PUBLIK` (tests/test_autentikasi.py).
"""

from typing import Annotated, Literal

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
    kategori_id: Annotated[
        list[int] | None,
        Query(max_length=100, description="Boleh berulang; judul berkategori salah satunya"),
    ] = None,
    tersedia: Annotated[
        Literal["true"] | None, Query(description="Hanya judul dengan ≥ 1 eksemplar Tersedia")
    ] = None,
    tahun_dari: Annotated[int | None, Query(ge=1, description="Tahun terbit, inklusif")] = None,
    tahun_sampai: Annotated[int | None, Query(ge=1, description="Tahun terbit, inklusif")] = None,
    urut: Annotated[katalog.Urutan, Query()] = "judul_az",
):
    """FR-KTL-02/04. ASUMSI(OQ-44): filter & urutan opsional, digabung AND dengan `q`."""
    data, total = katalog.cari_judul(
        db,
        q=q,
        halaman=halaman,
        per_halaman=per_halaman,
        kategori_id=kategori_id,
        tersedia=tersedia == "true",
        tahun_dari=tahun_dari,
        tahun_sampai=tahun_sampai,
        urut=urut,
    )
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

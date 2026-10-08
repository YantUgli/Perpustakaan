"""Router admin: kategori, rak, judul buku, cover (FR-BKU-01..03, NFR-SEC-06).

Didaftarkan ke `router_admin`, jadi semua route di sini butuh login admin (NFR-SEC-03).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.koleksi import (
    HalamanJudul,
    JudulKeluar,
    JudulMasuk,
    KategoriKeluar,
    KategoriMasuk,
    RakKeluar,
    RakMasuk,
)
from app.services import koleksi

router = APIRouter(tags=["koleksi"])
DB = Annotated[Session, Depends(get_db)]


# ------------------------------------------------------------------------------------ kategori


@router.get("/kategori", response_model=list[KategoriKeluar])
def daftar_kategori(db: DB):
    return koleksi.daftar_kategori(db)


@router.post("/kategori", response_model=KategoriKeluar, status_code=201)
def tambah_kategori(data: KategoriMasuk, db: DB):
    return koleksi.simpan_kategori(db, nama=data.nama)


@router.put("/kategori/{kategori_id}", response_model=KategoriKeluar)
def ubah_kategori(kategori_id: int, data: KategoriMasuk, db: DB):
    return koleksi.simpan_kategori(db, nama=data.nama, kategori_id=kategori_id)


@router.delete("/kategori/{kategori_id}", status_code=204)
def hapus_kategori(kategori_id: int, db: DB) -> Response:
    koleksi.hapus_kategori(db, kategori_id)
    return Response(status_code=204)


# ------------------------------------------------------------------------------------ rak


@router.get("/rak", response_model=list[RakKeluar])
def daftar_rak(db: DB):
    return koleksi.daftar_rak(db)


@router.post("/rak", response_model=RakKeluar, status_code=201)
def tambah_rak(data: RakMasuk, db: DB):
    return koleksi.simpan_rak(db, kode=data.kode, lokasi=data.lokasi)


@router.put("/rak/{rak_id}", response_model=RakKeluar)
def ubah_rak(rak_id: int, data: RakMasuk, db: DB):
    return koleksi.simpan_rak(db, kode=data.kode, lokasi=data.lokasi, rak_id=rak_id)


@router.delete("/rak/{rak_id}", status_code=204)
def hapus_rak(rak_id: int, db: DB) -> Response:
    koleksi.hapus_rak(db, rak_id)
    return Response(status_code=204)


# ------------------------------------------------------------------------------------ judul


@router.get("/judul", response_model=HalamanJudul)
def daftar_judul(
    db: DB,
    q: Annotated[
        str | None, Query(description="Judul, penulis, ISBN, atau kategori (OQ-24/OQ-45)")
    ] = None,
    halaman: Annotated[int, Query(ge=1)] = 1,
    per_halaman: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """FR-BKU-02; ASUMSI(OQ-45): pencarian `q` dengan aturan katalog (OQ-24)."""
    data, total = koleksi.daftar_judul(db, halaman=halaman, per_halaman=per_halaman, q=q)
    return HalamanJudul(
        data=[JudulKeluar.model_validate(j) for j in data],
        total=total,
        halaman=halaman,
        per_halaman=per_halaman,
    )


@router.get("/judul/{judul_id}", response_model=JudulKeluar)
def detail_judul(judul_id: int, db: DB):
    return koleksi.detail_judul(db, judul_id)


@router.post("/judul", response_model=JudulKeluar, status_code=201)
def tambah_judul(data: JudulMasuk, db: DB):
    return koleksi.simpan_judul(db, koleksi.DataJudul(**data.model_dump()))


@router.put("/judul/{judul_id}", response_model=JudulKeluar)
def ubah_judul(judul_id: int, data: JudulMasuk, db: DB):
    return koleksi.simpan_judul(db, koleksi.DataJudul(**data.model_dump()), judul_id=judul_id)


@router.delete("/judul/{judul_id}", status_code=204)
def hapus_judul(judul_id: int, db: DB) -> Response:
    koleksi.hapus_judul(db, judul_id)
    return Response(status_code=204)


@router.put("/judul/{judul_id}/cover", response_model=JudulKeluar)
def ganti_cover(judul_id: int, berkas: UploadFile, db: DB):
    """NFR-SEC-06: JPG/PNG ≤ 2 MB, diperiksa dari isi. Nama berkas dari klien diabaikan."""
    return koleksi.ganti_cover(db, judul_id, berkas.file)

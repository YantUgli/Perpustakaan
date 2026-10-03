from pydantic import BaseModel

from app.schemas.koleksi import KategoriKeluar, url_cover
from app.services.katalog import JudulKatalog


class RakKatalogKeluar(BaseModel):
    kode: str
    lokasi: str | None  # ASUMSI(OQ-08): kode, + lokasi bila ada


class JudulKatalogKeluar(BaseModel):
    """FR-KTL-01/03. Sengaja tanpa data per eksemplar (kode, status) dan tanpa data peminjam."""

    id: int
    isbn: str
    judul: str
    penulis: str
    penerbit: str
    tahun: int
    kategori: KategoriKeluar
    harga: int
    cover_url: str | None  # None → frontend memakai gambar pengganti (OQ-10)
    rak: list[RakKatalogKeluar]  # ASUMSI(OQ-22)
    tersedia: int  # X
    total: int  # Y: tanpa Hilang/Rusak (FR-KTL-03)

    @classmethod
    def dari(cls, item: JudulKatalog) -> "JudulKatalogKeluar":
        j = item.judul
        return cls(
            id=j.id,
            isbn=j.isbn,
            judul=j.judul,
            penulis=j.penulis,
            penerbit=j.penerbit,
            tahun=j.tahun,
            kategori=KategoriKeluar.model_validate(j.kategori),
            harga=j.harga,
            cover_url=url_cover(j.id, j.cover_path),
            rak=[RakKatalogKeluar(kode=r.kode, lokasi=r.lokasi) for r in item.rak],
            tersedia=item.tersedia,
            total=item.total,
        )


class HalamanKatalog(BaseModel):
    data: list[JudulKatalogKeluar]
    total: int
    halaman: int
    per_halaman: int

from pydantic import BaseModel, ConfigDict, StrictInt


class _DariORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class KategoriMasuk(BaseModel):
    nama: str


class KategoriKeluar(_DariORM):
    id: int
    nama: str


class RakMasuk(BaseModel):
    kode: str
    lokasi: str | None = None


class RakKeluar(_DariORM):
    id: int
    kode: str
    lokasi: str | None


class JudulMasuk(BaseModel):
    isbn: str
    judul: str
    penulis: str
    penerbit: str
    tahun: StrictInt
    kategori_id: StrictInt
    harga: StrictInt  # Rupiah bulat; pecahan/teks/boolean ditolak (DR-05)


class JudulKeluar(_DariORM):
    id: int
    isbn: str
    judul: str
    penulis: str
    penerbit: str
    tahun: int
    kategori: KategoriKeluar
    harga: int
    cover_path: str | None  # relatif terhadap STORAGE_DIR; URL publik disediakan WP 5.3.2


class HalamanJudul(BaseModel):
    data: list[JudulKeluar]
    total: int
    halaman: int
    per_halaman: int

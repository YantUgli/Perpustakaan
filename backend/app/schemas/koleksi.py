from pydantic import BaseModel, ConfigDict, StrictInt, computed_field

PREFIKS_KATALOG = "/api/v1/katalog/judul"


def url_cover(judul_id: int, cover_path: str | None) -> str | None:
    """URL publik cover (WP 5.3.2). Per judul, bukan per nama berkas: path di disk tak pernah keluar
    sebagai alamat yang bisa diubah klien."""
    return f"{PREFIKS_KATALOG}/{judul_id}/cover" if cover_path else None


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
    cover_path: str | None  # relatif terhadap STORAGE_DIR

    @computed_field
    @property
    def cover_url(self) -> str | None:
        return url_cover(self.id, self.cover_path)


class HalamanJudul(BaseModel):
    data: list[JudulKeluar]
    total: int
    halaman: int
    per_halaman: int

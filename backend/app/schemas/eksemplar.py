from pydantic import BaseModel, ConfigDict, StrictInt

from app.schemas.koleksi import RakKeluar


class TambahEksemplar(BaseModel):
    jumlah: StrictInt  # 1–100, diperiksa service dengan pesan Indonesia
    rak_id: StrictInt  # ASUMSI(OQ-10): wajib


class UbahRak(BaseModel):
    rak_id: StrictInt


class EksemplarKeluar(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kode: str
    status: str  # kode status (TERSEDIA, …); label UI dipetakan di klien (IR-UI-03)
    rak: RakKeluar


class RekapStokKeluar(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total: int
    tersedia: int
    dipinjam: int
    hilang: int
    rusak: int


class StokJudul(BaseModel):
    judul_id: int
    rekap: RekapStokKeluar
    data: list[EksemplarKeluar]


class LabelEksemplar(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    kode: str
    judul_singkat: str
    isi_qr: str

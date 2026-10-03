from datetime import date

from pydantic import BaseModel, StrictInt

from app.models.status import StatusItem


class AlasanKeluar(BaseModel):
    kode: str
    pesan: str
    rujukan: str


class IdentitasAnggotaKeluar(BaseModel):
    """FR-PJM-02. Sengaja tanpa NIK, alamat, telepon, email, dan foto."""

    id: int
    kode: str
    nama: str
    pinjaman_aktif: int
    layak: bool
    alasan: list[AlasanKeluar]


class ValidasiItemMasuk(BaseModel):
    anggota_id: StrictInt
    kode_eksemplar: str
    keranjang: list[str] = []  # kode eksemplar yang sudah ada di keranjang klien


class ItemValidKeluar(BaseModel):
    eksemplar_id: int
    kode: str
    judul: str


class KonfirmasiMasuk(BaseModel):
    anggota_id: StrictInt
    kode_eksemplar: list[str]


class ItemDipinjamKeluar(BaseModel):
    kode_eksemplar: str
    judul: str
    tanggal_pinjam: date
    jatuh_tempo: date
    status: StatusItem


class AnggotaRingkas(BaseModel):
    kode: str
    nama: str


class TransaksiKeluar(BaseModel):
    id: int
    anggota: AnggotaRingkas
    tanggal_transaksi: date
    item: list[ItemDipinjamKeluar]

from datetime import date
from typing import Literal

from pydantic import BaseModel, StrictInt

from app.models.status import StatusItem
from app.services.hilang_rusak import DaftarItem, HasilPencatatan


class AnggotaRingkas(BaseModel):
    """Sengaja tanpa NIK dan kontak."""

    kode: str
    nama: str


class ItemAktifKeluar(BaseModel):
    item_id: int
    kode_eksemplar: str  # agar admin bisa mencocokkan buku yang dipegang (decisions.md §B)
    judul: str
    tanggal_pinjam: date
    jatuh_tempo: date
    hari_terlambat: int  # informasi saja; tidak ada aturan yang bergantung padanya
    # FR-HLR-04: informasi; nominal final dibentuk saat dicatat. Sengaja tanpa `harga_judul`.
    nominal_penggantian: int


class DaftarItemKeluar(BaseModel):
    anggota: AnggotaRingkas
    item: list[ItemAktifKeluar]

    @classmethod
    def dari(cls, d: DaftarItem) -> "DaftarItemKeluar":
        return cls(
            anggota=AnggotaRingkas(kode=d.anggota.kode, nama=d.anggota.nama),
            item=[ItemAktifKeluar(**vars(i)) for i in d.item],
        )


class CatatMasuk(BaseModel):
    item_id: StrictInt
    jenis: Literal["HILANG", "RUSAK"]
    tanggal_kejadian: date  # ASUMSI(OQ-26): wajib, tanggal pinjam s.d. hari ini
    keterangan: str  # ASUMSI(OQ-10): wajib, tidak kosong


class TagihanRingkas(BaseModel):
    id: int
    nominal: int


class PencatatanKeluar(BaseModel):
    """FR-HLR-03/04. Sengaja tanpa field denda (BR-15)."""

    item_id: int
    kode_eksemplar: str
    judul: str
    anggota: AnggotaRingkas
    status: StatusItem
    tanggal_kejadian: date
    keterangan: str
    tagihan: TagihanRingkas
    transaksi_selesai: bool

    @classmethod
    def dari(cls, h: HasilPencatatan) -> "PencatatanKeluar":
        return cls(
            item_id=h.item_id,
            kode_eksemplar=h.kode_eksemplar,
            judul=h.judul,
            anggota=AnggotaRingkas(kode=h.anggota.kode, nama=h.anggota.nama),
            status=h.status,
            tanggal_kejadian=h.tanggal_kejadian,
            keterangan=h.keterangan,
            tagihan=TagihanRingkas(id=h.tagihan.id, nominal=h.tagihan.nominal),
            transaksi_selesai=h.transaksi_selesai,
        )

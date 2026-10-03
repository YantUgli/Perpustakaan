from datetime import date
from typing import Literal

from pydantic import BaseModel, StrictInt

from app.models.status import CaraPenyelesaian, JenisTagihan, StatusTagihan
from app.services.tagihan import TagihanRinci


class Ringkas(BaseModel):
    kode: str
    nama: str


class EksemplarRingkas(BaseModel):
    kode: str
    judul: str


class TagihanKeluar(BaseModel):
    """FR-TGH-01/05. Kode status/jenis/cara dikirim apa adanya; label dipetakan klien (IR-UI-03).
    Anggota tanpa NIK/kontak; admin pengonfirmasi berupa nama."""

    id: int
    jenis: JenisTagihan
    nominal: int
    status: StatusTagihan
    tanggal_dibentuk: date
    anggota: Ringkas
    eksemplar: EksemplarRingkas
    cara_penyelesaian: CaraPenyelesaian | None
    nominal_dibayar: int | None
    tanggal_penyelesaian: date | None
    admin_pengonfirmasi: str | None

    @classmethod
    def dari(cls, t: TagihanRinci) -> "TagihanKeluar":
        return cls(
            id=t.id,
            jenis=t.jenis,
            nominal=t.nominal,
            status=t.status,
            tanggal_dibentuk=t.tanggal_dibentuk,
            anggota=Ringkas(kode=t.anggota.kode, nama=t.anggota.nama),
            eksemplar=EksemplarRingkas(kode=t.eksemplar.kode, judul=t.eksemplar.nama),
            cara_penyelesaian=t.cara_penyelesaian,
            nominal_dibayar=t.nominal_dibayar,
            tanggal_penyelesaian=t.tanggal_penyelesaian,
            admin_pengonfirmasi=t.admin_pengonfirmasi,
        )


class HalamanTagihan(BaseModel):
    data: list[TagihanKeluar]
    total: int
    halaman: int
    per_halaman: int


class PenyelesaianMasuk(BaseModel):
    cara: Literal["TUNAI", "TRANSFER", "BUKU_PENGGANTI"]
    nominal: StrictInt | None = None  # wajib & = tagihan untuk Tunai/Transfer (FR-TGH-02)
    tanggal: date  # ASUMSI(OQ-28): pembayaran / penerimaan buku pengganti

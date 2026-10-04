"""Respons dashboard & laporan (FR-LAP-01..03). Kode status/jenis/cara dikirim apa adanya; label
dipetakan klien (IR-UI-03). `Terlambat` hanya field turunan `terlambat`, bukan nilai `status`."""

from datetime import date

from pydantic import BaseModel

from app.models.status import (
    CaraPenyelesaian,
    JenisTagihan,
    StatusEksemplar,
    StatusItem,
    StatusTagihan,
)
from app.services.laporan import BarisTagihan, BarisTransaksi, Dashboard


class DashboardKeluar(BaseModel):
    """FR-LAP-01. ASUMSI(OQ-40): `item_dipinjam` termasuk yang terlambat;
    `item_terlambat` bagiannya."""

    jumlah_judul: int
    eksemplar_per_status: dict[StatusEksemplar, int]
    jumlah_anggota: int
    item_dipinjam: int
    item_terlambat: int
    tagihan_belum_lunas_jumlah: int
    tagihan_belum_lunas_total: int

    @classmethod
    def dari(cls, d: Dashboard) -> "DashboardKeluar":
        return cls(**vars(d))


class BarisTransaksiKeluar(BaseModel):
    """FR-LAP-02, ASUMSI(OQ-07): satu baris per item."""

    anggota_kode: str
    anggota_nama: str
    judul: str
    kode_eksemplar: str
    tanggal_pinjam: date
    jatuh_tempo: date
    tanggal_kembali: date | None
    status: StatusItem
    terlambat: bool

    @classmethod
    def dari(cls, b: BarisTransaksi) -> "BarisTransaksiKeluar":
        data = vars(b).copy()
        data.pop("item_id")
        return cls(**data)


class LaporanTransaksiKeluar(BaseModel):
    data: list[BarisTransaksiKeluar]
    total: int
    halaman: int
    per_halaman: int


class BarisTagihanKeluar(BaseModel):
    """FR-LAP-03, ASUMSI(OQ-39)."""

    id: int
    tanggal_dibentuk: date
    anggota_kode: str
    anggota_nama: str
    judul: str
    kode_eksemplar: str
    jenis: JenisTagihan
    nominal: int
    status: StatusTagihan
    cara_penyelesaian: CaraPenyelesaian | None
    tanggal_penyelesaian: date | None
    admin_pengonfirmasi: str | None

    @classmethod
    def dari(cls, b: BarisTagihan) -> "BarisTagihanKeluar":
        return cls(**vars(b))


class LaporanTagihanKeluar(BaseModel):
    """`total` = jumlah baris; `total_nominal` dari seluruh baris yang lolos filter
    (bukan halaman)."""

    data: list[BarisTagihanKeluar]
    total: int
    total_nominal: int
    halaman: int
    per_halaman: int

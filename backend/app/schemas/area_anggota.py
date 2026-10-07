"""Respons area anggota (FR-AGT-01..05). Kode status/jenis/cara dikirim apa adanya; label
dipetakan klien (IR-UI-03). `Terlambat` hanya muncul sebagai field turunan `terlambat`, bukan
nilai `status`."""

from datetime import date

from pydantic import BaseModel

from app.models.status import CaraPenyelesaian, JenisTagihan, StatusItem, StatusTagihan
from app.services.area_anggota import ItemRiwayat, PinjamanAktif, QrAnggota, TagihanAnggota
from app.services.peminjaman import Kelayakan


class QrKeluar(BaseModel):
    """FR-AGT-01. Sengaja hanya tiga isian ini (tanpa NIK, foto, kontak)."""

    kode: str
    nama: str
    isi_qr: str

    @classmethod
    def dari(cls, q: QrAnggota) -> "QrKeluar":
        return cls(**vars(q))


class PinjamanAktifKeluar(BaseModel):
    """FR-AGT-02. ASUMSI(OQ-34): `sisa_hari` ≥ 0; `hari_terlambat` terpisah."""

    kode_eksemplar: str
    judul: str
    tanggal_pinjam: date
    jatuh_tempo: date
    sisa_hari: int
    terlambat: bool
    hari_terlambat: int

    @classmethod
    def dari(cls, p: PinjamanAktif) -> "PinjamanAktifKeluar":
        return cls(**vars(p))


class ItemRiwayatKeluar(BaseModel):
    """FR-AGT-03. ASUMSI(OQ-35): tanpa `keterangan` dan admin pencatat."""

    kode_eksemplar: str
    judul: str
    tanggal_pinjam: date
    jatuh_tempo: date
    tanggal_kembali: date | None
    status: StatusItem
    terlambat: bool
    tanggal_kejadian: date | None

    @classmethod
    def dari(cls, i: ItemRiwayat) -> "ItemRiwayatKeluar":
        return cls(**vars(i))


class HalamanRiwayat(BaseModel):
    data: list[ItemRiwayatKeluar]
    total: int
    halaman: int
    per_halaman: int


class TagihanAnggotaKeluar(BaseModel):
    """FR-AGT-04. ASUMSI(OQ-36): tanpa nama admin pengonfirmasi dan `nominal_dibayar`."""

    id: int
    jenis: JenisTagihan
    nominal: int
    status: StatusTagihan
    cara_penyelesaian: CaraPenyelesaian | None
    tanggal_dibentuk: date
    tanggal_penyelesaian: date | None
    kode_eksemplar: str
    judul: str

    @classmethod
    def dari(cls, t: TagihanAnggota) -> "TagihanAnggotaKeluar":
        return cls(**vars(t))


class HalamanTagihanAnggota(BaseModel):
    data: list[TagihanAnggotaKeluar]
    total: int
    halaman: int
    per_halaman: int


class AlasanKeluar(BaseModel):
    kode: str
    pesan: str
    rujukan: str


class KelayakanKeluar(BaseModel):
    """FR-AGT-05. Pesan alasan sama persis dengan yang dilihat admin (§B, satu sumber kebenaran)."""

    layak: bool
    alasan: list[AlasanKeluar]

    @classmethod
    def dari(cls, k: Kelayakan) -> "KelayakanKeluar":
        return cls(layak=k.layak, alasan=[AlasanKeluar(**vars(a)) for a in k.alasan])

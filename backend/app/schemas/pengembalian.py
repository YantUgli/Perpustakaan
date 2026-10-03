from datetime import date

from pydantic import BaseModel

from app.services.pengembalian import HasilPengembalian, Pratinjau


class EksemplarRingkas(BaseModel):
    kode: str
    judul: str


class PeminjamRingkas(BaseModel):
    """Sengaja tanpa NIK dan kontak."""

    kode: str
    nama: str


class PratinjauKeluar(BaseModel):
    """FR-KMB-02/04: informasi sebelum konfirmasi; nominal final di respons konfirmasi (OQ-25)."""

    eksemplar: EksemplarRingkas
    peminjam: PeminjamRingkas
    tanggal_pinjam: date
    jatuh_tempo: date
    hari_terlambat: int
    denda: int

    @classmethod
    def dari(cls, p: Pratinjau) -> "PratinjauKeluar":
        return cls(
            eksemplar=EksemplarRingkas(kode=p.eksemplar.kode, judul=p.eksemplar.nama),
            peminjam=PeminjamRingkas(kode=p.peminjam.kode, nama=p.peminjam.nama),
            tanggal_pinjam=p.tanggal_pinjam,
            jatuh_tempo=p.jatuh_tempo,
            hari_terlambat=p.hari_terlambat,
            denda=p.denda,
        )


class KonfirmasiMasuk(BaseModel):
    kode_eksemplar: str


class TagihanRingkas(BaseModel):
    id: int
    nominal: int


class PengembalianKeluar(BaseModel):
    eksemplar: EksemplarRingkas
    peminjam: PeminjamRingkas
    tanggal_kembali: date
    hari_terlambat: int
    tagihan: TagihanRingkas | None  # FR-KMB-06; admin menyampaikan nominalnya (Brief §6.3)
    transaksi_selesai: bool

    @classmethod
    def dari(cls, h: HasilPengembalian) -> "PengembalianKeluar":
        return cls(
            eksemplar=EksemplarRingkas(kode=h.eksemplar.kode, judul=h.eksemplar.nama),
            peminjam=PeminjamRingkas(kode=h.peminjam.kode, nama=h.peminjam.nama),
            tanggal_kembali=h.tanggal_kembali,
            hari_terlambat=h.hari_terlambat,
            tagihan=TagihanRingkas(id=h.tagihan.id, nominal=h.tagihan.nominal)
            if h.tagihan
            else None,
            transaksi_selesai=h.transaksi_selesai,
        )

"""Area anggota: FR-AGT-01..05, NFR-SEC-03, OQ-34..36.

Semua fungsi hanya membaca data milik `anggota_id`, yang selalu berasal dari sesi (router tidak
menerima id/kode anggota). Setiap query difilter lewat item → transaksi → `anggota_id`.

`Terlambat` kondisi turunan (FR-DND-05): dihitung dengan `kalkulasi` dari `hari_ini_wib()` (K-07),
tidak pernah dikirim sebagai nilai `status`. Kelayakan (FR-AGT-05) memakai ulang
`peminjaman.kelayakan_anggota` — tidak ada aturan blokir kedua.
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.waktu import hari_ini_wib
from app.models import Anggota, Eksemplar, ItemTransaksi, JudulBuku, Tagihan, TransaksiPeminjaman
from app.models.status import StatusItem
from app.services import kalkulasi, peminjaman
from app.services.peminjaman import Kelayakan


@dataclass(frozen=True)
class QrAnggota:
    kode: str
    nama: str
    isi_qr: str


@dataclass(frozen=True)
class PinjamanAktif:
    kode_eksemplar: str
    judul: str
    tanggal_pinjam: date
    jatuh_tempo: date
    sisa_hari: int
    terlambat: bool
    hari_terlambat: int


@dataclass(frozen=True)
class ItemRiwayat:
    kode_eksemplar: str
    judul: str
    tanggal_pinjam: date
    jatuh_tempo: date
    tanggal_kembali: date | None
    status: str
    terlambat: bool
    tanggal_kejadian: date | None


@dataclass(frozen=True)
class TagihanAnggota:
    id: int
    jenis: str
    nominal: int
    status: str
    cara_penyelesaian: str | None
    tanggal_dibentuk: date
    tanggal_penyelesaian: date | None
    kode_eksemplar: str
    judul: str


# --------------------------------------------------------------------------------------- bantu


def _query_item(anggota_id: int, *kolom):
    """Item milik anggota (item → transaksi → anggota_id) beserta kode eksemplar dan judul."""
    return (
        select(*kolom, Eksemplar.kode, JudulBuku.judul)
        .select_from(ItemTransaksi)
        .join(TransaksiPeminjaman, ItemTransaksi.transaksi_id == TransaksiPeminjaman.id)
        .join(Eksemplar, ItemTransaksi.eksemplar_id == Eksemplar.id)
        .join(JudulBuku, Eksemplar.judul_buku_id == JudulBuku.id)
        .where(TransaksiPeminjaman.anggota_id == anggota_id)
    )


def _halaman(db: Session, q, halaman: int, per_halaman: int) -> tuple[list, int]:
    total = db.scalar(select(func.count()).select_from(q.order_by(None).subquery()))
    baris = db.execute(q.offset((halaman - 1) * per_halaman).limit(per_halaman)).all()
    return baris, total


# --------------------------------------------------------------------------------------- baca


def qr(db: Session, anggota_id: int) -> QrAnggota:
    """FR-AGT-01, BR-04: isi QR = ID (kode) anggota, teks polos; gambar dibuat di klien."""
    kode, nama = db.execute(
        select(Anggota.kode, Anggota.nama).where(Anggota.id == anggota_id)
    ).one()
    return QrAnggota(kode=kode, nama=nama, isi_qr=kode)


def pinjaman_aktif(db: Session, anggota_id: int) -> list[PinjamanAktif]:
    """FR-AGT-02: item Dipinjam (termasuk yang terlambat), jatuh tempo terdekat dulu.

    ASUMSI(OQ-34): `sisa_hari` = max(jatuh tempo − hari ini WIB, 0); `hari_terlambat` terpisah.
    """
    hari_ini = hari_ini_wib()
    baris = db.execute(
        _query_item(anggota_id, ItemTransaksi)
        .where(ItemTransaksi.status == StatusItem.DIPINJAM)
        .order_by(ItemTransaksi.jatuh_tempo, ItemTransaksi.id)
    ).all()
    return [
        PinjamanAktif(
            kode_eksemplar=kode,
            judul=judul,
            tanggal_pinjam=i.tanggal_pinjam,
            jatuh_tempo=i.jatuh_tempo,
            sisa_hari=max((i.jatuh_tempo - hari_ini).days, 0),
            terlambat=kalkulasi.is_terlambat(StatusItem(i.status), i.jatuh_tempo, hari_ini),
            hari_terlambat=kalkulasi.hitung_hari_terlambat(i.jatuh_tempo, hari_ini),
        )
        for i, kode, judul in baris
    ]


def riwayat(
    db: Session, anggota_id: int, *, halaman: int, per_halaman: int
) -> tuple[list[ItemRiwayat], int]:
    """FR-AGT-03: semua item anggota, tanggal pinjam terbaru dulu lalu id.

    ASUMSI(OQ-35): termasuk yang masih Dipinjam; Hilang/Rusak menampilkan tanggal kejadian,
    tanpa keterangan dan admin pencatat (catatan internal admin).
    """
    hari_ini = hari_ini_wib()
    q = _query_item(anggota_id, ItemTransaksi).order_by(
        ItemTransaksi.tanggal_pinjam.desc(), ItemTransaksi.id.desc()
    )
    baris, total = _halaman(db, q, halaman, per_halaman)
    return [
        ItemRiwayat(
            kode_eksemplar=kode,
            judul=judul,
            tanggal_pinjam=i.tanggal_pinjam,
            jatuh_tempo=i.jatuh_tempo,
            tanggal_kembali=i.tanggal_kembali,
            status=i.status,
            terlambat=kalkulasi.is_terlambat(StatusItem(i.status), i.jatuh_tempo, hari_ini),
            tanggal_kejadian=i.tanggal_kejadian,
        )
        for i, kode, judul in baris
    ], total


def tagihan(
    db: Session, anggota_id: int, *, halaman: int, per_halaman: int
) -> tuple[list[TagihanAnggota], int]:
    """FR-AGT-04: semua tagihan anggota, urutan sama dengan daftar admin (FR-TGH-01).

    ASUMSI(OQ-36): tanpa nama admin pengonfirmasi dan `nominal_dibayar`.
    """
    q = (
        _query_item(anggota_id, Tagihan)
        .join(Tagihan, Tagihan.item_transaksi_id == ItemTransaksi.id)
        .order_by(Tagihan.tanggal_dibentuk.desc(), Tagihan.id.desc())
    )
    baris, total = _halaman(db, q, halaman, per_halaman)
    return [
        TagihanAnggota(
            id=t.id,
            jenis=t.jenis,
            nominal=t.nominal,
            status=t.status,
            cara_penyelesaian=t.cara_penyelesaian,
            tanggal_dibentuk=t.tanggal_dibentuk,
            tanggal_penyelesaian=t.tanggal_penyelesaian,
            kode_eksemplar=kode,
            judul=judul,
        )
        for t, kode, judul in baris
    ], total


def kelayakan(db: Session, anggota_id: int) -> Kelayakan:
    """FR-AGT-05, BR-18: sumber tunggal `peminjaman.kelayakan_anggota` (pesan sama dengan admin)."""
    return peminjaman.kelayakan_anggota(db, anggota_id)

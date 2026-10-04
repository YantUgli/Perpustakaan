"""Dashboard & laporan (query): FR-LAP-01..03, WBS 5.2.3, OQ-07, OQ-11, OQ-37..41.

Satu sumber filter: tampilan JSON (berhalaman) dan ekspor PDF/xlsx (`app/services/ekspor.py`, semua
baris) memanggil fungsi yang sama, sehingga isi ekspor identik dengan JSON untuk filter yang sama.

`Terlambat` turunan (FR-DND-05): item Dipinjam dan `jatuh_tempo < hari_ini`, dengan `hari_ini` dari
`hari_ini_wib()` yang dikirim sebagai parameter SQL — tidak pernah `CURRENT_DATE` (K-07).
Uang = int Rupiah; total dijumlahkan di DB (`SUM`), tanpa float.
"""

from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.format import format_tanggal
from app.core.galat import GalatBisnis
from app.core.waktu import hari_ini_wib
from app.models import (
    Admin,
    Anggota,
    Eksemplar,
    ItemTransaksi,
    JudulBuku,
    Tagihan,
    TransaksiPeminjaman,
)
from app.models.status import StatusEksemplar, StatusItem, StatusTagihan
from app.services import kalkulasi


class StatusLaporan(StrEnum):
    """ASUMSI(OQ-37): pilihan filter saling lepas sesuai label yang tampil. `TERLAMBAT` hanya
    nilai filter/label, tidak pernah disimpan."""

    DIPINJAM = "DIPINJAM"  # Dipinjam dan belum lewat jatuh tempo
    TERLAMBAT = "TERLAMBAT"
    DIKEMBALIKAN = "DIKEMBALIKAN"
    HILANG = "HILANG"
    RUSAK = "RUSAK"


@dataclass(frozen=True)
class Dashboard:
    jumlah_judul: int
    eksemplar_per_status: dict[str, int]
    jumlah_anggota: int
    item_dipinjam: int
    item_terlambat: int
    tagihan_belum_lunas_jumlah: int
    tagihan_belum_lunas_total: int


@dataclass(frozen=True)
class FilterTransaksi:
    dari: date | None = None
    sampai: date | None = None
    status: StatusLaporan | None = None


@dataclass(frozen=True)
class BarisTransaksi:
    item_id: int
    anggota_kode: str
    anggota_nama: str
    judul: str
    kode_eksemplar: str
    tanggal_pinjam: date
    jatuh_tempo: date
    tanggal_kembali: date | None
    status: str
    terlambat: bool


@dataclass(frozen=True)
class FilterTagihan:
    dari: date | None = None
    sampai: date | None = None
    jenis: str | None = None
    status: str | None = None
    cara: str | None = None


@dataclass(frozen=True)
class BarisTagihan:
    id: int
    tanggal_dibentuk: date
    anggota_kode: str
    anggota_nama: str
    judul: str
    kode_eksemplar: str
    jenis: str
    nominal: int
    status: str
    cara_penyelesaian: str | None
    tanggal_penyelesaian: date | None
    admin_pengonfirmasi: str | None


@dataclass(frozen=True)
class HasilTagihan:
    baris: list[BarisTagihan]
    jumlah: int
    total_nominal: int


# --------------------------------------------------------------------------------------- bantu


def periksa_rentang(dari: date | None, sampai: date | None, rujukan: str) -> None:
    """ASUMSI(OQ-38): kedua batas opsional & inklusif; `dari > sampai` ditolak."""
    if dari and sampai and dari > sampai:
        raise GalatBisnis(
            kode="LAP_RENTANG_TIDAK_VALID",
            pesan=f"Rentang tanggal tidak valid: tanggal awal {format_tanggal(dari)} "
            f"setelah tanggal akhir {format_tanggal(sampai)}.",
            rujukan=rujukan,
            status_code=422,
        )


def _halaman(q, halaman: int | None, per_halaman: int | None):
    """Tanpa `halaman` = semua baris (dipakai ekspor; ASUMSI(OQ-41): tanpa batas baris)."""
    if halaman is None or per_halaman is None:
        return q
    return q.offset((halaman - 1) * per_halaman).limit(per_halaman)


# --------------------------------------------------------------------------------------- dashboard


def dashboard(db: Session) -> Dashboard:
    """FR-LAP-01. ASUMSI(OQ-40): item dipinjam termasuk yang terlambat (BR-08); terlambat =
    Dipinjam dan `jatuh_tempo < hari_ini` (WIB, parameter — bukan CURRENT_DATE)."""
    hari_ini = hari_ini_wib()
    per_status = dict.fromkeys(StatusEksemplar, 0)
    for status, jumlah in db.execute(
        select(Eksemplar.status, func.count()).group_by(Eksemplar.status)
    ):
        per_status[StatusEksemplar(status)] = jumlah
    dipinjam = ItemTransaksi.status == StatusItem.DIPINJAM
    item_dipinjam, item_terlambat = db.execute(
        select(
            func.count().filter(dipinjam),
            func.count().filter(dipinjam, ItemTransaksi.jatuh_tempo < hari_ini),
        ).select_from(ItemTransaksi)
    ).one()
    jumlah_tagihan, total_tagihan = db.execute(
        select(func.count(), func.coalesce(func.sum(Tagihan.nominal), 0)).where(
            Tagihan.status == StatusTagihan.BELUM_LUNAS
        )
    ).one()
    return Dashboard(
        jumlah_judul=db.scalar(select(func.count()).select_from(JudulBuku)),
        eksemplar_per_status={str(k): v for k, v in per_status.items()},
        jumlah_anggota=db.scalar(select(func.count()).select_from(Anggota)),
        item_dipinjam=item_dipinjam,
        item_terlambat=item_terlambat,
        tagihan_belum_lunas_jumlah=jumlah_tagihan,
        tagihan_belum_lunas_total=int(total_tagihan),
    )


# --------------------------------------------------------------------------------------- transaksi


def _kondisi_status(status: StatusLaporan, hari_ini: date) -> list:
    """ASUMSI(OQ-37): DIPINJAM dan TERLAMBAT saling lepas; definisi sama dengan
    `kalkulasi.is_terlambat` (Dipinjam dan hari ini > jatuh tempo)."""
    dipinjam = ItemTransaksi.status == StatusItem.DIPINJAM
    if status is StatusLaporan.DIPINJAM:
        return [dipinjam, ItemTransaksi.jatuh_tempo >= hari_ini]
    if status is StatusLaporan.TERLAMBAT:
        return [dipinjam, ItemTransaksi.jatuh_tempo < hari_ini]
    return [ItemTransaksi.status == StatusItem(status.value)]


def laporan_transaksi(
    db: Session, f: FilterTransaksi, *, halaman: int | None = None, per_halaman: int | None = None
) -> tuple[list[BarisTransaksi], int]:
    """FR-LAP-02: satu baris per item. ASUMSI(OQ-07): filter tanggal pinjam; ASUMSI(OQ-41): urut
    tanggal pinjam terlama lalu id. Tanpa `halaman` = semua baris (ekspor FR-LAP-04)."""
    periksa_rentang(f.dari, f.sampai, "FR-LAP-02")
    hari_ini = hari_ini_wib()
    kondisi = []
    if f.dari:
        kondisi.append(ItemTransaksi.tanggal_pinjam >= f.dari)
    if f.sampai:
        kondisi.append(ItemTransaksi.tanggal_pinjam <= f.sampai)
    if f.status:
        kondisi += _kondisi_status(f.status, hari_ini)
    q = (
        select(
            ItemTransaksi.id,
            Anggota.kode,
            Anggota.nama,
            JudulBuku.judul,
            Eksemplar.kode,
            ItemTransaksi.tanggal_pinjam,
            ItemTransaksi.jatuh_tempo,
            ItemTransaksi.tanggal_kembali,
            ItemTransaksi.status,
        )
        .select_from(ItemTransaksi)
        .join(TransaksiPeminjaman, ItemTransaksi.transaksi_id == TransaksiPeminjaman.id)
        .join(Anggota, TransaksiPeminjaman.anggota_id == Anggota.id)
        .join(Eksemplar, ItemTransaksi.eksemplar_id == Eksemplar.id)
        .join(JudulBuku, Eksemplar.judul_buku_id == JudulBuku.id)
        .where(*kondisi)
    )
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    baris = db.execute(
        _halaman(q.order_by(ItemTransaksi.tanggal_pinjam, ItemTransaksi.id), halaman, per_halaman)
    ).all()
    return [
        BarisTransaksi(
            item_id=item_id,
            anggota_kode=kode_agt,
            anggota_nama=nama_agt,
            judul=judul,
            kode_eksemplar=kode_eks,
            tanggal_pinjam=pinjam,
            jatuh_tempo=jatuh_tempo,
            tanggal_kembali=kembali,
            status=status,
            terlambat=kalkulasi.is_terlambat(StatusItem(status), jatuh_tempo, hari_ini),
        )
        for item_id, kode_agt, nama_agt, judul, kode_eks, pinjam, jatuh_tempo, kembali, status in (
            baris
        )
    ], total


# --------------------------------------------------------------------------------------- tagihan


def laporan_tagihan(
    db: Session, f: FilterTagihan, *, halaman: int | None = None, per_halaman: int | None = None
) -> HasilTagihan:
    """FR-LAP-03. ASUMSI(OQ-11): filter tanggal dibentuk; ASUMSI(OQ-39): kolom; ASUMSI(OQ-41):
    urut tanggal dibentuk terlama lalu id. Jumlah & total nominal dari seluruh baris yang lolos
    filter (SUM di DB, integer), bukan dari halaman."""
    periksa_rentang(f.dari, f.sampai, "FR-LAP-03")
    kondisi = []
    if f.dari:
        kondisi.append(Tagihan.tanggal_dibentuk >= f.dari)
    if f.sampai:
        kondisi.append(Tagihan.tanggal_dibentuk <= f.sampai)
    if f.jenis:
        kondisi.append(Tagihan.jenis == f.jenis)
    if f.status:
        kondisi.append(Tagihan.status == f.status)
    if f.cara:
        kondisi.append(Tagihan.cara_penyelesaian == f.cara)
    jumlah, total = db.execute(
        select(func.count(), func.coalesce(func.sum(Tagihan.nominal), 0)).where(*kondisi)
    ).one()
    q = (
        select(Tagihan, Anggota.kode, Anggota.nama, JudulBuku.judul, Eksemplar.kode, Admin.nama)
        .select_from(Tagihan)
        .join(ItemTransaksi, Tagihan.item_transaksi_id == ItemTransaksi.id)
        .join(TransaksiPeminjaman, ItemTransaksi.transaksi_id == TransaksiPeminjaman.id)
        .join(Anggota, TransaksiPeminjaman.anggota_id == Anggota.id)
        .join(Eksemplar, ItemTransaksi.eksemplar_id == Eksemplar.id)
        .join(JudulBuku, Eksemplar.judul_buku_id == JudulBuku.id)
        .outerjoin(Admin, Tagihan.admin_pengonfirmasi_id == Admin.id)
        .where(*kondisi)
        .order_by(Tagihan.tanggal_dibentuk, Tagihan.id)
    )
    return HasilTagihan(
        baris=[
            BarisTagihan(
                id=t.id,
                tanggal_dibentuk=t.tanggal_dibentuk,
                anggota_kode=kode_agt,
                anggota_nama=nama_agt,
                judul=judul,
                kode_eksemplar=kode_eks,
                jenis=t.jenis,
                nominal=t.nominal,
                status=t.status,
                cara_penyelesaian=t.cara_penyelesaian,
                tanggal_penyelesaian=t.tanggal_penyelesaian,
                admin_pengonfirmasi=nama_admin,
            )
            for t, kode_agt, nama_agt, judul, kode_eks, nama_admin in db.execute(
                _halaman(q, halaman, per_halaman)
            )
        ],
        jumlah=jumlah,
        total_nominal=int(total),
    )

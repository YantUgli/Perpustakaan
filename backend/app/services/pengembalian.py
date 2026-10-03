"""Pengembalian: FR-KMB-01..08, BR-12, BR-20, NFR-REL-01/02, OQ-25.

Satu permintaan = satu eksemplar. Pratinjau tidak mengubah data; konfirmasi menghitung ulang denda
dari `tanggal_kembali = hari_ini_wib()` (OQ-25) dalam satu transaksi DB (NFR-REL-01).

Urutan kunci sama dengan peminjaman (titipan 5.3.8): baris anggota peminjam dulu, lalu eksemplar,
lalu item dibaca ulang. Kunci anggota juga membuat pengembalian item-item satu transaksi berjalan
berurutan sehingga penutupan transaksi (FR-KMB-08) tidak saling melewatkan.
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.core.validasi import normalisasi_kode
from app.core.waktu import hari_ini_wib
from app.models import Anggota, Eksemplar, ItemTransaksi, JudulBuku, Tagihan, TransaksiPeminjaman
from app.models.status import (
    LABEL_STATUS_EKSEMPLAR,
    JenisTagihan,
    StatusEksemplar,
    StatusItem,
    StatusTagihan,
    StatusTransaksi,
)
from app.services import kalkulasi

# Constraint penanda balapan pengembalian ganda → galat yang sama dengan pemeriksaan service.
_CONSTRAINT_BALAPAN = {"uq_tagihan_item_transaksi_id", "uq_item_transaksi_pinjaman_aktif"}


@dataclass(frozen=True)
class Ringkas:
    kode: str
    nama: str  # judul untuk eksemplar, nama untuk peminjam


@dataclass(frozen=True)
class Pratinjau:
    eksemplar: Ringkas
    peminjam: Ringkas
    tanggal_pinjam: date
    jatuh_tempo: date
    hari_terlambat: int
    denda: int


@dataclass(frozen=True)
class TagihanDibentuk:
    id: int
    nominal: int


@dataclass(frozen=True)
class HasilPengembalian:
    eksemplar: Ringkas
    peminjam: Ringkas
    tanggal_kembali: date
    hari_terlambat: int
    tagihan: TagihanDibentuk | None
    transaksi_selesai: bool


# --------------------------------------------------------------------------------------- galat


def _galat_eksemplar_tidak_ada(kode: str) -> GalatBisnis:
    return GalatBisnis(
        kode="KMB_EKSEMPLAR_TIDAK_ADA",
        pesan=f"Eksemplar dengan kode {kode} tidak ditemukan.",
        rujukan="FR-KMB-01",
        status_code=404,
    )


def _galat_tidak_dipinjam(kode: str, status: str) -> GalatBisnis:
    label = LABEL_STATUS_EKSEMPLAR[StatusEksemplar(status)]
    return GalatBisnis(
        kode="KMB_TIDAK_DIPINJAM",
        pesan=f"Eksemplar {kode} tidak sedang dipinjam (status saat ini: {label}).",
        rujukan="FR-KMB-03",
        status_code=422,
    )


# --------------------------------------------------------------------------------------- pencarian


def _eksemplar(db: Session, kode: str, *, kunci: bool = False) -> Eksemplar:
    q = select(Eksemplar).where(Eksemplar.kode == kode)
    if kunci:
        q = q.with_for_update().execution_options(populate_existing=True)
    e = db.scalar(q)
    if e is None:
        raise _galat_eksemplar_tidak_ada(kode)
    return e


def _item_aktif(db: Session, eksemplar: Eksemplar) -> ItemTransaksi:
    """FR-KMB-02/03: item Dipinjam untuk eksemplar ini (paling banyak satu; index unik)."""
    item = db.scalar(
        select(ItemTransaksi)
        .where(
            ItemTransaksi.eksemplar_id == eksemplar.id,
            ItemTransaksi.status == StatusItem.DIPINJAM,
        )
        .execution_options(populate_existing=True)
    )
    if item is None:
        raise _galat_tidak_dipinjam(eksemplar.kode, eksemplar.status)
    return item


def _anggota_item(db: Session, item: ItemTransaksi, *, kunci: bool = False) -> Anggota:
    anggota_id = select(TransaksiPeminjaman.anggota_id).where(
        TransaksiPeminjaman.id == item.transaksi_id
    )
    q = select(Anggota).where(Anggota.id == anggota_id.scalar_subquery())
    if kunci:
        q = q.with_for_update().execution_options(populate_existing=True)
    return db.scalar(q)


def _hitung(item: ItemTransaksi, harga: int, tanggal_kembali: date) -> tuple[int, int]:
    """FR-DND-01..04 lewat modul kalkulasi; hanya menghitung."""
    hari = kalkulasi.hitung_hari_terlambat(item.jatuh_tempo, tanggal_kembali)
    denda = kalkulasi.hitung_denda(
        jatuh_tempo=item.jatuh_tempo, tanggal_kembali=tanggal_kembali, harga=harga
    )
    return hari, denda


# --------------------------------------------------------------------------------------- pratinjau


def pratinjau(db: Session, kode_eksemplar: str) -> Pratinjau:
    """FR-KMB-01..04: peminjam, tanggal, hari terlambat, dan denda sebelum konfirmasi.

    Informasi saja (OQ-25); tidak mengubah data."""
    e = _eksemplar(db, normalisasi_kode(kode_eksemplar))
    item = _item_aktif(db, e)
    anggota = _anggota_item(db, item)
    judul = db.get(JudulBuku, e.judul_buku_id)
    hari, denda = _hitung(item, judul.harga, hari_ini_wib())
    return Pratinjau(
        eksemplar=Ringkas(kode=e.kode, nama=judul.judul),
        peminjam=Ringkas(kode=anggota.kode, nama=anggota.nama),
        tanggal_pinjam=item.tanggal_pinjam,
        jatuh_tempo=item.jatuh_tempo,
        hari_terlambat=hari,
        denda=denda,
    )


# --------------------------------------------------------------------------------------- konfirmasi


def tutup_transaksi_bila_selesai(db: Session, transaksi_id: int) -> bool:
    """FR-KMB-08: transaksi → Selesai bila tak ada lagi item Dipinjam (semua Dikembalikan/Hilang/
    Rusak). Hanya mengubah transaksi; tidak commit. Dipakai ulang WP 5.3.10.

    Pemanggil wajib sudah memegang kunci baris anggota pemilik transaksi."""
    db.flush()  # sesi aplikasi autoflush=False: perubahan item harus terlihat oleh hitungan
    masih_dipinjam = db.scalar(
        select(func.count(ItemTransaksi.id)).where(
            ItemTransaksi.transaksi_id == transaksi_id,
            ItemTransaksi.status == StatusItem.DIPINJAM,
        )
    )
    if masih_dipinjam:
        return False
    trx = db.get(TransaksiPeminjaman, transaksi_id)
    trx.status = StatusTransaksi.SELESAI
    db.flush()
    return True


def _bentuk_tagihan(db: Session, item_id: int, nominal: int, tanggal: date) -> Tagihan:
    """FR-KMB-06: tagihan Denda Belum Lunas; nominal disimpan dan tak dihitung ulang (SRS 7.1)."""
    t = Tagihan(
        item_transaksi_id=item_id,
        jenis=JenisTagihan.DENDA,
        nominal=nominal,
        status=StatusTagihan.BELUM_LUNAS,
        tanggal_dibentuk=tanggal,  # ASUMSI(OQ-08, OQ-11)
    )
    db.add(t)
    db.flush()
    return t


def _kembalikan(db: Session, kode: str) -> HasilPengembalian | None:
    """Satu percobaan di bawah kunci. None = item berganti sejak dibaca tanpa kunci (ulang)."""
    e = _eksemplar(db, kode)
    item = _item_aktif(db, e)
    anggota = _anggota_item(db, item, kunci=True)  # 1. anggota
    e = _eksemplar(db, kode, kunci=True)  # 2. eksemplar
    terkini = _item_aktif(db, e)  # 3. baca ulang item di bawah kunci
    if terkini.id != item.id:
        return None
    item = terkini

    judul = db.get(JudulBuku, e.judul_buku_id)
    tanggal_kembali = hari_ini_wib()  # ASUMSI(OQ-25): selalu hari ini WIB, tanpa isian manual
    hari, denda = _hitung(item, judul.harga, tanggal_kembali)  # OQ-25: dihitung ulang di sini

    item.status = StatusItem.DIKEMBALIKAN  # FR-KMB-05
    item.tanggal_kembali = tanggal_kembali
    e.status = StatusEksemplar.TERSEDIA  # BR-20
    db.flush()
    tagihan = _bentuk_tagihan(db, item.id, denda, tanggal_kembali) if denda > 0 else None
    selesai = tutup_transaksi_bila_selesai(db, item.transaksi_id)
    return HasilPengembalian(
        eksemplar=Ringkas(kode=e.kode, nama=judul.judul),
        peminjam=Ringkas(kode=anggota.kode, nama=anggota.nama),
        tanggal_kembali=tanggal_kembali,
        hari_terlambat=hari,
        tagihan=TagihanDibentuk(id=tagihan.id, nominal=tagihan.nominal) if tagihan else None,
        transaksi_selesai=selesai,
    )


def konfirmasi(db: Session, *, kode_eksemplar: str) -> HasilPengembalian:
    """FR-KMB-05..08 dalam satu transaksi DB; galat apa pun → rollback tanpa perubahan."""
    kode = normalisasi_kode(kode_eksemplar)
    for _ in range(2):  # sekali ulang bila eksemplar dikembalikan & dipinjam lagi di sela kunci
        try:
            hasil = _kembalikan(db, kode)
            if hasil is None:
                db.rollback()
                continue
            db.commit()
            return hasil
        except IntegrityError as exc:
            db.rollback()
            diag = getattr(exc.orig, "diag", None)
            if getattr(diag, "constraint_name", None) not in _CONSTRAINT_BALAPAN:
                raise
            e = _eksemplar(db, kode)
            raise _galat_tidak_dipinjam(kode, e.status) from exc
        except BaseException:
            db.rollback()
            raise
    e = _eksemplar(db, kode)
    raise _galat_tidak_dipinjam(kode, e.status)

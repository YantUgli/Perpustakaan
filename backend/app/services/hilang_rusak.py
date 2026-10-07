"""Hilang/rusak: FR-HLR-01..05, BR-14..16, K-01, OQ-26, OQ-27.

Satu-satunya jalan item/eksemplar ke Hilang atau Rusak dalam transaksi: pencatatan oleh admin
berdasarkan laporan (K-01). Tidak ada penetapan otomatis (FR-HLR-05), termasuk setelah plafon denda.
Tagihan Penggantian = harga judul, tanpa denda keterlambatan (BR-15) — `kalkulasi.hitung_denda`
sengaja tidak dipanggil di sini (`hitung_hari_terlambat` hanya untuk informasi daftar item).

Urutan kunci sama dengan 5.3.8/5.3.9: anggota → eksemplar → baca ulang item. Penutupan transaksi
lewat `pengembalian.tutup_transaksi_bila_selesai` (FR-KMB-08) di bawah kunci anggota yang sama.
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.format import format_tanggal
from app.core.galat import GalatBisnis
from app.core.validasi import normalisasi_kode
from app.core.waktu import hari_ini_wib
from app.models import Anggota, Eksemplar, ItemTransaksi, JudulBuku, Tagihan, TransaksiPeminjaman
from app.models.status import (
    LABEL_STATUS_ITEM,
    JenisTagihan,
    StatusEksemplar,
    StatusItem,
    StatusTagihan,
)
from app.services import kalkulasi, pengembalian

_JENIS_SAH = {StatusItem.HILANG, StatusItem.RUSAK}
_CONSTRAINT_BALAPAN = {"uq_tagihan_item_transaksi_id"}


@dataclass(frozen=True)
class Ringkas:
    kode: str
    nama: str


@dataclass(frozen=True)
class ItemAktif:
    item_id: int
    kode_eksemplar: str
    judul: str
    tanggal_pinjam: date
    jatuh_tempo: date
    hari_terlambat: int
    nominal_penggantian: int


@dataclass(frozen=True)
class DaftarItem:
    anggota: Ringkas
    item: list[ItemAktif]


@dataclass(frozen=True)
class TagihanDibentuk:
    id: int
    nominal: int


@dataclass(frozen=True)
class HasilPencatatan:
    item_id: int
    kode_eksemplar: str
    judul: str
    anggota: Ringkas
    status: str
    tanggal_kejadian: date
    keterangan: str
    tagihan: TagihanDibentuk
    transaksi_selesai: bool


# --------------------------------------------------------------------------------------- galat


def _galat(kode: str, pesan: str, rujukan: str, status_code: int) -> GalatBisnis:
    return GalatBisnis(kode=kode, pesan=pesan, rujukan=rujukan, status_code=status_code)


def _galat_tidak_dipinjam(item: ItemTransaksi, kode_eksemplar: str) -> GalatBisnis:
    label = LABEL_STATUS_ITEM[StatusItem(item.status)]
    return _galat(
        "HLR_TIDAK_DIPINJAM",
        f"Item eksemplar {kode_eksemplar} tidak sedang dipinjam (status item: {label}); "
        "hanya item Dipinjam yang dapat dicatat Hilang atau Rusak.",
        "FR-HLR-03",
        422,
    )


# ---------------------------------------------------------------------------------- daftar item


def daftar_item_anggota(db: Session, kode_anggota: str) -> DaftarItem:
    """FR-HLR-01: item Dipinjam milik anggota (kode dari QR atau diketik). Tidak mengubah data.

    `hari_terlambat` hanya informasi; tidak ada aturan yang bergantung padanya di sini.
    `nominal_penggantian` (FR-HLR-04) juga informasi dari harga judul saat ini; nominal final
    dibentuk saat dicatat."""
    kode = normalisasi_kode(kode_anggota)
    a = db.scalar(select(Anggota).where(Anggota.kode == kode))
    if a is None:
        raise _galat(
            "HLR_ANGGOTA_TIDAK_ADA", f"Anggota dengan ID {kode} tidak ditemukan.", "FR-HLR-01", 404
        )
    hari_ini = hari_ini_wib()
    baris = db.execute(
        select(ItemTransaksi, Eksemplar.kode, JudulBuku.judul, JudulBuku.harga)
        .join(TransaksiPeminjaman, ItemTransaksi.transaksi_id == TransaksiPeminjaman.id)
        .join(Eksemplar, ItemTransaksi.eksemplar_id == Eksemplar.id)
        .join(JudulBuku, Eksemplar.judul_buku_id == JudulBuku.id)
        .where(
            TransaksiPeminjaman.anggota_id == a.id,
            ItemTransaksi.status == StatusItem.DIPINJAM,
        )
        .order_by(ItemTransaksi.jatuh_tempo, ItemTransaksi.id)
    ).all()
    return DaftarItem(
        anggota=Ringkas(kode=a.kode, nama=a.nama),
        item=[
            ItemAktif(
                item_id=i.id,
                kode_eksemplar=kode_eks,
                judul=judul,
                tanggal_pinjam=i.tanggal_pinjam,
                jatuh_tempo=i.jatuh_tempo,
                hari_terlambat=kalkulasi.hitung_hari_terlambat(i.jatuh_tempo, hari_ini),
                nominal_penggantian=_nominal_penggantian(harga),
            )
            for i, kode_eks, judul, harga in baris
        ],
    )


# --------------------------------------------------------------------------------------- pencatatan


def _nominal_penggantian(harga_judul: int) -> int:
    """FR-HLR-04/BR-15: nominal penggantian = harga judul, tanpa denda keterlambatan.

    Satu-satunya sumber nominal: dipakai daftar item (informasi) dan saat tagihan dibentuk."""
    return harga_judul


def _bentuk_tagihan_penggantian(db: Session, item_id: int, nominal: int, tanggal: date) -> Tagihan:
    """FR-HLR-04: Penggantian = harga judul, Belum Lunas; nominal disimpan (SRS 7.1)."""
    t = Tagihan(
        item_transaksi_id=item_id,
        jenis=JenisTagihan.PENGGANTIAN,
        nominal=nominal,
        status=StatusTagihan.BELUM_LUNAS,
        tanggal_dibentuk=tanggal,  # ASUMSI(OQ-27): tanggal pencatatan
    )
    db.add(t)
    db.flush()
    return t


def _catat(
    db: Session,
    *,
    item_id: int,
    jenis: StatusItem,
    tanggal_kejadian: date,
    keterangan: str,
    admin_id: int,
) -> HasilPencatatan:
    item = db.get(ItemTransaksi, item_id)
    if item is None:
        raise _galat("HLR_ITEM_TIDAK_ADA", "Item transaksi tidak ditemukan.", "FR-HLR-01", 404)

    anggota = db.scalar(  # 1. anggota
        select(Anggota)
        .where(
            Anggota.id
            == select(TransaksiPeminjaman.anggota_id)
            .where(TransaksiPeminjaman.id == item.transaksi_id)
            .scalar_subquery()
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    e = db.scalar(  # 2. eksemplar
        select(Eksemplar)
        .where(Eksemplar.id == item.eksemplar_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    item = db.scalar(  # 3. baca ulang item di bawah kunci
        select(ItemTransaksi)
        .where(ItemTransaksi.id == item_id)
        .execution_options(populate_existing=True)
    )
    if item.status != StatusItem.DIPINJAM:
        raise _galat_tidak_dipinjam(item, e.kode)

    hari_ini = hari_ini_wib()
    # ASUMSI(OQ-26): tanggal pinjam ≤ tanggal kejadian ≤ hari ini; hanya dicatat.
    if not item.tanggal_pinjam <= tanggal_kejadian <= hari_ini:
        raise _galat(
            "HLR_TANGGAL_KEJADIAN",
            f"Tanggal kejadian harus antara {format_tanggal(item.tanggal_pinjam)} "
            f"(tanggal pinjam) dan {format_tanggal(hari_ini)} (hari ini).",
            "FR-HLR-03",
            422,
        )

    judul = db.get(JudulBuku, e.judul_buku_id)
    item.status = jenis  # FR-HLR-03
    item.tanggal_kejadian = tanggal_kejadian
    item.keterangan = keterangan
    item.admin_pencatat_id = admin_id
    e.status = StatusEksemplar(jenis.value)  # Hilang/Rusak sama nama di kedua kosakata
    db.flush()
    # FR-HLR-04/BR-15: senilai harga judul, tanpa denda walau item terlambat.
    tagihan = _bentuk_tagihan_penggantian(db, item.id, _nominal_penggantian(judul.harga), hari_ini)
    selesai = pengembalian.tutup_transaksi_bila_selesai(db, item.transaksi_id)  # FR-KMB-08
    return HasilPencatatan(
        item_id=item.id,
        kode_eksemplar=e.kode,
        judul=judul.judul,
        anggota=Ringkas(kode=anggota.kode, nama=anggota.nama),
        status=item.status,
        tanggal_kejadian=tanggal_kejadian,
        keterangan=keterangan,
        tagihan=TagihanDibentuk(id=tagihan.id, nominal=tagihan.nominal),
        transaksi_selesai=selesai,
    )


def catat(
    db: Session,
    *,
    item_id: int,
    jenis: StatusItem,
    tanggal_kejadian: date,
    keterangan: str,
    admin_id: int,
) -> HasilPencatatan:
    """FR-HLR-01..04: catat Hilang/Rusak berdasarkan laporan; satu transaksi DB (NFR-REL-01)."""
    if jenis not in _JENIS_SAH:
        raise _galat(
            "HLR_JENIS_TIDAK_SAH", "Jenis pencatatan harus Hilang atau Rusak.", "FR-HLR-03", 422
        )
    keterangan = (keterangan or "").strip()
    if not keterangan:  # ASUMSI(OQ-10)
        raise _galat("HLR_KETERANGAN_KOSONG", "Keterangan kejadian wajib diisi.", "FR-HLR-03", 422)
    try:
        hasil = _catat(
            db,
            item_id=item_id,
            jenis=jenis,
            tanggal_kejadian=tanggal_kejadian,
            keterangan=keterangan,
            admin_id=admin_id,
        )
        db.commit()
        return hasil
    except IntegrityError as exc:
        db.rollback()
        diag = getattr(exc.orig, "diag", None)
        if getattr(diag, "constraint_name", None) not in _CONSTRAINT_BALAPAN:
            raise
        item = db.get(ItemTransaksi, item_id)
        raise _galat_tidak_dipinjam(item, db.get(Eksemplar, item.eksemplar_id).kode) from exc
    except BaseException:
        db.rollback()
        raise

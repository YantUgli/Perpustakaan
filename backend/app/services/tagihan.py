"""Tagihan: FR-TGH-01..07, BR-17, BR-19, BR-20, OQ-08, OQ-28, OQ-29.

Penyelesaian satu transaksi DB (NFR-REL-01). Urutan kunci sama dengan sirkulasi (titipan 5.3.8):
anggota pemilik → eksemplar → tagihan dibaca ulang `FOR UPDATE`; status Belum Lunas diperiksa ulang
di bawah kunci. Lapis kedua FR-TGH-06: trigger DB `trg_tagihan_lunas_terkunci`.

Tidak ada ubah/hapus tagihan, pembayaran sebagian, payment gateway, maupun verifikasi bukti (§13).
Kelayakan meminjam (FR-TGH-07) tidak disimpan; `peminjaman.kelayakan_anggota` selalu menghitung.
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.format import format_rupiah, format_tanggal
from app.core.galat import GalatBisnis
from app.core.validasi import normalisasi_kode
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
from app.models.status import (
    LABEL_STATUS_EKSEMPLAR,
    CaraPenyelesaian,
    JenisTagihan,
    StatusEksemplar,
    StatusTagihan,
)

_PENANDA_TRIGGER = "tagihan_lunas_terkunci"  # awal pesan RAISE di trigger FR-TGH-06
_EKSEMPLAR_GANTI = (StatusEksemplar.HILANG, StatusEksemplar.RUSAK)


@dataclass(frozen=True)
class Ringkas:
    kode: str
    nama: str


@dataclass(frozen=True)
class TagihanRinci:
    id: int
    jenis: str
    nominal: int
    status: str
    tanggal_dibentuk: date
    anggota: Ringkas
    eksemplar: Ringkas  # nama = judul
    cara_penyelesaian: str | None
    nominal_dibayar: int | None
    tanggal_penyelesaian: date | None
    admin_pengonfirmasi: str | None  # nama admin


# --------------------------------------------------------------------------------------- galat


def _galat(kode: str, pesan: str, rujukan: str, status_code: int) -> GalatBisnis:
    return GalatBisnis(kode=kode, pesan=pesan, rujukan=rujukan, status_code=status_code)


def _galat_tidak_ada() -> GalatBisnis:
    return _galat("TGH_TIDAK_ADA", "Tagihan tidak ditemukan.", "FR-TGH-01", 404)


def _galat_sudah_lunas(tagihan_id: int) -> GalatBisnis:
    return _galat(
        "TGH_SUDAH_LUNAS",
        f"Tagihan #{tagihan_id} sudah Lunas dan tidak dapat diubah lagi.",
        "FR-TGH-06",
        409,
    )


# --------------------------------------------------------------------------------------- baca


def _query_rinci():
    return (
        select(
            Tagihan,
            Anggota.kode,
            Anggota.nama,
            Eksemplar.kode,
            JudulBuku.judul,
            Admin.nama,
        )
        .join(ItemTransaksi, Tagihan.item_transaksi_id == ItemTransaksi.id)
        .join(TransaksiPeminjaman, ItemTransaksi.transaksi_id == TransaksiPeminjaman.id)
        .join(Anggota, TransaksiPeminjaman.anggota_id == Anggota.id)
        .join(Eksemplar, ItemTransaksi.eksemplar_id == Eksemplar.id)
        .join(JudulBuku, Eksemplar.judul_buku_id == JudulBuku.id)
        .outerjoin(Admin, Tagihan.admin_pengonfirmasi_id == Admin.id)
    )


def _rinci(baris) -> TagihanRinci:
    t, kode_agt, nama_agt, kode_eks, judul, nama_admin = baris
    return TagihanRinci(
        id=t.id,
        jenis=t.jenis,
        nominal=t.nominal,
        status=t.status,
        tanggal_dibentuk=t.tanggal_dibentuk,
        anggota=Ringkas(kode=kode_agt, nama=nama_agt),
        eksemplar=Ringkas(kode=kode_eks, nama=judul),
        cara_penyelesaian=t.cara_penyelesaian,
        nominal_dibayar=t.nominal_dibayar,
        tanggal_penyelesaian=t.tanggal_penyelesaian,
        admin_pengonfirmasi=nama_admin,
    )


def daftar(
    db: Session,
    *,
    status: str | None,
    jenis: str | None,
    anggota_kode: str | None,
    halaman: int,
    per_halaman: int,
) -> tuple[list[TagihanRinci], int]:
    """FR-TGH-01: filter status, jenis, anggota; urut tanggal dibentuk terbaru lalu id."""
    kondisi = []
    if status:
        kondisi.append(Tagihan.status == StatusTagihan(status))
    if jenis:
        kondisi.append(Tagihan.jenis == JenisTagihan(jenis))
    if anggota_kode is not None:  # ASUMSI(OQ-29): kode anggota, cocok persis; tak dikenal → kosong
        kondisi.append(Anggota.kode == normalisasi_kode(anggota_kode))
    q = _query_rinci().where(*kondisi)
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    baris = db.execute(
        q.order_by(Tagihan.tanggal_dibentuk.desc(), Tagihan.id.desc())
        .offset((halaman - 1) * per_halaman)
        .limit(per_halaman)
    ).all()
    return [_rinci(b) for b in baris], total


def detail(db: Session, tagihan_id: int) -> TagihanRinci:
    baris = db.execute(_query_rinci().where(Tagihan.id == tagihan_id)).one_or_none()
    if baris is None:
        raise _galat_tidak_ada()
    return _rinci(baris)


# -------------------------------------------------------------------------------- penyelesaian


def _belum_lunas(t: Tagihan) -> bool:
    return t.status == StatusTagihan.BELUM_LUNAS


def _periksa_masukan(
    t: Tagihan, cara: CaraPenyelesaian, nominal: int | None, tanggal: date
) -> None:
    rujukan = "FR-TGH-03" if cara is CaraPenyelesaian.BUKU_PENGGANTI else "FR-TGH-02"
    if cara is CaraPenyelesaian.BUKU_PENGGANTI:
        if t.jenis != JenisTagihan.PENGGANTIAN:
            raise _galat(
                "TGH_BUKU_PENGGANTI_HANYA_PENGGANTIAN",
                "Buku pengganti hanya dapat menyelesaikan tagihan Penggantian; "
                "tagihan Denda diselesaikan dengan Tunai atau Transfer.",
                "FR-TGH-03",
                422,
            )
        if nominal is not None:  # ASUMSI(OQ-08): nominal_dibayar NULL untuk Buku Pengganti
            raise _galat(
                "TGH_NOMINAL_TIDAK_BERLAKU",
                "Nominal tidak diisi untuk penyelesaian dengan buku pengganti.",
                "FR-TGH-03",
                422,
            )
    else:
        if nominal is None:
            raise _galat(
                "TGH_NOMINAL_WAJIB",
                f"Nominal pembayaran wajib diisi ({format_rupiah(t.nominal)}).",
                "FR-TGH-02",
                422,
            )
        if nominal != t.nominal:  # FR-TGH-02: sama persis; pembayaran sebagian ditolak
            raise _galat(
                "TGH_NOMINAL_TIDAK_SAMA",
                f"Nominal {format_rupiah(nominal)} tidak sama dengan tagihan "
                f"{format_rupiah(t.nominal)}; pembayaran sebagian tidak diterima.",
                "FR-TGH-02",
                422,
            )
    hari_ini = hari_ini_wib()
    # ASUMSI(OQ-28): tanggal dibentuk ≤ tanggal ≤ hari ini; hanya dicatat.
    if not t.tanggal_dibentuk <= tanggal <= hari_ini:
        raise _galat(
            "TGH_TANGGAL",
            f"Tanggal penyelesaian harus antara {format_tanggal(t.tanggal_dibentuk)} "
            f"(tagihan dibentuk) dan {format_tanggal(hari_ini)} (hari ini).",
            rujukan,
            422,
        )


def _terima_buku_pengganti(e: Eksemplar) -> None:
    """FR-TGH-04/BR-20: eksemplar yang sama (kode tetap) Hilang/Rusak → Tersedia; hanya `status`."""
    if e.status not in _EKSEMPLAR_GANTI:
        raise _galat(
            "TGH_EKSEMPLAR_TIDAK_HILANG_RUSAK",
            f"Eksemplar {e.kode} berstatus "
            f"{LABEL_STATUS_EKSEMPLAR[StatusEksemplar(e.status)]}; buku pengganti hanya untuk "
            "eksemplar Hilang atau Rusak.",
            "FR-TGH-04",
            409,
        )
    e.status = StatusEksemplar.TERSEDIA


def _tandai_lunas(
    t: Tagihan, cara: CaraPenyelesaian, nominal: int | None, tanggal: date, admin_id: int
) -> None:
    """FR-TGH-05: Lunas + cara, tanggal, admin pengonfirmasi (OQ-08: nominal_dibayar)."""
    t.status = StatusTagihan.LUNAS
    t.cara_penyelesaian = cara
    t.nominal_dibayar = nominal
    t.tanggal_penyelesaian = tanggal
    t.admin_pengonfirmasi_id = admin_id


def _selesaikan(
    db: Session,
    tagihan_id: int,
    cara: CaraPenyelesaian,
    nominal: int | None,
    tanggal: date,
    admin_id: int,
) -> None:
    t = db.get(Tagihan, tagihan_id)
    if t is None:
        raise _galat_tidak_ada()
    item = db.get(ItemTransaksi, t.item_transaksi_id)
    db.execute(  # 1. anggota
        select(Anggota.id)
        .where(
            Anggota.id
            == select(TransaksiPeminjaman.anggota_id)
            .where(TransaksiPeminjaman.id == item.transaksi_id)
            .scalar_subquery()
        )
        .with_for_update()
    )
    e = db.scalar(  # 2. eksemplar (semua cara, agar urutan kunci seragam)
        select(Eksemplar)
        .where(Eksemplar.id == item.eksemplar_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    t = db.scalar(  # 3. tagihan dibaca ulang di bawah kunci
        select(Tagihan)
        .where(Tagihan.id == tagihan_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not _belum_lunas(t):
        raise _galat_sudah_lunas(tagihan_id)
    _periksa_masukan(t, cara, nominal, tanggal)
    if cara is CaraPenyelesaian.BUKU_PENGGANTI:
        _terima_buku_pengganti(e)
    # Tunai/Transfer: eksemplar tetap Hilang/Rusak (FR-TGH-04) — tidak disentuh.
    db.flush()
    _tandai_lunas(t, cara, nominal, tanggal, admin_id)
    db.flush()


def selesaikan(
    db: Session,
    tagihan_id: int,
    *,
    cara: CaraPenyelesaian,
    nominal: int | None,
    tanggal: date,
    admin_id: int,
) -> TagihanRinci:
    """FR-TGH-02..05 dalam satu transaksi DB; galat apa pun → rollback tanpa perubahan."""
    try:
        _selesaikan(db, tagihan_id, cara, nominal, tanggal, admin_id)
        db.commit()
    except DBAPIError as exc:
        db.rollback()
        if _PENANDA_TRIGGER not in str(getattr(exc, "orig", "")):
            raise
        raise _galat_sudah_lunas(tagihan_id) from exc  # trigger FR-TGH-06 (balapan)
    except BaseException:
        db.rollback()
        raise
    return detail(db, tagihan_id)

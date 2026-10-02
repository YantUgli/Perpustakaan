"""Eksemplar: FR-BKU-04..09, K-02.

Status hanya berubah di sini lewat satu aksi manual: Tersedia → Rusak (FR-BKU-07). Transisi lain
milik alur sirkulasi (WP 5.3.8–5.3.11). Tidak ada fungsi pemulihan Rusak → Tersedia (domain §3).
"""

from dataclasses import dataclass

from sqlalchemy import func, insert, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session, joinedload

from app.core.galat import GalatBisnis
from app.models import Eksemplar, JudulBuku, Rak
from app.models.status import LABEL_STATUS_EKSEMPLAR, StatusEksemplar

JUMLAH_MAKS_PER_PENAMBAHAN = 100
JUMLAH_MAKS_LABEL = 200
PANJANG_JUDUL_SINGKAT = 30
_SEQUENCE_HABIS = "2200H"  # SQLSTATE sequence_generator_limit_exceeded


@dataclass(frozen=True)
class RekapStok:
    total: int
    tersedia: int
    dipinjam: int
    hilang: int
    rusak: int


@dataclass(frozen=True)
class DataLabel:
    kode: str
    judul_singkat: str
    isi_qr: str


def _galat(kode: str, pesan: str, rujukan: str, status_code: int) -> GalatBisnis:
    return GalatBisnis(kode=kode, pesan=pesan, rujukan=rujukan, status_code=status_code)


def _judul(db: Session, judul_id: int) -> JudulBuku:
    j = db.get(JudulBuku, judul_id)
    if j is None:
        raise _galat("BKU_JUDUL_TIDAK_ADA", "Judul buku tidak ditemukan.", "FR-BKU-04", 404)
    return j


def _rak_wajib_ada(db: Session, rak_id: int) -> None:
    """ASUMSI(OQ-10): rak wajib untuk setiap eksemplar."""
    if db.get(Rak, rak_id) is None:
        raise _galat("BKU_RAK_TIDAK_ADA", "Rak yang dipilih tidak ditemukan.", "FR-BKU-05", 422)


def _galat_eksemplar_tidak_ada() -> GalatBisnis:
    return _galat("BKU_EKSEMPLAR_TIDAK_ADA", "Eksemplar tidak ditemukan.", "FR-BKU-05", 404)


def _muat(db: Session, eksemplar_id: int) -> Eksemplar:
    e = db.scalar(
        select(Eksemplar)
        .options(joinedload(Eksemplar.rak))
        .where(Eksemplar.id == eksemplar_id)
        .execution_options(populate_existing=True)
    )
    if e is None:
        raise _galat_eksemplar_tidak_ada()
    return e


def tambah(db: Session, *, judul_id: int, jumlah: int, rak_id: int) -> list[Eksemplar]:
    """FR-BKU-04: N eksemplar sekaligus, kode dari sequence (OQ-03), status awal Tersedia.

    Satu transaksi (NFR-REL-01): satu baris gagal (mis. kode EKS habis) → tidak ada yang tersimpan.
    """
    _judul(db, judul_id)
    if not 1 <= jumlah <= JUMLAH_MAKS_PER_PENAMBAHAN:
        raise _galat(
            "BKU_JUMLAH_EKSEMPLAR",
            f"Jumlah eksemplar per penambahan 1–{JUMLAH_MAKS_PER_PENAMBAHAN}.",
            "FR-BKU-04",
            422,
        )
    _rak_wajib_ada(db, rak_id)
    try:
        ids = db.scalars(
            insert(Eksemplar).returning(Eksemplar.id, sort_by_parameter_order=True),
            [{"judul_buku_id": judul_id, "rak_id": rak_id}] * jumlah,
        ).all()
        db.commit()
    except DBAPIError as exc:
        db.rollback()
        if getattr(exc.orig, "sqlstate", None) != _SEQUENCE_HABIS:
            raise
        raise _galat(
            "BKU_KODE_EKSEMPLAR_HABIS",
            "Kode eksemplar sudah habis (maksimal EKS-999999); "
            "tidak ada eksemplar yang ditambahkan.",
            "OQ-03",
            409,
        ) from exc
    return list(
        db.scalars(
            select(Eksemplar)
            .options(joinedload(Eksemplar.rak))
            .where(Eksemplar.id.in_(ids))
            .order_by(Eksemplar.kode)
        )
    )


def ubah_rak(db: Session, eksemplar_id: int, *, rak_id: int) -> Eksemplar:
    """FR-BKU-05. ASUMSI(OQ-21): boleh untuk status apa pun; rak adalah lokasi, bukan status."""
    e = _muat(db, eksemplar_id)
    _rak_wajib_ada(db, rak_id)
    e.rak_id = rak_id
    db.commit()
    return _muat(db, eksemplar_id)


def tandai_rusak(db: Session, eksemplar_id: int) -> Eksemplar:
    """FR-BKU-07 / K-02: Tersedia → Rusak tanpa tagihan. FR-BKU-08: Dipinjam ditolak.

    Baris dikunci `FOR UPDATE` dulu agar tidak menimpa peminjaman yang sedang berjalan (NFR-REL-02).
    """
    e = db.scalar(
        select(Eksemplar)
        .where(Eksemplar.id == eksemplar_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if e is None:
        db.rollback()
        raise _galat_eksemplar_tidak_ada()
    status = StatusEksemplar(e.status)
    if status is StatusEksemplar.DIPINJAM:
        db.rollback()
        raise _galat(
            "BKU_EKSEMPLAR_DIPINJAM",
            f"Eksemplar {e.kode} sedang Dipinjam; statusnya hanya dapat berubah melalui "
            "pengembalian atau pencatatan hilang/rusak.",
            "FR-BKU-08",
            409,
        )
    if status is not StatusEksemplar.TERSEDIA:
        db.rollback()
        raise _galat(
            "BKU_STATUS_TIDAK_SESUAI",
            f"Eksemplar {e.kode} berstatus {LABEL_STATUS_EKSEMPLAR[status]}; "
            "ubah status manual hanya dari Tersedia ke Rusak.",
            "FR-BKU-07",
            409,
        )
    e.status = StatusEksemplar.RUSAK
    db.commit()
    return _muat(db, eksemplar_id)


def stok_judul(db: Session, judul_id: int) -> tuple[RekapStok, list[Eksemplar]]:
    """FR-BKU-09: total = SEMUA eksemplar (termasuk Hilang/Rusak), beda dari Y katalog."""
    _judul(db, judul_id)
    hitung = dict(
        db.execute(
            select(Eksemplar.status, func.count())
            .where(Eksemplar.judul_buku_id == judul_id)
            .group_by(Eksemplar.status)
        ).all()
    )
    rekap = RekapStok(
        total=sum(hitung.values()),
        tersedia=hitung.get(StatusEksemplar.TERSEDIA, 0),
        dipinjam=hitung.get(StatusEksemplar.DIPINJAM, 0),
        hilang=hitung.get(StatusEksemplar.HILANG, 0),
        rusak=hitung.get(StatusEksemplar.RUSAK, 0),
    )
    data = db.scalars(
        select(Eksemplar)
        .options(joinedload(Eksemplar.rak))
        .where(Eksemplar.judul_buku_id == judul_id)
        .order_by(Eksemplar.kode)
    ).all()
    return rekap, list(data)


def judul_singkat(judul: str) -> str:
    """FR-BKU-06: maks 30 karakter termasuk "…"; potong di batas kata bila ada, selain itu keras."""
    judul = " ".join(judul.split())
    if len(judul) <= PANJANG_JUDUL_SINGKAT:
        return judul
    potong = judul[: PANJANG_JUDUL_SINGKAT - 1]
    spasi = potong.rfind(" ")
    if spasi > 0:
        potong = potong[:spasi]
    return potong.rstrip() + "…"


def data_label(db: Session, eksemplar_ids: list[int]) -> list[DataLabel]:
    """FR-BKU-06, IR-SW-02: kode, judul singkat, isi QR (= kode, teks polos), sesuai urutan id.

    Tata letak A4 & gambar QR dibuat di frontend (WP 5.4.7, IR-HW-02)."""
    if not 1 <= len(eksemplar_ids) <= JUMLAH_MAKS_LABEL:
        raise _galat(
            "BKU_JUMLAH_LABEL",
            f"Data label 1–{JUMLAH_MAKS_LABEL} eksemplar per permintaan.",
            "FR-BKU-06",
            422,
        )
    baris = {
        r.id: r
        for r in db.execute(
            select(Eksemplar.id, Eksemplar.kode, JudulBuku.judul)
            .join(JudulBuku, Eksemplar.judul_buku_id == JudulBuku.id)
            .where(Eksemplar.id.in_(set(eksemplar_ids)))
        )
    }
    hilang = sorted(set(eksemplar_ids) - baris.keys())
    if hilang:
        raise _galat(
            "BKU_EKSEMPLAR_TIDAK_ADA",
            f"Eksemplar tidak ditemukan: id {', '.join(map(str, hilang))}.",
            "FR-BKU-06",
            404,
        )
    return [
        DataLabel(
            kode=baris[i].kode, judul_singkat=judul_singkat(baris[i].judul), isi_qr=baris[i].kode
        )
        for i in eksemplar_ids
    ]

"""Peminjaman: FR-PJM-01..13, BR-07..11, BR-18, FR-DND-06, NFR-REL-01/02.

Keranjang disusun di klien (domain-rules §7): `validasi_item` memeriksa satu pindaian tanpa mengubah
data, `konfirmasi` memeriksa ulang semuanya (FR-PJM-10) dalam satu transaksi DB (NFR-REL-01).

Urutan kunci (NFR-REL-02): baris anggota dulu (dua konfirmasi untuk anggota yang sama tidak bisa
menembus batas 3), lalu baris eksemplar urut id (tidak deadlock). Lapis kedua: unique partial index
`uq_item_transaksi_pinjaman_aktif`. Tidak ada perpanjangan (FR-PJM-13).
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.format import format_rupiah
from app.core.galat import GalatBisnis
from app.core.validasi import normalisasi_kode
from app.core.waktu import hari_ini_wib
from app.models import (
    Anggota,
    Eksemplar,
    ItemTransaksi,
    JudulBuku,
    Tagihan,
    TransaksiPeminjaman,
)
from app.models.status import (
    LABEL_STATUS_EKSEMPLAR,
    StatusEksemplar,
    StatusItem,
    StatusTagihan,
    StatusTransaksi,
)
from app.services import kalkulasi

BATAS_PINJAMAN_AKTIF = 3  # BR-08


@dataclass(frozen=True)
class Alasan:
    kode: str
    pesan: str
    rujukan: str


@dataclass(frozen=True)
class Kelayakan:
    layak: bool
    alasan: list[Alasan]


@dataclass(frozen=True)
class IdentitasAnggota:
    id: int
    kode: str
    nama: str
    pinjaman_aktif: int
    kelayakan: Kelayakan


@dataclass(frozen=True)
class ItemValid:
    eksemplar_id: int
    kode: str
    judul: str


@dataclass(frozen=True)
class ItemDipinjam:
    kode_eksemplar: str
    judul: str
    tanggal_pinjam: date
    jatuh_tempo: date
    status: str


@dataclass(frozen=True)
class HasilPeminjaman:
    id: int
    anggota_kode: str
    anggota_nama: str
    tanggal_transaksi: date
    item: list[ItemDipinjam]


# --------------------------------------------------------------------------------------- galat


def _galat(kode: str, pesan: str, rujukan: str, status_code: int) -> GalatBisnis:
    return GalatBisnis(kode=kode, pesan=pesan, rujukan=rujukan, status_code=status_code)


def _galat_anggota_tidak_ada(keterangan: str) -> GalatBisnis:
    return _galat(
        "PJM_ANGGOTA_TIDAK_ADA", f"Anggota {keterangan} tidak ditemukan.", "FR-PJM-01", 404
    )


def _galat_tidak_layak(kelayakan: Kelayakan) -> GalatBisnis:
    """FR-PJM-03/04: semua alasan disebut; rujukan mengikuti alasan yang berlaku."""
    return _galat(
        "PJM_TIDAK_LAYAK",
        " ".join(a.pesan for a in kelayakan.alasan),
        ", ".join(a.rujukan for a in kelayakan.alasan),
        422,
    )


def _galat_eksemplar_tidak_ada(kode: list[str]) -> GalatBisnis:
    return _galat(
        "PJM_EKSEMPLAR_TIDAK_ADA",
        f"Eksemplar dengan kode {', '.join(kode)} tidak ditemukan.",
        "FR-PJM-05",
        404,
    )


def _galat_tidak_tersedia(kode: str, status: str) -> GalatBisnis:
    label = LABEL_STATUS_EKSEMPLAR[StatusEksemplar(status)]
    return _galat(
        "PJM_EKSEMPLAR_TIDAK_TERSEDIA",
        f"Eksemplar {kode} berstatus {label}; hanya eksemplar Tersedia yang dapat dipinjam.",
        "FR-PJM-06",
        409,
    )


def _galat_ganda(kode: str) -> GalatBisnis:
    return _galat(
        "PJM_EKSEMPLAR_GANDA", f"Eksemplar {kode} sudah ada di transaksi ini.", "FR-PJM-07", 409
    )


def _galat_melebihi_batas(aktif: int, di_transaksi: int) -> GalatBisnis:
    return _galat(
        "PJM_ITEM_MELEBIHI_BATAS",
        f"Batas pinjaman {BATAS_PINJAMAN_AKTIF} eksemplar terlampaui: anggota sedang meminjam "
        f"{aktif} eksemplar dan {di_transaksi} eksemplar ada di transaksi ini.",
        "FR-PJM-08",
        422,
    )


# --------------------------------------------------------------------------------------- kelayakan


def jumlah_pinjaman_aktif(db: Session, anggota_id: int) -> int:
    """FR-PJM-02/08: item Dipinjam milik anggota, termasuk yang terlambat; Hilang/Rusak tidak."""
    return db.scalar(
        select(func.count(ItemTransaksi.id))
        .join(TransaksiPeminjaman, ItemTransaksi.transaksi_id == TransaksiPeminjaman.id)
        .where(
            TransaksiPeminjaman.anggota_id == anggota_id,
            ItemTransaksi.status == StatusItem.DIPINJAM,
        )
    )


def _tagihan_belum_lunas(db: Session, anggota_id: int) -> tuple[int, int]:
    jumlah, total = db.execute(
        select(func.count(Tagihan.id), func.coalesce(func.sum(Tagihan.nominal), 0))
        .join(ItemTransaksi, Tagihan.item_transaksi_id == ItemTransaksi.id)
        .join(TransaksiPeminjaman, ItemTransaksi.transaksi_id == TransaksiPeminjaman.id)
        .where(
            TransaksiPeminjaman.anggota_id == anggota_id,
            Tagihan.status == StatusTagihan.BELUM_LUNAS,
        )
    ).one()
    return jumlah, int(total)


def _item_terlambat(db: Session, anggota_id: int, hari_ini: date) -> list[tuple[str, int]]:
    """FR-PJM-04: dihitung dari item (denda baru jadi tagihan saat kembali), bukan dari tagihan.

    `hari_ini` dikirim sebagai parameter (K-07), bukan CURRENT_DATE basis data."""
    baris = db.execute(
        select(JudulBuku.judul, ItemTransaksi.status, ItemTransaksi.jatuh_tempo)
        .join(TransaksiPeminjaman, ItemTransaksi.transaksi_id == TransaksiPeminjaman.id)
        .join(Eksemplar, ItemTransaksi.eksemplar_id == Eksemplar.id)
        .join(JudulBuku, Eksemplar.judul_buku_id == JudulBuku.id)
        .where(
            TransaksiPeminjaman.anggota_id == anggota_id,
            ItemTransaksi.status == StatusItem.DIPINJAM,
            ItemTransaksi.jatuh_tempo < hari_ini,
        )
        .order_by(ItemTransaksi.jatuh_tempo, ItemTransaksi.id)
    ).all()
    return [
        (judul, kalkulasi.hitung_hari_terlambat(jatuh_tempo, hari_ini))
        for judul, status, jatuh_tempo in baris
        if kalkulasi.is_terlambat(StatusItem(status), jatuh_tempo, hari_ini)
    ]


def kelayakan_anggota(db: Session, anggota_id: int) -> Kelayakan:
    """BR-18, FR-PJM-03/04: selalu dihitung, tanpa flag tersimpan. FR-DND-06: terlambat setelah
    plafon tetap memblokir. Dipakai ulang area anggota (WP 5.3.12)."""
    alasan = []
    jumlah, total = _tagihan_belum_lunas(db, anggota_id)
    if jumlah:
        alasan.append(
            Alasan(
                "PJM_ADA_TAGIHAN",
                f"Anggota memiliki {jumlah} tagihan Belum Lunas dengan total "
                f"{format_rupiah(total)}.",
                "FR-PJM-03",
            )
        )
    terlambat = _item_terlambat(db, anggota_id, hari_ini_wib())
    if terlambat:
        daftar = ", ".join(f"'{judul}' terlambat {hari} hari" for judul, hari in terlambat)
        alasan.append(
            Alasan(
                "PJM_ADA_TERLAMBAT",
                f"Anggota memiliki buku terlambat yang belum dikembalikan: {daftar}.",
                "FR-PJM-04",
            )
        )
    return Kelayakan(layak=not alasan, alasan=alasan)


# ------------------------------------------------------------------------------- identifikasi


def identifikasi_anggota(db: Session, kode: str) -> IdentitasAnggota:
    """FR-PJM-01/02: kode dari QR anggota (isi QR = ID anggota) atau diketik."""
    kode = normalisasi_kode(kode)
    a = db.scalar(select(Anggota).where(Anggota.kode == kode))
    if a is None:
        raise _galat_anggota_tidak_ada(f"dengan ID {kode}")
    return IdentitasAnggota(
        id=a.id,
        kode=a.kode,
        nama=a.nama,
        pinjaman_aktif=jumlah_pinjaman_aktif(db, a.id),
        kelayakan=kelayakan_anggota(db, a.id),
    )


def _anggota(db: Session, anggota_id: int, *, kunci: bool = False) -> Anggota:
    q = select(Anggota).where(Anggota.id == anggota_id)
    if kunci:
        q = q.with_for_update().execution_options(populate_existing=True)
    a = db.scalar(q)
    if a is None:
        raise _galat_anggota_tidak_ada(f"dengan id {anggota_id}")
    return a


# -------------------------------------------------------------------------------- pindai item


def validasi_item(
    db: Session, *, anggota_id: int, kode_eksemplar: str, keranjang: list[str]
) -> ItemValid:
    """FR-PJM-05..08: periksa satu pindaian terhadap keranjang klien. Tidak mengubah data."""
    _anggota(db, anggota_id)
    kelayakan = kelayakan_anggota(db, anggota_id)
    if not kelayakan.layak:
        raise _galat_tidak_layak(kelayakan)

    kode = normalisasi_kode(kode_eksemplar)
    isi_keranjang = {normalisasi_kode(k) for k in keranjang}
    if kode in isi_keranjang:
        raise _galat_ganda(kode)

    baris = db.execute(
        select(Eksemplar.id, Eksemplar.status, JudulBuku.judul)
        .join(JudulBuku, Eksemplar.judul_buku_id == JudulBuku.id)
        .where(Eksemplar.kode == kode)
    ).one_or_none()
    if baris is None:
        raise _galat_eksemplar_tidak_ada([kode])
    if baris.status != StatusEksemplar.TERSEDIA:
        raise _galat_tidak_tersedia(kode, baris.status)

    aktif = jumlah_pinjaman_aktif(db, anggota_id)
    if aktif + len(isi_keranjang) + 1 > BATAS_PINJAMAN_AKTIF:
        raise _galat_melebihi_batas(aktif, len(isi_keranjang) + 1)
    return ItemValid(eksemplar_id=baris.id, kode=kode, judul=baris.judul)


# --------------------------------------------------------------------------------------- konfirmasi


def _pinjamkan(
    db: Session, transaksi_id: int, eksemplar: Eksemplar, hari_ini: date, jatuh_tempo: date
) -> ItemTransaksi:
    """FR-PJM-11/12: satu item Dipinjam + eksemplar Dipinjam. Flush agar index unik ikut menjaga."""
    item = ItemTransaksi(
        transaksi_id=transaksi_id,
        eksemplar_id=eksemplar.id,
        tanggal_pinjam=hari_ini,
        jatuh_tempo=jatuh_tempo,
        status=StatusItem.DIPINJAM,
    )
    eksemplar.status = StatusEksemplar.DIPINJAM
    db.add(item)
    db.flush()
    return item


def _galat_balapan(db: Session, kode: list[str]) -> GalatBisnis:
    """Index unik menolak (lapis DB NFR-REL-02): sebutkan eksemplar yang kini tidak Tersedia."""
    baris = db.execute(
        select(Eksemplar.kode, Eksemplar.status)
        .where(Eksemplar.kode.in_(kode), Eksemplar.status != StatusEksemplar.TERSEDIA)
        .order_by(Eksemplar.kode)
    ).first()
    if baris is None:
        return _galat_tidak_tersedia(kode[0], StatusEksemplar.DIPINJAM)
    return _galat_tidak_tersedia(baris.kode, baris.status)


def konfirmasi(
    db: Session, *, anggota_id: int, kode_eksemplar: list[str], admin_id: int
) -> HasilPeminjaman:
    """FR-PJM-10..12: periksa ulang kelayakan, batas, dan status, lalu simpan dengan admin pemroses.

    Satu transaksi DB (NFR-REL-01): galat apa pun → rollback, tidak ada perubahan tersimpan.
    """
    kode = [normalisasi_kode(k) for k in kode_eksemplar]
    if not kode:
        raise _galat(
            "PJM_KERANJANG_KOSONG",
            "Belum ada eksemplar di transaksi ini; pindai minimal satu eksemplar.",
            "FR-PJM-10",
            422,
        )
    terlihat: set[str] = set()
    for k in kode:
        if k in terlihat:
            raise _galat_ganda(k)
        terlihat.add(k)

    try:
        anggota = _anggota(db, anggota_id, kunci=True)
        kelayakan = kelayakan_anggota(db, anggota_id)
        if not kelayakan.layak:
            raise _galat_tidak_layak(kelayakan)
        aktif = jumlah_pinjaman_aktif(db, anggota_id)
        if aktif + len(kode) > BATAS_PINJAMAN_AKTIF:
            raise _galat_melebihi_batas(aktif, len(kode))

        per_kode = {
            e.kode: e
            for e in db.scalars(
                select(Eksemplar)
                .where(Eksemplar.kode.in_(kode))
                .order_by(Eksemplar.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        }
        hilang = [k for k in kode if k not in per_kode]
        if hilang:
            raise _galat_eksemplar_tidak_ada(hilang)
        for k in kode:
            if per_kode[k].status != StatusEksemplar.TERSEDIA:
                raise _galat_tidak_tersedia(k, per_kode[k].status)
        judul = dict(
            db.execute(
                select(JudulBuku.id, JudulBuku.judul).where(
                    JudulBuku.id.in_({e.judul_buku_id for e in per_kode.values()})
                )
            ).all()
        )

        hari_ini = hari_ini_wib()  # K-07
        jatuh_tempo = kalkulasi.hitung_jatuh_tempo(hari_ini)  # FR-PJM-11
        trx = TransaksiPeminjaman(
            anggota_id=anggota.id,
            admin_id=admin_id,  # FR-PJM-10: admin pemroses dari sesi
            tanggal_transaksi=hari_ini,
            status=StatusTransaksi.AKTIF,
        )
        db.add(trx)
        db.flush()
        for k in kode:
            _pinjamkan(db, trx.id, per_kode[k], hari_ini, jatuh_tempo)
        hasil = HasilPeminjaman(
            id=trx.id,
            anggota_kode=anggota.kode,
            anggota_nama=anggota.nama,
            tanggal_transaksi=hari_ini,
            item=[
                ItemDipinjam(
                    kode_eksemplar=k,
                    judul=judul[per_kode[k].judul_buku_id],
                    tanggal_pinjam=hari_ini,
                    jatuh_tempo=jatuh_tempo,
                    status=StatusItem.DIPINJAM,
                )
                for k in kode
            ],
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        diag = getattr(exc.orig, "diag", None)
        if getattr(diag, "constraint_name", None) != "uq_item_transaksi_pinjaman_aktif":
            raise
        raise _galat_balapan(db, kode) from exc
    except BaseException:
        db.rollback()
        raise
    return hasil

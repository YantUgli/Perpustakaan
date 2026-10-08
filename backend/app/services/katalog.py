"""Katalog publik & pencarian: FR-KTL-01..04, BR-01, NFR-PRF-01, OQ-44 (filter & urutan).

Fungsi `cari_judul` sengaja tidak bergantung pada siapa pemanggilnya agar bisa dipakai ulang
halaman admin tanpa logika pencarian kedua. Data per eksemplar (kode, status per salinan) dan data
peminjam tidak pernah keluar dari sini; yang keluar hanya agregat dan daftar rak.
"""

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import ColumnElement, false, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.galat import GalatBisnis
from app.core.validasi import normalisasi_isbn
from app.models import Eksemplar, JudulBuku, Kategori, Rak
from app.models.status import StatusEksemplar
from app.services import berkas

# FR-KTL-03: Y tidak menghitung eksemplar Hilang atau Rusak.
_DI_LUAR_Y = (StatusEksemplar.HILANG, StatusEksemplar.RUSAK)


@dataclass(frozen=True)
class RakKatalog:
    kode: str
    lokasi: str | None


@dataclass(frozen=True)
class JudulKatalog:
    judul: JudulBuku  # kategori sudah dimuat
    tersedia: int  # X
    total: int  # Y
    rak: list[RakKatalog]


def _galat_tidak_ada(kode: str, pesan: str, rujukan: str) -> GalatBisnis:
    return GalatBisnis(kode=kode, pesan=pesan, rujukan=rujukan, status_code=404)


def _escape_like(teks: str) -> str:
    return teks.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _pola(teks: str) -> str:
    return f"%{_escape_like(teks)}%"


def filter_kata_kunci(q: str | None) -> ColumnElement[bool] | None:
    """FR-KTL-02. ASUMSI(OQ-24): satu frasa substring, tak peka huruf, ke judul/penulis/ISBN/
    kategori digabung OR. Wildcard di-escape. Kata kunci kosong → tanpa filter.

    Dipakai dua endpoint: katalog publik (`cari_judul`) dan daftar judul admin
    (`koleksi.daftar_judul`, OQ-45). Mengubah aturan OQ-24 di sini berdampak ke keduanya."""
    q = (q or "").strip()
    if not q:
        return None
    pola = _pola(q)
    kondisi = [
        JudulBuku.judul.ilike(pola, escape="\\"),
        JudulBuku.penulis.ilike(pola, escape="\\"),
        JudulBuku.kategori_id.in_(
            select(Kategori.id).where(Kategori.nama.ilike(pola, escape="\\"))
        ),
    ]
    # ASUMSI(OQ-13): ISBN dicocokkan pada bentuk ternormalisasi. Bila normalisasi menghasilkan
    # string kosong (mis. "-"), kondisi ISBN dilewati agar tidak menjadi ILIKE '%%' (OQ-24).
    isbn = normalisasi_isbn(q)
    if isbn:
        kondisi.append(JudulBuku.isbn_normal.ilike(_pola(isbn), escape="\\"))
    return or_(*kondisi)


def _lengkapi(db: Session, daftar: list[JudulBuku]) -> list[JudulKatalog]:
    """Tambahkan X, Y (FR-KTL-03) dan rak (OQ-22) untuk judul-judul di satu halaman."""
    ids = [j.id for j in daftar]
    if not ids:
        return []
    stok = {
        jid: (tersedia, total)
        for jid, tersedia, total in db.execute(
            select(
                Eksemplar.judul_buku_id,
                func.count().filter(Eksemplar.status == StatusEksemplar.TERSEDIA),
                func.count().filter(Eksemplar.status.not_in(_DI_LUAR_Y)),
            )
            .where(Eksemplar.judul_buku_id.in_(ids))
            .group_by(Eksemplar.judul_buku_id)
        )
    }
    # ASUMSI(OQ-22): rak unik dari eksemplar yang dihitung di Y (Tersedia atau Dipinjam).
    rak: dict[int, list[RakKatalog]] = {jid: [] for jid in ids}
    for jid, kode, lokasi in db.execute(
        select(Eksemplar.judul_buku_id, Rak.kode, Rak.lokasi)
        .join(Rak, Eksemplar.rak_id == Rak.id)
        .where(Eksemplar.judul_buku_id.in_(ids), Eksemplar.status.not_in(_DI_LUAR_Y))
        .group_by(Eksemplar.judul_buku_id, Rak.id, Rak.kode, Rak.lokasi)
        .order_by(Eksemplar.judul_buku_id, func.lower(Rak.kode), Rak.id)
    ):
        rak[jid].append(RakKatalog(kode=kode, lokasi=lokasi))
    # ASUMSI(OQ-23): judul tanpa eksemplar (atau semuanya Hilang/Rusak) tetap tampil, 0 dari 0.
    hasil = []
    for j in daftar:
        tersedia, total = stok.get(j.id, (0, 0))
        hasil.append(JudulKatalog(judul=j, tersedia=tersedia, total=total, rak=rak[j.id]))
    return hasil


Urutan = Literal["judul_az", "tahun_terbaru", "tahun_terlama"]

# Rentang kolom PostgreSQL: `tahun` INTEGER, `kategori_id` BIGINT. Nilai di luarnya tidak dikirim
# sebagai parameter (PostgreSQL menolak "out of range" → 500); artinya pasti: tak ada baris cocok.
_INT4_MAKS = 2**31 - 1
_INT8_MIN, _INT8_MAKS = -(2**63), 2**63 - 1

# ASUMSI(OQ-44): seri selalu dipecah lower(judul) lalu id agar paginasi stabil.
_URUTAN: dict[str, tuple] = {
    "judul_az": (func.lower(JudulBuku.judul), JudulBuku.id),
    "tahun_terbaru": (JudulBuku.tahun.desc(), func.lower(JudulBuku.judul), JudulBuku.id),
    "tahun_terlama": (JudulBuku.tahun.asc(), func.lower(JudulBuku.judul), JudulBuku.id),
}


def periksa_rentang_tahun(tahun_dari: int | None, tahun_sampai: int | None) -> None:
    """ASUMSI(OQ-44, pola OQ-38): kedua batas opsional & inklusif; `dari > sampai` ditolak."""
    if tahun_dari is not None and tahun_sampai is not None and tahun_dari > tahun_sampai:
        raise GalatBisnis(
            kode="KTL_RENTANG_TAHUN_TIDAK_VALID",
            pesan=f"Rentang tahun tidak valid: tahun awal {tahun_dari} "
            f"setelah tahun akhir {tahun_sampai}.",
            rujukan="OQ-44",
            status_code=422,
        )


def _filter(
    q: str | None,
    kategori_id: list[int] | None,
    tersedia: bool,
    tahun_dari: int | None,
    tahun_sampai: int | None,
) -> list[ColumnElement[bool]]:
    """FR-KTL-02 + ASUMSI(OQ-44): semua syarat digabung AND dengan kata kunci `q` (OQ-24)."""
    kondisi = [k for k in [filter_kata_kunci(q)] if k is not None]
    if kategori_id is not None:
        # Id tak dikenal (termasuk di luar rentang BIGINT) → tidak ada yang cocok → daftar kosong
        # (decisions §B). `in_([])` dirender SQLAlchemy sebagai kondisi yang selalu salah.
        sah = [k for k in kategori_id if _INT8_MIN <= k <= _INT8_MAKS]
        kondisi.append(JudulBuku.kategori_id.in_(sah))
    if tersedia:
        kondisi.append(
            select(Eksemplar.id)
            .where(
                Eksemplar.judul_buku_id == JudulBuku.id,
                Eksemplar.status == StatusEksemplar.TERSEDIA,
            )
            .exists()
        )
    # Tanpa batas atas tahun (OQ-10): tahun > INT4 maksimum tetap 200. `tahun_dari` di atasnya tak
    # mungkin terpenuhi; `tahun_sampai` di atasnya tidak membatasi apa pun.
    if tahun_dari is not None:
        kondisi.append(JudulBuku.tahun >= tahun_dari if tahun_dari <= _INT4_MAKS else false())
    if tahun_sampai is not None and tahun_sampai <= _INT4_MAKS:
        kondisi.append(JudulBuku.tahun <= tahun_sampai)
    return kondisi


def cari_judul(
    db: Session,
    *,
    q: str | None,
    halaman: int,
    per_halaman: int,
    kategori_id: list[int] | None = None,
    tersedia: bool = False,
    tahun_dari: int | None = None,
    tahun_sampai: int | None = None,
    urut: Urutan = "judul_az",
) -> tuple[list[JudulKatalog], int]:
    """FR-KTL-01/02/04: daftar judul berhalaman, bawaan urut judul A–Z lalu id.

    ASUMSI(OQ-44): filter kategori (salah satu dari daftar), `tersedia` (≥ 1 eksemplar Tersedia),
    rentang tahun terbit inklusif, dan urutan tahun terbit; tanpa parameter tambahan perilaku sama
    dengan sebelumnya. `total` dihitung dari kondisi yang sama dengan data.
    """
    periksa_rentang_tahun(tahun_dari, tahun_sampai)
    kondisi = _filter(q, kategori_id, tersedia, tahun_dari, tahun_sampai)
    total = db.scalar(select(func.count()).select_from(JudulBuku).where(*kondisi))
    q_data = (
        select(JudulBuku)
        .options(joinedload(JudulBuku.kategori))
        .where(*kondisi)
        .order_by(*_URUTAN[urut])
        .offset((halaman - 1) * per_halaman)
        .limit(per_halaman)
    )
    return _lengkapi(db, list(db.scalars(q_data))), total


def _judul(db: Session, judul_id: int) -> JudulBuku:
    j = db.get(JudulBuku, judul_id, options=[joinedload(JudulBuku.kategori)])
    if j is None:
        raise _galat_tidak_ada("KTL_JUDUL_TIDAK_ADA", "Judul buku tidak ditemukan.", "FR-KTL-03")
    return j


def detail_judul(db: Session, judul_id: int) -> JudulKatalog:
    """FR-KTL-03: detail dengan ketersediaan "X dari Y"."""
    return _lengkapi(db, [_judul(db, judul_id)])[0]


def cover_judul(db: Session, judul_id: int) -> berkas.BerkasTersimpan:
    """Cover publik: hanya `cover_path` milik judul ini dari DB, tak pernah path dari klien."""
    j = db.get(JudulBuku, judul_id)
    tersimpan = berkas.berkas_tersimpan(j.cover_path if j else None)
    if tersimpan is None:
        raise _galat_tidak_ada(
            "KTL_COVER_TIDAK_ADA", "Cover untuk judul ini tidak tersedia.", "FR-KTL-01"
        )
    return tersimpan

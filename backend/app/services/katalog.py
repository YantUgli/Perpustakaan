"""Katalog publik & pencarian: FR-KTL-01..04, BR-01, NFR-PRF-01.

Fungsi `cari_judul` sengaja tidak bergantung pada siapa pemanggilnya agar bisa dipakai ulang
halaman admin tanpa logika pencarian kedua. Data per eksemplar (kode, status per salinan) dan data
peminjam tidak pernah keluar dari sini; yang keluar hanya agregat dan daftar rak.
"""

from dataclasses import dataclass

from sqlalchemy import ColumnElement, func, or_, select
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
    kategori digabung OR. Wildcard di-escape. Kata kunci kosong → tanpa filter."""
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


def cari_judul(
    db: Session, *, q: str | None, halaman: int, per_halaman: int
) -> tuple[list[JudulKatalog], int]:
    """FR-KTL-01/02/04: daftar judul berhalaman, urut judul A–Z lalu id."""
    kondisi = filter_kata_kunci(q)
    q_total = select(func.count()).select_from(JudulBuku)
    q_data = (
        select(JudulBuku)
        .options(joinedload(JudulBuku.kategori))
        .order_by(func.lower(JudulBuku.judul), JudulBuku.id)
        .offset((halaman - 1) * per_halaman)
        .limit(per_halaman)
    )
    if kondisi is not None:
        q_total, q_data = q_total.where(kondisi), q_data.where(kondisi)
    total = db.scalar(q_total)
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

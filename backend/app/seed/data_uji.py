"""Data uji (kategori, rak, judul, eksemplar) untuk dev/staging.

ASUMSI(OQ-15): ditolak bila APP_ENV=production.

Data deterministik (random seed tetap) dan idempoten: kategori/rak dikenali dari nama/kode,
judul dari ISBN. Eksemplar hanya dibuat untuk judul yang baru dibuat pada pemanggilan itu.

Status eksemplar hanya TERSEDIA atau RUSAK. RUSAK di sini = ubah status manual dari luar
transaksi (FR-BKU-07): tanpa item transaksi dan tanpa tagihan. DIPINJAM/HILANG butuh item
transaksi, jadi tidak dibuat di seed.
"""

import random
from dataclasses import dataclass

from sqlalchemy import func, insert, select
from sqlalchemy.orm import Session

from app.models import Eksemplar, JudulBuku, Kategori, Rak
from app.models.status import StatusEksemplar
from app.seed.admin import GalatSeed

KATEGORI = ["Fiksi", "Nonfiksi", "Sains", "Sejarah", "Agama", "Anak", "Komputer", "Referensi"]
RAK = [
    (f"{lorong}-{no:02d}", f"Lantai 1, Lorong {lorong}") for lorong in "AB" for no in range(1, 6)
]

_KATA_A = ["Jejak", "Cahaya", "Rahasia", "Kisah", "Pengantar", "Dasar-Dasar", "Sejarah", "Panduan"]
_KATA_B = ["Nusantara", "Samudra", "Algoritma", "Ekonomi", "Fisika", "Kehidupan", "Bahasa", "Kota"]
_KATA_C = ["", " Modern", " untuk Pemula", " Jilid 1", " Jilid 2", " Edisi Revisi"]
_NAMA_DEPAN = ["Andi", "Sri", "Budi", "Dewi", "Rahmat", "Putri", "Agus", "Wulan", "Hendra", "Nur"]
_NAMA_BELAKANG = ["Pratama", "Lestari", "Santoso", "Wibowo", "Hidayat", "Siregar", "Nasution"]
_PENERBIT = ["Penerbit Uji Satu", "Pustaka Contoh", "Gramedia Uji", "Balai Uji", "Mizan Contoh"]
# OQ-01: harga yang membuat 10% × harga tidak bulat
_HARGA_TIDAK_BULAT = [15_555, 47_250, 99_999, 33_333]

# Prefiks ISBN terpisah agar data uji dan data performa tidak pernah bertabrakan.
_PREFIKS_DATA_UJI = "9786020"
_PREFIKS_PERFORMA = "9786021"
_PROPORSI_RUSAK = 0.05


@dataclass(frozen=True)
class RingkasanSeed:
    """Jumlah baris yang **baru** dibuat pada pemanggilan ini."""

    kategori: int
    rak: int
    judul: int
    eksemplar: int


def _tolak_di_produksi(app_env: str) -> None:
    if app_env == "production":
        raise GalatSeed("Data uji tidak boleh dibuat saat APP_ENV=production (OQ-15).")


def isbn13(dua_belas_digit: str) -> str:
    """ISBN-13 dengan digit periksa yang valid."""
    total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(dua_belas_digit))
    return dua_belas_digit + str((10 - total % 10) % 10)


def _pastikan_master(db: Session) -> tuple[list[int], list[int], int, int]:
    """Get-or-create kategori & rak data uji. Mengembalikan id dan jumlah yang baru dibuat."""
    kategori_baru = rak_baru = 0
    kategori_id = []
    for nama in KATEGORI:
        kid = db.scalar(
            select(Kategori.id).where(func.lower(func.trim(Kategori.nama)) == nama.lower())
        )
        if kid is None:
            kid = db.scalar(insert(Kategori).values(nama=nama).returning(Kategori.id))
            kategori_baru += 1
        kategori_id.append(kid)
    rak_id = []
    for kode, lokasi in RAK:
        rid = db.scalar(select(Rak.id).where(func.lower(func.trim(Rak.kode)) == kode.lower()))
        if rid is None:
            rid = db.scalar(insert(Rak).values(kode=kode, lokasi=lokasi).returning(Rak.id))
            rak_baru += 1
        rak_id.append(rid)
    return kategori_id, rak_id, kategori_baru, rak_baru


def _buat_buku(
    db: Session,
    *,
    prefiks: str,
    jumlah_judul: int,
    eksemplar_per_judul: tuple[int, int],
    random_seed: int,
) -> RingkasanSeed:
    kategori_id, rak_id, kategori_baru, rak_baru = _pastikan_master(db)
    rng = random.Random(random_seed)  # noqa: S311 — data uji, bukan kriptografi

    rencana = []
    for i in range(jumlah_judul):
        harga = (
            _HARGA_TIDAK_BULAT[i // 10 % len(_HARGA_TIDAK_BULAT)]
            if i % 10 == 0
            else rng.randrange(25_000, 250_001, 5_000)
        )
        rencana.append(
            {
                "isbn": isbn13(f"{prefiks}{i:05d}"),
                "judul": f"{rng.choice(_KATA_A)} {rng.choice(_KATA_B)}{rng.choice(_KATA_C)}",
                "penulis": f"{rng.choice(_NAMA_DEPAN)} {rng.choice(_NAMA_BELAKANG)}",
                "penerbit": rng.choice(_PENERBIT),
                "tahun": rng.randint(1980, 2025),
                "kategori_id": rng.choice(kategori_id),
                "harga": harga,
                "_eksemplar": [
                    (
                        rng.choice(rak_id),
                        StatusEksemplar.RUSAK
                        if rng.random() < _PROPORSI_RUSAK
                        else StatusEksemplar.TERSEDIA,
                    )
                    for _ in range(rng.randint(*eksemplar_per_judul))
                ],
            }
        )

    sudah_ada = set(
        db.scalars(select(JudulBuku.isbn).where(JudulBuku.isbn.in_([r["isbn"] for r in rencana])))
    )
    baru = [r for r in rencana if r["isbn"] not in sudah_ada]
    if not baru:
        return RingkasanSeed(kategori_baru, rak_baru, 0, 0)

    baris_judul = [{k: v for k, v in r.items() if not k.startswith("_")} for r in baru]
    id_per_isbn = {
        isbn: jid
        for jid, isbn in db.execute(
            insert(JudulBuku).returning(JudulBuku.id, JudulBuku.isbn), baris_judul
        )
    }
    baris_eksemplar = [
        {"judul_buku_id": id_per_isbn[r["isbn"]], "rak_id": rid, "status": status.value}
        for r in baru
        for rid, status in r["_eksemplar"]
    ]
    db.execute(insert(Eksemplar), baris_eksemplar)
    db.flush()
    return RingkasanSeed(kategori_baru, rak_baru, len(baru), len(baris_eksemplar))


def seed_data_uji(db: Session, *, app_env: str) -> RingkasanSeed:
    """Data uji kecil (±60 judul, ±200 eksemplar) untuk pengembangan dan demo."""
    _tolak_di_produksi(app_env)
    return _buat_buku(
        db,
        prefiks=_PREFIKS_DATA_UJI,
        jumlah_judul=60,
        eksemplar_per_judul=(1, 6),
        random_seed=5221,
    )


def seed_performa(
    db: Session, *, app_env: str, jumlah_judul: int = 2_000, eksemplar_per_judul: int = 5
) -> RingkasanSeed:
    """Data uji NFR-PRF-01: bawaan 2.000 judul × 5 = 10.000 eksemplar. Idempoten per ISBN."""
    _tolak_di_produksi(app_env)
    return _buat_buku(
        db,
        prefiks=_PREFIKS_PERFORMA,
        jumlah_judul=jumlah_judul,
        eksemplar_per_judul=(eksemplar_per_judul, eksemplar_per_judul),
        random_seed=5222,
    )

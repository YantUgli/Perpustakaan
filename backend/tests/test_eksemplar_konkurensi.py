"""FR-BKU-08 + NFR-REL-02: rusak manual vs peminjaman yang berjalan bersamaan.

Memakai koneksi terpisah dengan data yang benar-benar di-commit (fixture `db` biasa tidak bisa,
karena isinya tak terlihat oleh koneksi lain). Data selalu dibersihkan di teardown.
"""

import threading
import time
from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, delete, text
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.models import Eksemplar, JudulBuku, Kategori, Rak
from app.services import eksemplar as layanan

TAHAN_DETIK = 1.0


@pytest.fixture
def eksemplar_tercommit(engine: Engine) -> Iterator[int]:
    with Session(engine) as s:
        k = Kategori(nama=f"Konkurensi {time.time_ns()}")
        r = Rak(kode=f"KONK-{time.time_ns()}")
        s.add_all([k, r])
        s.flush()
        j = JudulBuku(
            isbn=f"978{time.time_ns() % 10**10:010d}",
            judul="Uji Konkurensi",
            penulis="x",
            penerbit="x",
            tahun=2020,
            kategori_id=k.id,
            harga=50_000,
        )
        s.add(j)
        s.flush()
        e = Eksemplar(judul_buku_id=j.id, rak_id=r.id)
        s.add(e)
        s.commit()
        ids = (e.id, j.id, k.id, r.id)
    try:
        yield ids[0]
    finally:
        with Session(engine) as s:
            s.execute(delete(Eksemplar).where(Eksemplar.id == ids[0]))
            s.execute(delete(JudulBuku).where(JudulBuku.id == ids[1]))
            s.execute(delete(Kategori).where(Kategori.id == ids[2]))
            s.execute(delete(Rak).where(Rak.id == ids[3]))
            s.commit()


def test_FR_BKU_08_konkurensi_peminjaman_berjalan_rusak_manual_menunggu_lalu_ditolak(
    engine: Engine, eksemplar_tercommit: int
):
    terkunci = threading.Event()
    galat_a: list[BaseException] = []

    def peminjaman_a() -> None:
        """Meniru konfirmasi peminjaman (WP 5.3.8): kunci baris, ubah ke Dipinjam, tahan, commit."""
        try:
            with engine.connect() as k, k.begin():
                k.execute(
                    text("SELECT id FROM eksemplar WHERE id = :id FOR UPDATE"),
                    {"id": eksemplar_tercommit},
                )
                k.execute(
                    text("UPDATE eksemplar SET status = 'DIPINJAM' WHERE id = :id"),
                    {"id": eksemplar_tercommit},
                )
                terkunci.set()
                time.sleep(TAHAN_DETIK)
        except BaseException as exc:  # noqa: BLE001 — dilaporkan ke thread utama
            galat_a.append(exc)
            terkunci.set()

    a = threading.Thread(target=peminjaman_a, daemon=True)
    a.start()
    assert terkunci.wait(timeout=5), "transaksi A tidak sempat mengunci"

    with Session(engine) as sesi_b:
        # Syarat: bila regresi membuat B menunggu selamanya, test gagal (bukan pytest macet).
        sesi_b.execute(text("SET lock_timeout = '5s'"))
        mulai = time.monotonic()
        with pytest.raises(GalatBisnis) as info:
            layanan.tandai_rusak(sesi_b, eksemplar_tercommit)
        menunggu = time.monotonic() - mulai

    a.join(timeout=10)
    assert not a.is_alive() and not galat_a, galat_a
    assert info.value.kode == "BKU_EKSEMPLAR_DIPINJAM"
    assert menunggu >= TAHAN_DETIK * 0.8, "B tidak menunggu lock A (FOR UPDATE hilang?)"
    with engine.connect() as k:
        status = k.execute(
            text("SELECT status FROM eksemplar WHERE id = :id"), {"id": eksemplar_tercommit}
        ).scalar_one()
    assert status == "DIPINJAM"  # tidak tertimpa menjadi Rusak

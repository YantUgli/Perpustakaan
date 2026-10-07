"""NFR-REL-02 + FR-PJM-08: konfirmasi peminjaman yang berjalan bersamaan.

Koneksi terpisah dengan data yang benar-benar di-commit (fixture `db` biasa tidak terlihat oleh
koneksi lain). Data selalu dibersihkan di teardown.
"""

import threading
import time
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date

import pytest
from sqlalchemy import Engine, delete, select, text
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.models import (
    Admin,
    Anggota,
    Eksemplar,
    ItemTransaksi,
    JudulBuku,
    Kategori,
    Rak,
    TransaksiPeminjaman,
)
from app.services import peminjaman

TAHAN_DETIK = 1.0


@dataclass
class Data:
    admin_id: int
    anggota_id: list[int]
    eksemplar_kode: list[str]
    eksemplar_id: list[int]


@pytest.fixture
def data_tercommit(engine: Engine) -> Iterator[Data]:
    n = time.time_ns()
    with Session(engine) as s:
        k = Kategori(nama=f"Konkurensi PJM {n}")
        r = Rak(kode=f"KPJM-{n}")
        adm = Admin(nama="Admin Konkurensi", email=f"konk{n}@perpus.example", password_hash="x")
        s.add_all([k, r, adm])
        s.flush()
        j = JudulBuku(
            isbn=f"979{n % 10**10:010d}",
            judul="Uji Konkurensi Pinjam",
            penulis="x",
            penerbit="x",
            tahun=2020,
            kategori_id=k.id,
            harga=50_000,
        )
        agt = [
            Anggota(
                nama=f"Anggota Konkurensi {i}",
                alamat="x",
                email=f"agtkonk{n}{i}@perpus.example",
                telepon="0812",
                nik=f"{(n + i) % 10**16:016d}",
                password_hash="x",
                tanggal_daftar=date(2026, 10, 1),
            )
            for i in range(2)
        ]
        s.add_all([j, *agt])
        s.flush()
        eks = [Eksemplar(judul_buku_id=j.id, rak_id=r.id) for _ in range(4)]
        s.add_all(eks)
        s.commit()
        data = Data(
            admin_id=adm.id,
            anggota_id=[a.id for a in agt],
            eksemplar_kode=[e.kode for e in eks],
            eksemplar_id=[e.id for e in eks],
        )
        ids = (j.id, k.id, r.id, adm.id)
    try:
        yield data
    finally:
        with Session(engine) as s:
            trx = select(TransaksiPeminjaman.id).where(
                TransaksiPeminjaman.anggota_id.in_(data.anggota_id)
            )
            s.execute(delete(ItemTransaksi).where(ItemTransaksi.transaksi_id.in_(trx)))
            s.execute(
                delete(TransaksiPeminjaman).where(
                    TransaksiPeminjaman.anggota_id.in_(data.anggota_id)
                )
            )
            s.execute(delete(Eksemplar).where(Eksemplar.id.in_(data.eksemplar_id)))
            s.execute(delete(Anggota).where(Anggota.id.in_(data.anggota_id)))
            s.execute(delete(JudulBuku).where(JudulBuku.id == ids[0]))
            s.execute(delete(Kategori).where(Kategori.id == ids[1]))
            s.execute(delete(Rak).where(Rak.id == ids[2]))
            s.execute(delete(Admin).where(Admin.id == ids[3]))
            s.commit()


def _bersamaan(engine: Engine, tugas: list[tuple[int, list[str]]], admin_id: int) -> list:
    """Jalankan beberapa konfirmasi serentak; hasil per tugas: HasilPeminjaman atau galat."""
    hasil: list = [None] * len(tugas)
    mulai = threading.Barrier(len(tugas))

    def kerja(i: int, anggota_id: int, kode: list[str]) -> None:
        with Session(engine) as s:
            s.execute(text("SET lock_timeout = '10s'"))
            s.commit()
            mulai.wait(timeout=10)
            try:
                hasil[i] = peminjaman.konfirmasi(
                    s, anggota_id=anggota_id, kode_eksemplar=kode, admin_id=admin_id
                )
            except BaseException as exc:  # noqa: BLE001 — dilaporkan ke thread utama
                hasil[i] = exc

    th = [
        threading.Thread(target=kerja, args=(i, a, k), daemon=True)
        for i, (a, k) in enumerate(tugas)
    ]
    for t in th:
        t.start()
    for t in th:
        t.join(timeout=30)
        assert not t.is_alive(), "konfirmasi macet (deadlock?)"
    return hasil


def _jumlah_dipinjam(engine: Engine, eksemplar_id: int) -> int:
    with engine.connect() as k:
        return k.execute(
            text(
                "SELECT count(*) FROM item_transaksi"
                " WHERE eksemplar_id = :id AND status = 'DIPINJAM'"
            ),
            {"id": eksemplar_id},
        ).scalar_one()


def test_NFR_REL_02_dua_konfirmasi_eksemplar_sama_hanya_satu_berhasil(
    engine: Engine, data_tercommit: Data
):
    kode = data_tercommit.eksemplar_kode[0]
    hasil = _bersamaan(
        engine,
        [(data_tercommit.anggota_id[0], [kode]), (data_tercommit.anggota_id[1], [kode])],
        data_tercommit.admin_id,
    )
    berhasil = [h for h in hasil if isinstance(h, peminjaman.HasilPeminjaman)]
    gagal = [h for h in hasil if isinstance(h, GalatBisnis)]
    assert (len(berhasil), len(gagal)) == (1, 1), hasil
    assert gagal[0].kode == "PJM_EKSEMPLAR_TIDAK_TERSEDIA"
    assert f"{kode} berstatus Dipinjam" in gagal[0].pesan
    assert _jumlah_dipinjam(engine, data_tercommit.eksemplar_id[0]) == 1


def test_FR_PJM_08_dua_konfirmasi_anggota_sama_tidak_menembus_batas_3(
    engine: Engine, data_tercommit: Data
):
    k = data_tercommit.eksemplar_kode
    a = data_tercommit.anggota_id[0]
    hasil = _bersamaan(engine, [(a, k[0:2]), (a, k[2:4])], data_tercommit.admin_id)
    berhasil = [h for h in hasil if isinstance(h, peminjaman.HasilPeminjaman)]
    gagal = [h for h in hasil if isinstance(h, GalatBisnis)]
    assert (len(berhasil), len(gagal)) == (1, 1), hasil
    assert gagal[0].kode == "PJM_ITEM_MELEBIHI_BATAS"
    with Session(engine) as s:
        assert peminjaman.jumlah_pinjaman_aktif(s, a) == 2


def test_NFR_REL_02_konfirmasi_menunggu_kunci_eksemplar_lalu_ditolak(
    engine: Engine, data_tercommit: Data
):
    """Lapis FOR UPDATE: B menunggu A yang memegang baris eksemplar, lalu membaca status baru."""
    eid, kode = data_tercommit.eksemplar_id[0], data_tercommit.eksemplar_kode[0]
    terkunci = threading.Event()
    galat_a: list[BaseException] = []

    def peminjaman_a() -> None:
        try:
            with engine.connect() as k, k.begin():
                k.execute(text("SELECT id FROM eksemplar WHERE id = :id FOR UPDATE"), {"id": eid})
                k.execute(
                    text("UPDATE eksemplar SET status = 'DIPINJAM' WHERE id = :id"), {"id": eid}
                )
                terkunci.set()
                time.sleep(TAHAN_DETIK)
        except BaseException as exc:  # noqa: BLE001
            galat_a.append(exc)
            terkunci.set()

    a = threading.Thread(target=peminjaman_a, daemon=True)
    a.start()
    assert terkunci.wait(timeout=5)

    with Session(engine) as s:
        s.execute(text("SET lock_timeout = '5s'"))
        s.commit()
        mulai = time.monotonic()
        with pytest.raises(GalatBisnis) as info:
            peminjaman.konfirmasi(
                s,
                anggota_id=data_tercommit.anggota_id[0],
                kode_eksemplar=[kode],
                admin_id=data_tercommit.admin_id,
            )
        menunggu = time.monotonic() - mulai

    a.join(timeout=10)
    assert not a.is_alive() and not galat_a, galat_a
    assert info.value.kode == "PJM_EKSEMPLAR_TIDAK_TERSEDIA"
    assert menunggu >= TAHAN_DETIK * 0.8, "konfirmasi tidak menunggu kunci (FOR UPDATE hilang?)"


def test_FR_PJM_08_konfirmasi_menunggu_kunci_anggota(engine: Engine, data_tercommit: Data):
    """Lapis kunci anggota: konfirmasi kedua untuk anggota yang sama menunggu yang pertama."""
    aid = data_tercommit.anggota_id[0]
    terkunci = threading.Event()

    def tahan_anggota() -> None:
        with engine.connect() as k, k.begin():
            k.execute(text("SELECT id FROM anggota WHERE id = :id FOR UPDATE"), {"id": aid})
            terkunci.set()
            time.sleep(TAHAN_DETIK)

    t = threading.Thread(target=tahan_anggota, daemon=True)
    t.start()
    assert terkunci.wait(timeout=5)
    with Session(engine) as s:
        s.execute(text("SET lock_timeout = '5s'"))
        s.commit()
        mulai = time.monotonic()
        peminjaman.konfirmasi(
            s,
            anggota_id=aid,
            kode_eksemplar=[data_tercommit.eksemplar_kode[0]],
            admin_id=data_tercommit.admin_id,
        )
        menunggu = time.monotonic() - mulai
    t.join(timeout=10)
    assert menunggu >= TAHAN_DETIK * 0.8, "konfirmasi tidak mengunci baris anggota"

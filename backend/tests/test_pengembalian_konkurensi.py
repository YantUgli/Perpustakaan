"""NFR-REL-02 + FR-KMB-08: pengembalian yang berjalan bersamaan.

Koneksi terpisah dengan data yang benar-benar di-commit; selalu dibersihkan di teardown.
Tanggal relatif terhadap `hari_ini_wib()` (jam sistem), karena thread tidak berbagi patokan jam.
"""

import threading
import time
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date, timedelta

import pytest
from sqlalchemy import Engine, delete, select, text
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.core.waktu import hari_ini_wib
from app.models import (
    Admin,
    Anggota,
    Eksemplar,
    ItemTransaksi,
    JudulBuku,
    Kategori,
    Rak,
    Tagihan,
    TransaksiPeminjaman,
)
from app.services import pengembalian

TAHAN_DETIK = 1.0


@dataclass
class Data:
    anggota_id: int
    transaksi_id: int
    item_id: list[int]
    eksemplar_kode: list[str]


@pytest.fixture
def data_tercommit(engine: Engine) -> Iterator[Data]:
    n = time.time_ns()
    jatuh_tempo = hari_ini_wib() - timedelta(days=8)  # terlambat 8 hari → denda
    with Session(engine) as s:
        k = Kategori(nama=f"Konkurensi KMB {n}")
        r = Rak(kode=f"KKMB-{n}")
        adm = Admin(nama="Admin KMB", email=f"kmb{n}@perpus.example", password_hash="x")
        agt = Anggota(
            nama="Anggota KMB",
            alamat="x",
            email=f"agtkmb{n}@perpus.example",
            telepon="0812",
            nik=f"{n % 10**16:016d}",
            password_hash="x",
            tanggal_daftar=date(2026, 10, 1),
        )
        s.add_all([k, r, adm, agt])
        s.flush()
        j = JudulBuku(
            isbn=f"977{n % 10**10:010d}",
            judul="Uji Konkurensi Kembali",
            penulis="x",
            penerbit="x",
            tahun=2020,
            kategori_id=k.id,
            harga=100_000,
        )
        s.add(j)
        s.flush()
        eks = [Eksemplar(judul_buku_id=j.id, rak_id=r.id, status="DIPINJAM") for _ in range(2)]
        trx = TransaksiPeminjaman(
            anggota_id=agt.id,
            admin_id=adm.id,
            tanggal_transaksi=jatuh_tempo - timedelta(days=30),
            status="AKTIF",
        )
        s.add_all([*eks, trx])
        s.flush()
        item = [
            ItemTransaksi(
                transaksi_id=trx.id,
                eksemplar_id=e.id,
                tanggal_pinjam=jatuh_tempo - timedelta(days=30),
                jatuh_tempo=jatuh_tempo,
                status="DIPINJAM",
            )
            for e in eks
        ]
        s.add_all(item)
        s.commit()
        data = Data(
            anggota_id=agt.id,
            transaksi_id=trx.id,
            item_id=[i.id for i in item],
            eksemplar_kode=[e.kode for e in eks],
        )
        ids = (j.id, k.id, r.id, adm.id, [e.id for e in eks])
    try:
        yield data
    finally:
        with Session(engine) as s:
            s.execute(delete(Tagihan).where(Tagihan.item_transaksi_id.in_(data.item_id)))
            s.execute(delete(ItemTransaksi).where(ItemTransaksi.id.in_(data.item_id)))
            s.execute(
                delete(TransaksiPeminjaman).where(TransaksiPeminjaman.id == data.transaksi_id)
            )
            s.execute(delete(Eksemplar).where(Eksemplar.id.in_(ids[4])))
            s.execute(delete(Anggota).where(Anggota.id == data.anggota_id))
            s.execute(delete(JudulBuku).where(JudulBuku.id == ids[0]))
            s.execute(delete(Kategori).where(Kategori.id == ids[1]))
            s.execute(delete(Rak).where(Rak.id == ids[2]))
            s.execute(delete(Admin).where(Admin.id == ids[3]))
            s.commit()


def _sesi_aplikasi(engine: Engine) -> Session:
    """Konfigurasi sama dengan `app.db.get_sessionmaker` (autoflush=False): service wajib flush
    sendiri sebelum menghitung item (FR-KMB-08)."""
    return Session(engine, autoflush=False, expire_on_commit=False)


def _bersamaan(engine: Engine, kode: list[str]) -> list:
    hasil: list = [None] * len(kode)
    mulai = threading.Barrier(len(kode))

    def kerja(i: int, k: str) -> None:
        with _sesi_aplikasi(engine) as s:
            s.execute(text("SET lock_timeout = '10s'"))
            s.commit()
            mulai.wait(timeout=10)
            try:
                hasil[i] = pengembalian.konfirmasi(s, kode_eksemplar=k)
            except BaseException as exc:  # noqa: BLE001 — dilaporkan ke thread utama
                hasil[i] = exc

    th = [threading.Thread(target=kerja, args=(i, k), daemon=True) for i, k in enumerate(kode)]
    for t in th:
        t.start()
    for t in th:
        t.join(timeout=30)
        assert not t.is_alive(), "pengembalian macet (deadlock?)"
    return hasil


def test_NFR_REL_02_dua_admin_mengembalikan_eksemplar_sama_hanya_satu_berhasil(
    engine: Engine, data_tercommit: Data
):
    kode = data_tercommit.eksemplar_kode[0]
    hasil = _bersamaan(engine, [kode, kode])
    berhasil = [h for h in hasil if isinstance(h, pengembalian.HasilPengembalian)]
    gagal = [h for h in hasil if isinstance(h, GalatBisnis)]
    assert (len(berhasil), len(gagal)) == (1, 1), hasil
    assert gagal[0].kode == "KMB_TIDAK_DIPINJAM"
    with Session(engine) as s:
        tagihan = s.scalars(
            select(Tagihan).where(Tagihan.item_transaksi_id == data_tercommit.item_id[0])
        ).all()
    assert [t.nominal for t in tagihan] == [20_000]


def test_FR_KMB_08_dua_item_satu_transaksi_dikembalikan_bersamaan_transaksi_selesai(
    engine: Engine, data_tercommit: Data
):
    hasil = _bersamaan(engine, data_tercommit.eksemplar_kode)
    assert all(isinstance(h, pengembalian.HasilPengembalian) for h in hasil), hasil
    assert sorted(h.transaksi_selesai for h in hasil) == [False, True]
    with Session(engine) as s:
        trx = s.get(TransaksiPeminjaman, data_tercommit.transaksi_id)
        assert trx.status == "SELESAI"


def test_KMB_konfirmasi_menunggu_kunci_anggota(engine: Engine, data_tercommit: Data):
    """Titipan 5.3.8: pengembalian mengunci baris anggota lebih dulu."""
    aid = data_tercommit.anggota_id
    terkunci = threading.Event()

    def tahan_anggota() -> None:
        with engine.connect() as k, k.begin():
            k.execute(text("SELECT id FROM anggota WHERE id = :id FOR UPDATE"), {"id": aid})
            terkunci.set()
            time.sleep(TAHAN_DETIK)

    t = threading.Thread(target=tahan_anggota, daemon=True)
    t.start()
    assert terkunci.wait(timeout=5)
    with _sesi_aplikasi(engine) as s:
        s.execute(text("SET lock_timeout = '5s'"))
        s.commit()
        mulai = time.monotonic()
        pengembalian.konfirmasi(s, kode_eksemplar=data_tercommit.eksemplar_kode[0])
        menunggu = time.monotonic() - mulai
    t.join(timeout=10)
    assert menunggu >= TAHAN_DETIK * 0.8, "pengembalian tidak mengunci baris anggota"

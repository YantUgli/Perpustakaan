"""NFR-REL-02 + FR-TGH-06: penyelesaian tagihan yang berjalan bersamaan.

Data ter-commit pada koneksi terpisah; sesi `autoflush=False` seperti aplikasi. Teardown memakai
`TRUNCATE tagihan` karena trigger FR-TGH-06 menolak DELETE baris Lunas (decisions.md §B); trigger
tidak pernah dinonaktifkan. Hanya berlaku di DB test (penjaga `_test` di conftest).
"""

import threading
import time
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import date, timedelta

import pytest
from sqlalchemy import Engine, delete, text
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
from app.models.status import CaraPenyelesaian
from app.services import tagihan

TAHAN_DETIK = 1.0


@dataclass
class Data:
    admin_id: int
    anggota_id: int
    tagihan_id: int
    eksemplar_id: int


@pytest.fixture
def data_tercommit(engine: Engine) -> Iterator[Data]:
    n = time.time_ns()
    hari_ini = hari_ini_wib()
    with Session(engine) as s:
        k = Kategori(nama=f"Konkurensi TGH {n}")
        r = Rak(kode=f"KTGH-{n}")
        adm = Admin(nama="Admin TGH", email=f"tgh{n}@perpus.example", password_hash="x")
        agt = Anggota(
            nama="Anggota TGH",
            alamat="x",
            email=f"agttgh{n}@perpus.example",
            telepon="0812",
            nik=f"{(n + 11) % 10**16:016d}",
            password_hash="x",
            tanggal_daftar=date(2026, 10, 1),
        )
        s.add_all([k, r, adm, agt])
        s.flush()
        j = JudulBuku(
            isbn=f"975{n % 10**10:010d}",
            judul="Uji Konkurensi Tagihan",
            penulis="x",
            penerbit="x",
            tahun=2020,
            kategori_id=k.id,
            harga=60_000,
        )
        s.add(j)
        s.flush()
        e = Eksemplar(judul_buku_id=j.id, rak_id=r.id, status="HILANG")
        trx = TransaksiPeminjaman(
            anggota_id=agt.id,
            admin_id=adm.id,
            tanggal_transaksi=hari_ini - timedelta(days=10),
            status="SELESAI",
        )
        s.add_all([e, trx])
        s.flush()
        item = ItemTransaksi(
            transaksi_id=trx.id,
            eksemplar_id=e.id,
            tanggal_pinjam=hari_ini - timedelta(days=10),
            jatuh_tempo=hari_ini + timedelta(days=20),
            status="HILANG",
            tanggal_kejadian=hari_ini - timedelta(days=2),
            keterangan="Konkurensi",
            admin_pencatat_id=adm.id,
        )
        s.add(item)
        s.flush()
        t = Tagihan(
            item_transaksi_id=item.id,
            jenis="PENGGANTIAN",
            nominal=60_000,
            status="BELUM_LUNAS",
            tanggal_dibentuk=hari_ini,
        )
        s.add(t)
        s.commit()
        data = Data(admin_id=adm.id, anggota_id=agt.id, tagihan_id=t.id, eksemplar_id=e.id)
        ids = (item.id, trx.id, j.id, k.id, r.id)
    try:
        yield data
    finally:
        with Session(engine) as s:
            s.execute(text("TRUNCATE tagihan"))  # trigger FR-TGH-06 menolak DELETE baris Lunas
            s.execute(delete(ItemTransaksi).where(ItemTransaksi.id == ids[0]))
            s.execute(delete(TransaksiPeminjaman).where(TransaksiPeminjaman.id == ids[1]))
            s.execute(delete(Eksemplar).where(Eksemplar.id == data.eksemplar_id))
            s.execute(delete(Anggota).where(Anggota.id == data.anggota_id))
            s.execute(delete(JudulBuku).where(JudulBuku.id == ids[2]))
            s.execute(delete(Kategori).where(Kategori.id == ids[3]))
            s.execute(delete(Rak).where(Rak.id == ids[4]))
            s.execute(delete(Admin).where(Admin.id == data.admin_id))
            s.commit()


def _sesi_aplikasi(engine: Engine) -> Session:
    """Sama dengan `app.db.get_sessionmaker`: autoflush=False."""
    return Session(engine, autoflush=False, expire_on_commit=False)


def _selesaikan(data: Data, cara: str) -> Callable[[Session], object]:
    return lambda s: tagihan.selesaikan(
        s,
        data.tagihan_id,
        cara=CaraPenyelesaian(cara),
        nominal=60_000 if cara != "BUKU_PENGGANTI" else None,
        tanggal=hari_ini_wib(),
        admin_id=data.admin_id,
    )


def _bersamaan(engine: Engine, tugas: list[Callable[[Session], object]]) -> list:
    hasil: list = [None] * len(tugas)
    mulai = threading.Barrier(len(tugas))

    def kerja(i: int, fungsi: Callable[[Session], object]) -> None:
        with _sesi_aplikasi(engine) as s:
            s.execute(text("SET lock_timeout = '10s'"))
            s.commit()
            mulai.wait(timeout=10)
            try:
                hasil[i] = fungsi(s)
            except BaseException as exc:  # noqa: BLE001 — dilaporkan ke thread utama
                hasil[i] = exc

    th = [threading.Thread(target=kerja, args=(i, f), daemon=True) for i, f in enumerate(tugas)]
    for t in th:
        t.start()
    for t in th:
        t.join(timeout=30)
        assert not t.is_alive(), "penyelesaian macet (deadlock?)"
    return hasil


def test_NFR_REL_02_dua_admin_menyelesaikan_tagihan_sama_hanya_satu_berhasil(
    engine: Engine, data_tercommit: Data
):
    hasil = _bersamaan(
        engine,
        [_selesaikan(data_tercommit, "BUKU_PENGGANTI"), _selesaikan(data_tercommit, "TUNAI")],
    )
    berhasil = [h for h in hasil if isinstance(h, tagihan.TagihanRinci)]
    galat = [h for h in hasil if isinstance(h, GalatBisnis)]
    assert (len(berhasil), len(galat)) == (1, 1), hasil
    assert galat[0].kode == "TGH_SUDAH_LUNAS"
    with Session(engine) as s:
        t = s.get(Tagihan, data_tercommit.tagihan_id)
        e = s.get(Eksemplar, data_tercommit.eksemplar_id)
        assert (t.status, t.cara_penyelesaian) == ("LUNAS", berhasil[0].cara_penyelesaian)
        # eksemplar konsisten dengan cara yang menang (FR-TGH-04)
        harapan = "TERSEDIA" if t.cara_penyelesaian == "BUKU_PENGGANTI" else "HILANG"
        assert e.status == harapan


def test_TGH_menunggu_kunci_anggota(engine: Engine, data_tercommit: Data):
    """Titipan 5.3.8: penyelesaian tagihan mengunci baris anggota lebih dulu."""
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
        _selesaikan(data_tercommit, "TUNAI")(s)
        menunggu = time.monotonic() - mulai
    t.join(timeout=10)
    assert menunggu >= TAHAN_DETIK * 0.8, "penyelesaian tidak mengunci baris anggota"

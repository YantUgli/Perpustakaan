"""NFR-REL-02: pencatatan hilang/rusak yang berjalan bersamaan dengan operasi lain atas item sama.

Koneksi terpisah dengan data ter-commit; sesi `autoflush=False` seperti aplikasi. Data selalu
dibersihkan di teardown. Tanggal relatif terhadap `hari_ini_wib()` (jam sistem).
"""

import threading
import time
from collections.abc import Callable, Iterator
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
from app.models.status import StatusItem
from app.services import hilang_rusak, pengembalian

TAHAN_DETIK = 1.0


@dataclass
class Data:
    admin_id: int
    anggota_id: int
    item_id: int
    eksemplar_id: int
    eksemplar_kode: str


@pytest.fixture
def data_tercommit(engine: Engine) -> Iterator[Data]:
    n = time.time_ns()
    jatuh_tempo = hari_ini_wib() - timedelta(days=8)  # terlambat → pengembalian membentuk denda
    with Session(engine) as s:
        k = Kategori(nama=f"Konkurensi HLR {n}")
        r = Rak(kode=f"KHLR-{n}")
        adm = Admin(nama="Admin HLR", email=f"hlr{n}@perpus.example", password_hash="x")
        agt = Anggota(
            nama="Anggota HLR",
            alamat="x",
            email=f"agthlr{n}@perpus.example",
            telepon="0812",
            nik=f"{(n + 7) % 10**16:016d}",
            password_hash="x",
            tanggal_daftar=date(2026, 10, 1),
        )
        s.add_all([k, r, adm, agt])
        s.flush()
        j = JudulBuku(
            isbn=f"976{n % 10**10:010d}",
            judul="Uji Konkurensi Hilang",
            penulis="x",
            penerbit="x",
            tahun=2020,
            kategori_id=k.id,
            harga=90_000,
        )
        s.add(j)
        s.flush()
        e = Eksemplar(judul_buku_id=j.id, rak_id=r.id, status="DIPINJAM")
        trx = TransaksiPeminjaman(
            anggota_id=agt.id,
            admin_id=adm.id,
            tanggal_transaksi=jatuh_tempo - timedelta(days=30),
            status="AKTIF",
        )
        s.add_all([e, trx])
        s.flush()
        item = ItemTransaksi(
            transaksi_id=trx.id,
            eksemplar_id=e.id,
            tanggal_pinjam=jatuh_tempo - timedelta(days=30),
            jatuh_tempo=jatuh_tempo,
            status="DIPINJAM",
        )
        s.add(item)
        s.commit()
        data = Data(
            admin_id=adm.id,
            anggota_id=agt.id,
            item_id=item.id,
            eksemplar_id=e.id,
            eksemplar_kode=e.kode,
        )
        ids = (trx.id, j.id, k.id, r.id)
    try:
        yield data
    finally:
        with Session(engine) as s:
            s.execute(delete(Tagihan).where(Tagihan.item_transaksi_id == data.item_id))
            s.execute(delete(ItemTransaksi).where(ItemTransaksi.id == data.item_id))
            s.execute(delete(TransaksiPeminjaman).where(TransaksiPeminjaman.id == ids[0]))
            s.execute(delete(Eksemplar).where(Eksemplar.id == data.eksemplar_id))
            s.execute(delete(Anggota).where(Anggota.id == data.anggota_id))
            s.execute(delete(JudulBuku).where(JudulBuku.id == ids[1]))
            s.execute(delete(Kategori).where(Kategori.id == ids[2]))
            s.execute(delete(Rak).where(Rak.id == ids[3]))
            s.execute(delete(Admin).where(Admin.id == data.admin_id))
            s.commit()


def _sesi_aplikasi(engine: Engine) -> Session:
    """Sama dengan `app.db.get_sessionmaker`: autoflush=False."""
    return Session(engine, autoflush=False, expire_on_commit=False)


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
        assert not t.is_alive(), "operasi macet (deadlock?)"
    return hasil


def _catat(data: Data) -> Callable[[Session], object]:
    return lambda s: hilang_rusak.catat(
        s,
        item_id=data.item_id,
        jenis=StatusItem.HILANG,
        tanggal_kejadian=hari_ini_wib(),
        keterangan="Konkurensi",
        admin_id=data.admin_id,
    )


def _status_akhir(engine: Engine, data: Data) -> tuple[str, str, list[tuple[str, int]]]:
    with Session(engine) as s:
        item = s.get(ItemTransaksi, data.item_id)
        e = s.get(Eksemplar, data.eksemplar_id)
        tagihan = s.execute(
            select(Tagihan.jenis, Tagihan.nominal).where(Tagihan.item_transaksi_id == data.item_id)
        ).all()
        return item.status, e.status, [tuple(t) for t in tagihan]


def test_NFR_REL_02_catat_hilang_dan_pengembalian_bersamaan_hanya_satu_berhasil(
    engine: Engine, data_tercommit: Data
):
    hasil = _bersamaan(
        engine,
        [
            _catat(data_tercommit),
            lambda s: pengembalian.konfirmasi(s, kode_eksemplar=data_tercommit.eksemplar_kode),
        ],
    )
    galat = [h for h in hasil if isinstance(h, GalatBisnis)]
    assert len(galat) == 1, hasil
    assert galat[0].kode in {"HLR_TIDAK_DIPINJAM", "KMB_TIDAK_DIPINJAM"}
    status_item, status_eks, tagihan = _status_akhir(engine, data_tercommit)
    if isinstance(hasil[0], hilang_rusak.HasilPencatatan):  # hilang menang
        assert (status_item, status_eks, tagihan) == ("HILANG", "HILANG", [("PENGGANTIAN", 90_000)])
    else:  # pengembalian menang: denda 8 hari = 2 minggu × 10% × 90.000
        assert (status_item, status_eks, tagihan) == (
            "DIKEMBALIKAN",
            "TERSEDIA",
            [("DENDA", 18_000)],
        )


def test_NFR_REL_02_dua_admin_mencatat_item_sama_hanya_satu_tagihan(
    engine: Engine, data_tercommit: Data
):
    hasil = _bersamaan(engine, [_catat(data_tercommit), _catat(data_tercommit)])
    berhasil = [h for h in hasil if isinstance(h, hilang_rusak.HasilPencatatan)]
    galat = [h for h in hasil if isinstance(h, GalatBisnis)]
    assert (len(berhasil), len(galat)) == (1, 1), hasil
    assert galat[0].kode == "HLR_TIDAK_DIPINJAM"
    assert "(status item: Hilang)" in galat[0].pesan
    assert _status_akhir(engine, data_tercommit)[2] == [("PENGGANTIAN", 90_000)]


def test_HLR_menunggu_kunci_anggota(engine: Engine, data_tercommit: Data):
    """Titipan 5.3.8: pencatatan mengunci baris anggota lebih dulu."""
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
        _catat(data_tercommit)(s)
        menunggu = time.monotonic() - mulai
    t.join(timeout=10)
    assert menunggu >= TAHAN_DETIK * 0.8, "pencatatan tidak mengunci baris anggota"

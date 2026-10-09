"""WP 5.3.11 — tagihan: FR-TGH-01..07, BR-17, BR-19, BR-20, OQ-08, OQ-28, OQ-29.

Tagihan dibentuk lewat service sungguhan (pengembalian 5.3.9, hilang/rusak 5.3.10). "Hari ini"
dipatok 15/11/2026 WIB kecuali digeser lewat fixture `jam`. Konkurensi ada di
test_tagihan_konkurensi.py.
"""

import re
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.core.keamanan import hash_password
from app.models import Admin, Anggota, Eksemplar, ItemTransaksi, Tagihan
from app.models.status import CaraPenyelesaian, StatusItem
from app.services import hilang_rusak, peminjaman, pengembalian, tagihan
from tests import pabrik

HARI_INI = date(2026, 11, 15)
API = "/api/v1/admin/tagihan"


@pytest.fixture
def jam(atur_waktu) -> Callable[[date], None]:
    def atur(tanggal: date) -> None:
        atur_waktu(datetime(tanggal.year, tanggal.month, tanggal.day, 3, 0, tzinfo=UTC))

    atur(HARI_INI)
    return atur


@pytest.fixture(autouse=True)
def _jam_bawaan(jam):
    """Semua test di modul ini memakai jam terpatok."""


# --------------------------------------------------------------------------- pembuat data


def _item(
    db: Session,
    anggota: Anggota,
    *,
    terlambat: int = 8,
    harga: int = 100_000,
    judul: str = "Buku Tagihan",
    hari_ini: date = HARI_INI,
) -> tuple[ItemTransaksi, Eksemplar]:
    jatuh_tempo = hari_ini - timedelta(days=terlambat)
    j = pabrik.judul(db, judul=judul, harga=harga)
    e = pabrik.eksemplar(db, judul_buku_id=j.id, status="DIPINJAM")
    trx = pabrik.transaksi(db, anggota_id=anggota.id)
    item = pabrik.item(
        db,
        transaksi_id=trx.id,
        eksemplar_id=e.id,
        tanggal_pinjam=jatuh_tempo - timedelta(days=30),
        jatuh_tempo=jatuh_tempo,
        status="DIPINJAM",
    )
    return item, e


def _denda(db: Session, anggota: Anggota, **kw) -> tuple[Tagihan, Eksemplar]:
    """Tagihan Denda lewat pengembalian terlambat (5.3.9). Bawaan: 8 hari × Rp100.000 = Rp20.000."""
    _, e = _item(db, anggota, **kw)
    h = pengembalian.konfirmasi(db, kode_eksemplar=e.kode)
    return db.get(Tagihan, h.tagihan.id), e


def _penggantian(
    db: Session, anggota: Anggota, *, jenis: str = "HILANG", harga: int = 75_000, **kw
) -> tuple[Tagihan, Eksemplar]:
    """Tagihan Penggantian lewat pencatatan hilang/rusak (5.3.10)."""
    item, e = _item(db, anggota, terlambat=-3, harga=harga, **kw)
    h = hilang_rusak.catat(
        db,
        item_id=item.id,
        jenis=StatusItem(jenis),
        tanggal_kejadian=item.tanggal_pinjam,
        keterangan="Laporan lisan",
        admin_id=pabrik.admin(db).id,
    )
    return db.get(Tagihan, h.tagihan.id), e


def _selesaikan(
    db: Session,
    t: Tagihan,
    cara: str,
    *,
    nominal: int | None = None,
    tanggal: date = HARI_INI,
    admin_id: int | None = None,
) -> tagihan.TagihanRinci:
    return tagihan.selesaikan(
        db,
        t.id,
        cara=CaraPenyelesaian(cara),
        nominal=nominal,
        tanggal=tanggal,
        admin_id=admin_id or pabrik.admin(db).id,
    )


def _setup_tercommit(db: Session) -> None:
    """Commit data setup sebelum operasi yang diharapkan gagal (savepoint fixture)."""
    db.commit()


def _galat(fungsi, *args, **kwargs) -> GalatBisnis:
    with pytest.raises(GalatBisnis) as info:
        fungsi(*args, **kwargs)
    return info.value


def _segar(db: Session, model, id_: int):
    db.expire_all()
    return db.get(model, id_)


def _belum_berubah(db: Session, t: Tagihan) -> None:
    s = _segar(db, Tagihan, t.id)
    assert (s.status, s.cara_penyelesaian, s.nominal_dibayar, s.tanggal_penyelesaian) == (
        "BELUM_LUNAS",
        None,
        None,
        None,
    )
    assert s.admin_pengonfirmasi_id is None


# --------------------------------------------------------------------------- daftar (FR-TGH-01)


def test_FR_TGH_01_OQ_29_daftar_filter_status_jenis_anggota(db: Session):
    a = pabrik.anggota(db, nama="Sri Lestari")
    b = pabrik.anggota(db)
    t_denda, e_denda = _denda(db, a, judul="Atheis")
    t_ganti, _ = _penggantian(db, a, judul="Layar Terkembang")
    t_b, _ = _penggantian(db, b)
    admin = pabrik.admin(db, nama="Admin Kasir")
    _selesaikan(db, t_ganti, "TUNAI", nominal=75_000, admin_id=admin.id)

    def ids(**f) -> set[int]:
        data, total = tagihan.daftar(
            db,
            status=f.get("status"),
            jenis=f.get("jenis"),
            anggota_kode=f.get("anggota"),
            halaman=1,
            per_halaman=100,
        )
        assert total == len(data)
        return {t.id for t in data}

    assert ids(anggota=a.kode) == {t_denda.id, t_ganti.id}
    assert ids(anggota=f" {a.kode.lower()} ") == {t_denda.id, t_ganti.id}
    assert ids(anggota=a.kode, status="LUNAS") == {t_ganti.id}
    assert ids(anggota=a.kode, jenis="DENDA") == {t_denda.id}
    assert t_b.id in ids(status="BELUM_LUNAS", jenis="PENGGANTIAN")
    assert t_ganti.id not in ids(status="BELUM_LUNAS")

    (rinci,) = [
        x
        for x in tagihan.daftar(
            db, status=None, jenis=None, anggota_kode=a.kode, halaman=1, per_halaman=100
        )[0]
        if x.id == t_denda.id
    ]
    assert rinci == tagihan.TagihanRinci(
        id=t_denda.id,
        jenis="DENDA",
        nominal=20_000,
        status="BELUM_LUNAS",
        tanggal_dibentuk=HARI_INI,
        anggota=tagihan.Ringkas(kode=a.kode, nama="Sri Lestari"),
        eksemplar=tagihan.Ringkas(kode=e_denda.kode, nama="Atheis"),
        cara_penyelesaian=None,
        nominal_dibayar=None,
        tanggal_penyelesaian=None,
        admin_pengonfirmasi=None,
    )
    assert tagihan.detail(db, t_ganti.id).admin_pengonfirmasi == "Admin Kasir"


def test_FR_TGH_01_urutan_terbaru_dan_pagination(db: Session, jam):
    a = pabrik.anggota(db)
    dibuat = []
    for tgl in (date(2026, 11, 10), date(2026, 11, 15), date(2026, 11, 12)):
        jam(tgl)
        dibuat.append(_denda(db, a, hari_ini=tgl)[0])
    jam(HARI_INI)
    h1, total = tagihan.daftar(
        db, status=None, jenis=None, anggota_kode=a.kode, halaman=1, per_halaman=2
    )
    h2, _ = tagihan.daftar(
        db, status=None, jenis=None, anggota_kode=a.kode, halaman=2, per_halaman=2
    )
    assert total == 3
    assert [t.tanggal_dibentuk for t in h1 + h2] == [
        date(2026, 11, 15),
        date(2026, 11, 12),
        date(2026, 11, 10),
    ]


def test_FR_TGH_01_OQ_29_anggota_tak_dikenal_daftar_kosong(db: Session):
    data, total = tagihan.daftar(
        db, status=None, jenis=None, anggota_kode="AGT-999999", halaman=1, per_halaman=20
    )
    assert (data, total) == ([], 0)


def test_FR_TGH_01_detail_tidak_ada_404(db: Session):
    g = _galat(tagihan.detail, db, 999_999_999)
    assert (g.kode, g.status_code) == ("TGH_TIDAK_ADA", 404)


# --------------------------------------------------------------------------- bayar uang (FR-TGH-02)


@pytest.mark.parametrize("cara", ["TUNAI", "TRANSFER"])
def test_FR_TGH_02_05_bayar_uang_lunas_data_tersimpan(db: Session, cara):
    a = pabrik.anggota(db)
    t, e = _denda(db, a)
    admin = pabrik.admin(db, nama="Admin Loket")
    h = _selesaikan(db, t, cara, nominal=20_000, tanggal=HARI_INI, admin_id=admin.id)
    assert (h.status, h.cara_penyelesaian, h.nominal_dibayar, h.tanggal_penyelesaian) == (
        "LUNAS",
        cara,
        20_000,
        HARI_INI,
    )
    assert h.admin_pengonfirmasi == "Admin Loket"
    s = _segar(db, Tagihan, t.id)
    assert (s.status, s.admin_pengonfirmasi_id, s.nominal) == ("LUNAS", admin.id, 20_000)
    assert _segar(db, Eksemplar, e.id).status == "TERSEDIA"  # denda: eksemplar tak tersentuh


@pytest.mark.parametrize("nominal", [19_999, 20_001, 10_000])
def test_FR_TGH_02_nominal_tidak_sama_ditolak(db: Session, nominal):
    t, _ = _denda(db, pabrik.anggota(db))
    admin = pabrik.admin(db)
    _setup_tercommit(db)
    g = _galat(_selesaikan, db, t, "TRANSFER", nominal=nominal, admin_id=admin.id)
    assert (g.kode, g.status_code, g.rujukan) == ("TGH_NOMINAL_TIDAK_SAMA", 422, "FR-TGH-02")
    assert f"Rp{nominal:,}".replace(",", ".") in g.pesan and "Rp20.000" in g.pesan
    assert "sebagian" in g.pesan
    _belum_berubah(db, t)


def test_FR_TGH_02_nominal_kosong_ditolak(db: Session):
    t, _ = _denda(db, pabrik.anggota(db))
    g = _galat(_selesaikan, db, t, "TUNAI", nominal=None)
    assert (g.kode, g.status_code, g.rujukan) == ("TGH_NOMINAL_WAJIB", 422, "FR-TGH-02")


# ------------------------------------------------------------------ buku pengganti (FR-TGH-03/04)


def test_FR_TGH_03_buku_pengganti_pada_denda_ditolak(db: Session):
    t, _ = _denda(db, pabrik.anggota(db))
    admin = pabrik.admin(db)
    _setup_tercommit(db)
    g = _galat(_selesaikan, db, t, "BUKU_PENGGANTI", admin_id=admin.id)
    assert (g.kode, g.status_code, g.rujukan) == (
        "TGH_BUKU_PENGGANTI_HANYA_PENGGANTIAN",
        422,
        "FR-TGH-03",
    )
    _belum_berubah(db, t)


def test_FR_TGH_03_OQ_08_nominal_diisi_pada_buku_pengganti_ditolak(db: Session):
    t, _ = _penggantian(db, pabrik.anggota(db))
    g = _galat(_selesaikan, db, t, "BUKU_PENGGANTI", nominal=75_000)
    assert (g.kode, g.status_code, g.rujukan) == ("TGH_NOMINAL_TIDAK_BERLAKU", 422, "FR-TGH-03")


@pytest.mark.parametrize("jenis", ["HILANG", "RUSAK"])
def test_FR_TGH_04_BR_20_buku_pengganti_eksemplar_tersedia_kode_sama(db: Session, jenis):
    t, e = _penggantian(db, pabrik.anggota(db), jenis=jenis)
    sebelum = _segar(db, Eksemplar, e.id)
    kode, rak_id, judul_id = sebelum.kode, sebelum.rak_id, sebelum.judul_buku_id
    terima = HARI_INI
    h = _selesaikan(db, t, "BUKU_PENGGANTI", tanggal=terima)

    assert (h.status, h.cara_penyelesaian, h.nominal_dibayar, h.tanggal_penyelesaian) == (
        "LUNAS",
        "BUKU_PENGGANTI",
        None,
        terima,  # OQ-08: tanggal penerimaan
    )
    sesudah = _segar(db, Eksemplar, e.id)
    assert (sesudah.status, sesudah.kode, sesudah.rak_id, sesudah.judul_buku_id) == (
        "TERSEDIA",
        kode,
        rak_id,
        judul_id,
    )
    item = _segar(db, ItemTransaksi, t.item_transaksi_id)
    assert item.status == jenis  # riwayat item tidak berubah (SRS 7.2)


@pytest.mark.parametrize(("jenis", "cara"), [("HILANG", "TUNAI"), ("RUSAK", "TRANSFER")])
def test_FR_TGH_04_bayar_uang_eksemplar_tetap_hilang_rusak(db: Session, jenis, cara):
    t, e = _penggantian(db, pabrik.anggota(db), jenis=jenis, harga=75_000)
    _selesaikan(db, t, cara, nominal=75_000)
    assert _segar(db, Eksemplar, e.id).status == jenis


def test_FR_TGH_04_eksemplar_pengganti_bisa_dipinjam_lagi(db: Session):
    t, e = _penggantian(db, pabrik.anggota(db))
    _selesaikan(db, t, "BUKU_PENGGANTI")
    lain = pabrik.anggota(db)
    hasil = peminjaman.konfirmasi(
        db, anggota_id=lain.id, kode_eksemplar=[e.kode], admin_id=pabrik.admin(db).id
    )
    assert [i.kode_eksemplar for i in hasil.item] == [e.kode]


def test_FR_TGH_04_eksemplar_tidak_hilang_rusak_ditolak_menyebut_status(db: Session):
    t, e = _penggantian(db, pabrik.anggota(db))
    db.get(Eksemplar, e.id).status = "TERSEDIA"  # data tidak wajar (mis. diubah di luar alur)
    admin = pabrik.admin(db)
    _setup_tercommit(db)
    g = _galat(_selesaikan, db, t, "BUKU_PENGGANTI", admin_id=admin.id)
    assert (g.kode, g.status_code, g.rujukan) == (
        "TGH_EKSEMPLAR_TIDAK_HILANG_RUSAK",
        409,
        "FR-TGH-04",
    )
    assert f"{e.kode} berstatus Tersedia" in g.pesan
    _belum_berubah(db, t)


# --------------------------------------------------------------------------- tanggal (OQ-28)


@pytest.mark.parametrize(
    ("cara", "rujukan"), [("TUNAI", "FR-TGH-02"), ("BUKU_PENGGANTI", "FR-TGH-03")]
)
@pytest.mark.parametrize("tanggal", [date(2026, 11, 9), date(2026, 11, 16)])
def test_OQ_28_tanggal_di_luar_batas_ditolak(db: Session, jam, cara, rujukan, tanggal):
    jam(date(2026, 11, 10))
    t, _ = _penggantian(db, pabrik.anggota(db), hari_ini=date(2026, 11, 10))
    jam(HARI_INI)
    admin = pabrik.admin(db)
    _setup_tercommit(db)
    nominal = 75_000 if cara == "TUNAI" else None
    g = _galat(_selesaikan, db, t, cara, nominal=nominal, tanggal=tanggal, admin_id=admin.id)
    assert (g.kode, g.status_code, g.rujukan) == ("TGH_TANGGAL", 422, rujukan)
    assert "10/11/2026" in g.pesan and "15/11/2026" in g.pesan
    _belum_berubah(db, t)


@pytest.mark.parametrize("tanggal", [date(2026, 11, 10), date(2026, 11, 15)])
def test_OQ_28_tanggal_batas_inklusif_diterima(db: Session, jam, tanggal):
    jam(date(2026, 11, 10))
    t, _ = _penggantian(db, pabrik.anggota(db), hari_ini=date(2026, 11, 10))
    jam(HARI_INI)
    assert _selesaikan(db, t, "BUKU_PENGGANTI", tanggal=tanggal).tanggal_penyelesaian == tanggal


# ---------------------------------------------------------------------- Lunas terkunci (FR-TGH-06)


def test_FR_TGH_06_selesaikan_tagihan_lunas_ditolak_409(db: Session):
    t, _ = _denda(db, pabrik.anggota(db))
    pertama = pabrik.admin(db)
    _selesaikan(db, t, "TUNAI", nominal=20_000, admin_id=pertama.id)
    g = _galat(_selesaikan, db, t, "TRANSFER", nominal=20_000)
    assert (g.kode, g.status_code, g.rujukan) == ("TGH_SUDAH_LUNAS", 409, "FR-TGH-06")
    s = _segar(db, Tagihan, t.id)
    assert (s.cara_penyelesaian, s.admin_pengonfirmasi_id) == ("TUNAI", pertama.id)


def _ditolak_db(db: Session, sql: str, tagihan_id: int) -> DBAPIError:
    with pytest.raises(DBAPIError) as info, db.begin_nested():
        db.execute(text(sql), {"id": tagihan_id})
    return info.value


def test_FR_TGH_06_trigger_tolak_update_dan_delete_lunas(db: Session):
    t, _ = _denda(db, pabrik.anggota(db))
    _selesaikan(db, t, "TUNAI", nominal=20_000)
    for sql in (
        "UPDATE tagihan SET nominal = 1 WHERE id = :id",
        "UPDATE tagihan SET status = 'BELUM_LUNAS', cara_penyelesaian = NULL, "
        "nominal_dibayar = NULL, tanggal_penyelesaian = NULL, admin_pengonfirmasi_id = NULL "
        "WHERE id = :id",
        "DELETE FROM tagihan WHERE id = :id",
    ):
        exc = _ditolak_db(db, sql, t.id)
        assert "tagihan_lunas_terkunci" in str(exc.orig), sql
    assert _segar(db, Tagihan, t.id).status == "LUNAS"


def test_FR_TGH_06_trigger_tidak_menghalangi_belum_lunas(db: Session):
    t, _ = _denda(db, pabrik.anggota(db))
    db.execute(text("UPDATE tagihan SET nominal = 19000 WHERE id = :id"), {"id": t.id})
    db.execute(text("DELETE FROM tagihan WHERE id = :id"), {"id": t.id})
    assert _segar(db, Tagihan, t.id) is None


def test_FR_TGH_06_trigger_terpicu_akibat_balapan_diterjemahkan(db: Session, monkeypatch):
    t, _ = _denda(db, pabrik.anggota(db))
    _selesaikan(db, t, "TUNAI", nominal=20_000)
    # Tiru balapan: pemeriksaan service "lolos", sehingga yang menolak adalah trigger DB.
    monkeypatch.setattr(tagihan, "_belum_lunas", lambda _t: True)
    g = _galat(_selesaikan, db, t, "TRANSFER", nominal=20_000)
    assert (g.kode, g.status_code) == ("TGH_SUDAH_LUNAS", 409)
    assert "tagihan_lunas_terkunci" not in g.pesan  # pesan mentah PostgreSQL tak bocor


def test_FR_TGH_06_tidak_ada_route_ubah_atau_hapus_tagihan():
    from tests.test_autentikasi import _route_aplikasi_sungguhan

    route = [r for r in _route_aplikasi_sungguhan() if r.path.startswith("/api/v1/admin/tagihan")]
    assert route
    metode = {(m, r.path) for r in route for m in r.methods}
    assert {m for m, _ in metode} <= {"GET", "POST"}
    assert {p for m, p in metode if m == "POST"} == {
        "/api/v1/admin/tagihan/{tagihan_id}/penyelesaian"
    }


def test_NFR_MNT_01_downgrade_migration_menghapus_trigger_dan_fungsi(engine: Engine):
    from alembic import command
    from tests.conftest import alembic_config

    cfg = alembic_config()
    tanya = (
        "SELECT (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_tagihan_lunas_terkunci'),"
        " (SELECT count(*) FROM pg_proc WHERE proname = 'tolak_ubah_tagihan_lunas')"
    )
    try:
        # Revisi sebelum 485a69c0f745 (trigger), bukan "-1": migration baru bisa berada di atasnya.
        command.downgrade(cfg, "8ead55e364f2")
        with engine.connect() as k:
            assert tuple(k.execute(text(tanya)).one()) == (0, 0)
    finally:
        command.upgrade(cfg, "head")
    with engine.connect() as k:
        assert tuple(k.execute(text(tanya)).one()) == (1, 1)


# --------------------------------------------------------------------------- kelayakan (FR-TGH-07)


def test_FR_TGH_07_BR_19_setelah_semua_lunas_langsung_layak(db: Session):
    a = pabrik.anggota(db)
    t_denda, _ = _denda(db, a)  # 5.3.9
    t_ganti, _ = _penggantian(db, a, harga=40_000)  # 5.3.10
    k = peminjaman.kelayakan_anggota(db, a.id)
    assert k.alasan[0].pesan == "Anggota memiliki 2 tagihan Belum Lunas dengan total Rp60.000."

    _selesaikan(db, t_denda, "TUNAI", nominal=20_000)
    assert [x.rujukan for x in peminjaman.kelayakan_anggota(db, a.id).alasan] == ["FR-PJM-03"]

    _selesaikan(db, t_ganti, "BUKU_PENGGANTI")
    assert peminjaman.kelayakan_anggota(db, a.id) == peminjaman.Kelayakan(layak=True, alasan=[])
    baru = pabrik.eksemplar(db)
    hasil = peminjaman.konfirmasi(
        db, anggota_id=a.id, kode_eksemplar=[baru.kode], admin_id=pabrik.admin(db).id
    )
    assert len(hasil.item) == 1  # tanpa tindakan tambahan admin


def test_FR_TGH_07_lunas_tetapi_masih_ada_terlambat_tetap_tidak_layak(db: Session):
    a = pabrik.anggota(db)
    t, _ = _denda(db, a)
    _item(db, a, terlambat=3, judul="Masih Dipinjam")
    _selesaikan(db, t, "TRANSFER", nominal=20_000)
    k = peminjaman.kelayakan_anggota(db, a.id)
    assert [x.rujukan for x in k.alasan] == ["FR-PJM-04"]
    assert "'Masih Dipinjam' terlambat 3 hari" in k.alasan[0].pesan


# --------------------------------------------------------------------------- keandalan (NFR-REL-01)


def test_NFR_REL_01_galat_di_tengah_tagihan_dan_eksemplar_tidak_berubah(db: Session, monkeypatch):
    t, e = _penggantian(db, pabrik.anggota(db))

    class GagalDisengaja(Exception):
        pass

    dipanggil = []

    def gagal(*args, **kwargs):
        dipanggil.append(1)
        raise GagalDisengaja

    monkeypatch.setattr(tagihan, "_tandai_lunas", gagal)
    admin = pabrik.admin(db)
    _setup_tercommit(db)
    with pytest.raises(GagalDisengaja):
        _selesaikan(db, t, "BUKU_PENGGANTI", admin_id=admin.id)
    assert dipanggil == [1]  # setelah eksemplar diubah
    _belum_berubah(db, t)
    assert _segar(db, Eksemplar, e.id).status == "HILANG"


# --------------------------------------------------------------------------- API & akses


@pytest.fixture
def admin_masuk(client, db: Session) -> Admin:
    akun = pabrik.admin(db, nama="Admin API", password_hash=hash_password("rahasia-123"))
    r = client.post("/api/v1/auth/login", json={"email": akun.email, "password": "rahasia-123"})
    assert r.status_code == 200
    return akun


def test_TGH_alur_api_daftar_lalu_selesaikan(client, db: Session, admin_masuk):
    a = pabrik.anggota(db, nama="Budi")
    t, e = _penggantian(db, a, judul="Max Havelaar", harga=75_000)

    r = client.get(API, params={"anggota": a.kode, "status": "BELUM_LUNAS"})
    assert r.status_code == 200, r.text
    (item,) = r.json()["data"]
    assert item["anggota"] == {"kode": a.kode, "nama": "Budi"}  # tanpa NIK/kontak
    assert item["eksemplar"] == {"kode": e.kode, "judul": "Max Havelaar"}
    assert (item["jenis"], item["status"], item["nominal"]) == (
        "PENGGANTIAN",
        "BELUM_LUNAS",
        75_000,
    )

    r = client.post(
        f"{API}/{t.id}/penyelesaian",
        json={"cara": "BUKU_PENGGANTI", "tanggal": "2026-11-15"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert (body["status"], body["cara_penyelesaian"], body["admin_pengonfirmasi"]) == (
        "LUNAS",
        "BUKU_PENGGANTI",
        "Admin API",
    )
    assert _segar(db, Tagihan, t.id).admin_pengonfirmasi_id == admin_masuk.id


def test_TGH_api_galat_format_standar_dan_validasi(client, db: Session, admin_masuk):
    t, _ = _denda(db, pabrik.anggota(db))
    r = client.post(
        f"{API}/{t.id}/penyelesaian",
        json={"cara": "TUNAI", "nominal": 5_000, "tanggal": "2026-11-15"},
    )
    assert r.status_code == 422
    assert r.json()["detail"]["kode"] == "TGH_NOMINAL_TIDAK_SAMA"
    assert r.json()["detail"]["rujukan"] == "FR-TGH-02"
    assert client.get(API, params={"status": "TERLAMBAT"}).status_code == 422
    assert client.get(f"{API}/999999999").status_code == 404
    r = client.post(
        f"{API}/{t.id}/penyelesaian", json={"cara": "CICIL", "nominal": 1, "tanggal": "2026-11-15"}
    )
    assert r.status_code == 422


def test_BR_07_tagihan_hanya_admin(client, db: Session):
    a = pabrik.anggota(db, password_hash=hash_password("rahasia-123"))
    assert client.get(API).status_code == 401
    r = client.post("/api/v1/auth/login", json={"email": a.email, "password": "rahasia-123"})
    assert r.status_code == 200
    assert client.get(API).status_code == 403
    body = {"cara": "TUNAI", "nominal": 1, "tanggal": "2026-11-15"}
    assert client.post(f"{API}/1/penyelesaian", json=body).status_code == 403


def test_TGH_tidak_ada_verifikasi_bukti_maupun_pembayaran_sebagian_di_route():
    from tests.test_autentikasi import _route_aplikasi_sungguhan

    terlarang = re.compile(r"bukti|cicil|sebagian|gateway|midtrans|xendit", re.IGNORECASE)
    assert [r.path for r in _route_aplikasi_sungguhan() if terlarang.search(r.path)] == []

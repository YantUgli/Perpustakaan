"""WP 5.2.3 + 5.3.13 — laporan transaksi & tagihan (JSON): FR-LAP-02/03, OQ-07, OQ-11, OQ-37..41.

Laporan bersifat global, jadi test memastikan DB test kosong dulu lalu membuat datanya sendiri.
"""

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.core.keamanan import hash_password
from app.models import Anggota, ItemTransaksi, Tagihan
from app.services import laporan
from app.services.laporan import FilterTagihan, FilterTransaksi, StatusLaporan
from tests import pabrik

HARI_INI = date(2026, 11, 15)
API_TRX = "/api/v1/admin/laporan/transaksi"
API_TGH = "/api/v1/admin/laporan/tagihan"


@pytest.fixture(autouse=True)
def jam(atur_waktu):
    atur_waktu(datetime(2026, 11, 15, 3, 0, tzinfo=UTC))  # 10:00 WIB
    return atur_waktu


@pytest.fixture(autouse=True)
def db_kosong(db: Session):
    for model in (ItemTransaksi, Tagihan):
        jumlah = db.scalar(select(func.count()).select_from(model))
        assert jumlah == 0, f"DB test harus kosong: {model.__tablename__} berisi {jumlah} baris"


# --------------------------------------------------------------------------- pembuat data


def _item(
    db: Session,
    *,
    pinjam: date,
    status: str = "DIPINJAM",
    judul: str | None = None,
    anggota: Anggota | None = None,
) -> ItemTransaksi:
    """Item dengan tanggal pinjam tertentu; jatuh tempo = pinjam + 30 (FR-PJM-11)."""
    j = pabrik.judul(db, **({"judul": judul} if judul else {}))
    e = pabrik.eksemplar(
        db, judul_buku_id=j.id, status={"DIKEMBALIKAN": "TERSEDIA"}.get(status, status)
    )
    trx = pabrik.transaksi(db, anggota_id=(anggota or pabrik.anggota(db)).id)
    tambahan = {}
    if status == "DIKEMBALIKAN":
        tambahan = {"tanggal_kembali": pinjam + timedelta(days=40)}  # kembali terlambat
    elif status in ("HILANG", "RUSAK"):
        tambahan = {
            "tanggal_kejadian": pinjam + timedelta(days=1),
            "keterangan": "Catatan internal",
            "admin_pencatat_id": pabrik.admin(db).id,
        }
    return pabrik.item(
        db,
        transaksi_id=trx.id,
        eksemplar_id=e.id,
        tanggal_pinjam=pinjam,
        jatuh_tempo=pinjam + timedelta(days=30),
        status=status,
        **tambahan,
    )


def _tagihan(
    db: Session,
    *,
    dibentuk: date,
    jenis: str = "DENDA",
    nominal: int = 10_000,
    cara: str | None = None,
    judul: str | None = None,
    admin=None,
    anggota: Anggota | None = None,
) -> Tagihan:
    """Tagihan Belum Lunas, atau Lunas bila `cara` diisi (insert langsung; trigger hanya UPDATE)."""
    status_item = "DIKEMBALIKAN" if jenis == "DENDA" else "HILANG"
    item = _item(
        db, pinjam=dibentuk - timedelta(days=40), status=status_item, judul=judul, anggota=anggota
    )
    data = {
        "item_transaksi_id": item.id,
        "jenis": jenis,
        "nominal": nominal,
        "tanggal_dibentuk": dibentuk,
    }
    if cara:
        data |= {
            "status": "LUNAS",
            "cara_penyelesaian": cara,
            "nominal_dibayar": None if cara == "BUKU_PENGGANTI" else nominal,
            "tanggal_penyelesaian": dibentuk + timedelta(days=2),
            "admin_pengonfirmasi_id": (admin or pabrik.admin(db)).id,
        }
    return pabrik.simpan(db, pabrik.tagihan_baru(db, **data))


def _trx(db, **kw) -> list[laporan.BarisTransaksi]:
    return laporan.laporan_transaksi(db, FilterTransaksi(**kw))[0]


def _tgh(db, **kw) -> laporan.HasilTagihan:
    return laporan.laporan_tagihan(db, FilterTagihan(**kw))


def _galat(fungsi, *args, **kwargs) -> GalatBisnis:
    with pytest.raises(GalatBisnis) as info:
        fungsi(*args, **kwargs)
    return info.value


# --------------------------------------------------------------------------- FR-LAP-02 transaksi


def test_FR_LAP_02_OQ_07_OQ_38_filter_rentang_tanggal_pinjam_inklusif(db):
    for hari in (
        date(2026, 9, 30),
        date(2026, 10, 1),
        date(2026, 10, 15),
        date(2026, 10, 31),
        date(2026, 11, 1),
    ):
        _item(db, pinjam=hari, status="DIKEMBALIKAN")
    pinjam = lambda baris: [b.tanggal_pinjam.day for b in baris]  # noqa: E731
    assert pinjam(_trx(db, dari=date(2026, 10, 1), sampai=date(2026, 10, 31))) == [1, 15, 31]
    assert pinjam(_trx(db, dari=date(2026, 10, 1))) == [1, 15, 31, 1]
    assert pinjam(_trx(db, sampai=date(2026, 10, 31))) == [30, 1, 15, 31]
    assert pinjam(_trx(db, dari=date(2026, 10, 15), sampai=date(2026, 10, 15))) == [15]
    assert len(_trx(db)) == 5


@pytest.fixture
def satu_per_status(db: Session) -> dict[str, ItemTransaksi]:
    return {
        "dipinjam": _item(db, pinjam=HARI_INI - timedelta(days=5), judul="Dipinjam"),
        "tepat": _item(db, pinjam=HARI_INI - timedelta(days=30), judul="Tepat Jatuh Tempo"),
        "terlambat": _item(db, pinjam=HARI_INI - timedelta(days=31), judul="Terlambat"),
        "kembali": _item(
            db, pinjam=HARI_INI - timedelta(days=60), status="DIKEMBALIKAN", judul="Dikembalikan"
        ),
        "hilang": _item(db, pinjam=HARI_INI - timedelta(days=50), status="HILANG", judul="Hilang"),
        "rusak": _item(db, pinjam=HARI_INI - timedelta(days=45), status="RUSAK", judul="Rusak"),
    }


@pytest.mark.parametrize(
    ("status", "judul"),
    [
        (StatusLaporan.DIPINJAM, {"Dipinjam", "Tepat Jatuh Tempo"}),  # belum lewat jatuh tempo
        (StatusLaporan.TERLAMBAT, {"Terlambat"}),
        (StatusLaporan.DIKEMBALIKAN, {"Dikembalikan"}),  # walau dulu kembali terlambat
        (StatusLaporan.HILANG, {"Hilang"}),
        (StatusLaporan.RUSAK, {"Rusak"}),
    ],
)
def test_FR_LAP_02_OQ_37_filter_status_saling_lepas(db, satu_per_status, status, judul):
    assert {b.judul for b in _trx(db, status=status)} == judul


def test_FR_LAP_02_OQ_37_status_tersimpan_dan_penanda_terlambat(db, satu_per_status):
    per_judul = {b.judul: (b.status, b.terlambat) for b in _trx(db)}
    assert per_judul == {
        "Dipinjam": ("DIPINJAM", False),
        "Tepat Jatuh Tempo": ("DIPINJAM", False),
        "Terlambat": ("DIPINJAM", True),  # TERLAMBAT tidak pernah jadi nilai status
        "Dikembalikan": ("DIKEMBALIKAN", False),
        "Hilang": ("HILANG", False),
        "Rusak": ("RUSAK", False),
    }


def test_FR_LAP_02_K_07_terlambat_dihitung_wib(db, jam):
    _item(db, pinjam=HARI_INI - timedelta(days=30), judul="Jatuh Tempo Hari Ini")
    jam(datetime(2026, 11, 15, 16, 59, tzinfo=UTC))  # 15/11 23:59 WIB
    assert _trx(db, status=StatusLaporan.TERLAMBAT) == []
    jam(datetime(2026, 11, 15, 17, 0, tzinfo=UTC))  # 16/11 00:00 WIB
    assert [b.judul for b in _trx(db, status=StatusLaporan.TERLAMBAT)] == ["Jatuh Tempo Hari Ini"]
    assert _trx(db, status=StatusLaporan.DIPINJAM) == []


def test_FR_LAP_02_OQ_07_kolom_api(klien_admin, db):
    a = pabrik.anggota(db, nama="Rina Laporan")
    item = _item(db, pinjam=date(2026, 10, 1), status="DIKEMBALIKAN", judul="Bumi", anggota=a)
    r = klien_admin.get(API_TRX)
    assert r.status_code == 200, r.text
    assert r.json() == {
        "data": [
            {
                "anggota_kode": a.kode,
                "anggota_nama": "Rina Laporan",
                "judul": "Bumi",
                "kode_eksemplar": db.get(pabrik.Eksemplar, item.eksemplar_id).kode,
                "tanggal_pinjam": "2026-10-01",
                "jatuh_tempo": "2026-10-31",
                "tanggal_kembali": "2026-11-10",
                "status": "DIKEMBALIKAN",
                "terlambat": False,
            }
        ],
        "total": 1,
        "halaman": 1,
        "per_halaman": 20,
    }


def test_FR_LAP_02_OQ_41_urutan_terlama_dulu_lalu_id_dan_halaman(klien_admin, db):
    for n, hari in enumerate((20, 5, 20, 1)):
        _item(db, pinjam=date(2026, 10, hari), status="DIKEMBALIKAN", judul=f"T{n}")
    h1 = klien_admin.get(API_TRX, params={"per_halaman": 3}).json()
    h2 = klien_admin.get(API_TRX, params={"halaman": 2, "per_halaman": 3}).json()
    h9 = klien_admin.get(API_TRX, params={"halaman": 9, "per_halaman": 3}).json()
    assert [b["judul"] for b in h1["data"] + h2["data"]] == ["T3", "T1", "T0", "T2"]
    assert (h1["total"], h9["data"], h9["total"]) == (4, [], 4)


def test_FR_LAP_02_filter_lewat_api(klien_admin, db, satu_per_status):
    r = klien_admin.get(API_TRX, params={"status": "TERLAMBAT"})
    assert [b["judul"] for b in r.json()["data"]] == ["Terlambat"]
    assert r.json()["data"][0]["terlambat"] is True
    r = klien_admin.get(API_TRX, params={"status": "TIDAK_ADA"})
    assert r.status_code == 422


def test_FR_LAP_02_OQ_38_rentang_terbalik_ditolak(klien_admin, db):
    g = _galat(_trx, db, dari=date(2026, 10, 31), sampai=date(2026, 10, 1))
    assert (g.kode, g.status_code, g.rujukan) == ("LAP_RENTANG_TIDAK_VALID", 422, "FR-LAP-02")
    assert "31/10/2026" in g.pesan and "01/10/2026" in g.pesan
    r = klien_admin.get(API_TRX, params={"dari": "2026-10-31", "sampai": "2026-10-01"})
    assert r.status_code == 422
    assert r.json()["detail"]["kode"] == "LAP_RENTANG_TIDAK_VALID"


# --------------------------------------------------------------------------- FR-LAP-03 tagihan


def test_FR_LAP_03_OQ_11_OQ_38_filter_tanggal_dibentuk_inklusif(db):
    for hari in (date(2026, 9, 30), date(2026, 10, 1), date(2026, 10, 31), date(2026, 11, 1)):
        _tagihan(db, dibentuk=hari)
    hari = lambda h: [b.tanggal_dibentuk for b in h.baris]  # noqa: E731
    assert hari(_tgh(db, dari=date(2026, 10, 1), sampai=date(2026, 10, 31))) == [
        date(2026, 10, 1),
        date(2026, 10, 31),
    ]
    assert len(_tgh(db, dari=date(2026, 10, 1)).baris) == 3
    assert len(_tgh(db, sampai=date(2026, 10, 1)).baris) == 2


@pytest.fixture
def ragam_tagihan(db: Session) -> dict[str, Tagihan]:
    d = date(2026, 10, 10)
    return {
        "denda_belum": _tagihan(db, dibentuk=d, nominal=10_000),
        "denda_tunai": _tagihan(db, dibentuk=d, nominal=20_000, cara="TUNAI"),
        "denda_transfer": _tagihan(db, dibentuk=d, nominal=30_000, cara="TRANSFER"),
        "ganti_belum": _tagihan(db, dibentuk=d, jenis="PENGGANTIAN", nominal=40_000),
        "ganti_transfer": _tagihan(
            db, dibentuk=d, jenis="PENGGANTIAN", nominal=50_000, cara="TRANSFER"
        ),
        "ganti_buku": _tagihan(
            db, dibentuk=d, jenis="PENGGANTIAN", nominal=60_000, cara="BUKU_PENGGANTI"
        ),
    }


@pytest.mark.parametrize(
    ("filter_", "nama"),
    [
        ({"jenis": "DENDA"}, {"denda_belum", "denda_tunai", "denda_transfer"}),
        ({"jenis": "PENGGANTIAN"}, {"ganti_belum", "ganti_transfer", "ganti_buku"}),
        ({"status": "BELUM_LUNAS"}, {"denda_belum", "ganti_belum"}),
        ({"status": "LUNAS"}, {"denda_tunai", "denda_transfer", "ganti_transfer", "ganti_buku"}),
        ({"cara": "TUNAI"}, {"denda_tunai"}),
        ({"cara": "TRANSFER"}, {"denda_transfer", "ganti_transfer"}),
        ({"cara": "BUKU_PENGGANTI"}, {"ganti_buku"}),
        ({"jenis": "PENGGANTIAN", "status": "LUNAS", "cara": "TRANSFER"}, {"ganti_transfer"}),
        ({"status": "BELUM_LUNAS", "cara": "TUNAI"}, set()),
    ],
)
def test_FR_LAP_03_filter_jenis_status_cara(db, ragam_tagihan, filter_, nama):
    h = _tgh(db, **filter_)
    assert {b.id for b in h.baris} == {ragam_tagihan[n].id for n in nama}
    assert h.jumlah == len(nama)
    assert h.total_nominal == sum(ragam_tagihan[n].nominal for n in nama)


def test_FR_LAP_03_total_nominal_seluruh_baris_bukan_halaman(klien_admin, db, ragam_tagihan):
    r = klien_admin.get(API_TGH, params={"per_halaman": 2, "halaman": 2})
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d["data"]) == 2
    assert (d["total"], d["total_nominal"]) == (6, 210_000)
    assert isinstance(d["total_nominal"], int)


def test_FR_LAP_03_tanpa_hasil_total_nol(klien_admin, db):
    d = klien_admin.get(API_TGH, params={"status": "LUNAS"}).json()
    assert (d["data"], d["total"], d["total_nominal"]) == ([], 0, 0)


def test_FR_LAP_03_OQ_39_kolom_api_dan_urutan(klien_admin, db):
    admin = pabrik.admin(db, nama="Admin Kasir")
    a = pabrik.anggota(db, nama="Budi Laporan")
    t2 = _tagihan(db, dibentuk=date(2026, 10, 5), nominal=7_000, anggota=a)
    t1 = _tagihan(
        db,
        dibentuk=date(2026, 10, 2),
        jenis="PENGGANTIAN",
        nominal=99_999,
        cara="TRANSFER",
        judul="Laut Bercerita",
        admin=admin,
        anggota=a,
    )
    t3 = _tagihan(db, dibentuk=date(2026, 10, 5), nominal=8_000, anggota=a)
    d = klien_admin.get(API_TGH).json()
    assert [b["id"] for b in d["data"]] == [t1.id, t2.id, t3.id]  # OQ-41: terlama, lalu id
    item = db.get(ItemTransaksi, t1.item_transaksi_id)
    assert d["data"][0] == {
        "id": t1.id,
        "tanggal_dibentuk": "2026-10-02",
        "anggota_kode": a.kode,
        "anggota_nama": "Budi Laporan",
        "judul": "Laut Bercerita",
        "kode_eksemplar": db.get(pabrik.Eksemplar, item.eksemplar_id).kode,
        "jenis": "PENGGANTIAN",
        "nominal": 99_999,
        "status": "LUNAS",
        "cara_penyelesaian": "TRANSFER",
        "tanggal_penyelesaian": "2026-10-04",
        "admin_pengonfirmasi": "Admin Kasir",
    }
    assert d["data"][1]["admin_pengonfirmasi"] is None
    assert d["total_nominal"] == 99_999 + 7_000 + 8_000


def test_FR_LAP_03_filter_lewat_api(klien_admin, db, ragam_tagihan):
    d = klien_admin.get(
        API_TGH, params={"jenis": "PENGGANTIAN", "status": "LUNAS", "cara": "BUKU_PENGGANTI"}
    ).json()
    assert [b["id"] for b in d["data"]] == [ragam_tagihan["ganti_buku"].id]
    assert d["total_nominal"] == 60_000


def test_FR_LAP_03_OQ_38_rentang_terbalik_ditolak(klien_admin, db):
    g = _galat(_tgh, db, dari=date(2026, 11, 2), sampai=date(2026, 11, 1))
    assert (g.kode, g.status_code, g.rujukan) == ("LAP_RENTANG_TIDAK_VALID", 422, "FR-LAP-03")
    assert "02/11/2026" in g.pesan and "01/11/2026" in g.pesan
    r = klien_admin.get(API_TGH, params={"dari": "2026-11-02", "sampai": "2026-11-01"})
    assert r.json()["detail"]["rujukan"] == "FR-LAP-03"


@pytest.mark.parametrize("params", [{"halaman": 0}, {"per_halaman": 101}, {"dari": "31-10-2026"}])
@pytest.mark.parametrize("api", [API_TRX, API_TGH])
def test_FR_LAP_02_03_parameter_tidak_valid_422(klien_admin, api, params):
    r = klien_admin.get(api, params=params)
    assert r.status_code == 422
    assert r.json()["detail"]["kode"] == "VALIDASI_ISIAN"


# --------------------------------------------------------------------------- akses (NFR-SEC-03)

PATH_LAPORAN = [
    API_TRX,
    API_TGH,
    f"{API_TRX}/ekspor?format=pdf",
    f"{API_TGH}/ekspor?format=xlsx",
]


@pytest.mark.parametrize("path", PATH_LAPORAN)
def test_NFR_SEC_03_laporan_tanpa_login_401(client, path):
    assert client.get(path).status_code == 401


@pytest.mark.parametrize("path", PATH_LAPORAN)
def test_NFR_SEC_03_laporan_anggota_403(client, db, path):
    a = pabrik.anggota(
        db,
        email=f"agt{uuid.uuid4().hex[:10]}@perpus.example",
        password_hash=hash_password("rahasia-123"),
    )
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": a.email, "password": "rahasia-123"}
        ).status_code
        == 200
    )
    r = client.get(path)
    assert r.status_code == 403
    assert r.json()["detail"]["kode"] == "AKN_KHUSUS_ADMIN"

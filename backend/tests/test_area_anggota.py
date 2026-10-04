"""WP 5.3.12 — area anggota: FR-AGT-01..05, NFR-SEC-03, K-07, OQ-34..36.

Setiap test membuat data untuk anggota lain (B) juga, sehingga query yang kehilangan filter
`anggota_id` ikut ketahuan. Email test memakai domain `.example` (decisions.md §B).
"""

import uuid
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.routing import APIRoute
from sqlalchemy.orm import Session

from app.api.v1.anggota import area
from app.core.keamanan import hash_password
from app.models import Anggota, Tagihan
from app.models.status import CaraPenyelesaian, StatusItem
from app.services import hilang_rusak, peminjaman, pengembalian
from app.services import tagihan as layanan_tagihan
from tests import pabrik

HARI_INI = date(2026, 11, 15)
API = "/api/v1/anggota"
PASSWORD = "rahasia-123"
ENDPOINT = ["/qr", "/kelayakan", "/pinjaman", "/riwayat", "/tagihan"]


@pytest.fixture
def jam(atur_waktu) -> Callable[[datetime], None]:
    atur_waktu(datetime(2026, 11, 15, 3, 0, tzinfo=UTC))  # 10:00 WIB
    return atur_waktu


@pytest.fixture(autouse=True)
def _jam_bawaan(jam):
    """Semua test di modul ini memakai jam terpatok."""


# --------------------------------------------------------------------------- pembuat data


def _anggota(db: Session, **kw) -> Anggota:
    email = f"agt{uuid.uuid4().hex[:10]}@perpus.example"
    return pabrik.anggota(db, email=email, password_hash=hash_password(PASSWORD), **kw)


def _login(client, a: Anggota) -> None:
    r = client.post("/api/v1/auth/login", json={"email": a.email, "password": PASSWORD})
    assert r.status_code == 200, r.text


@pytest.fixture
def b(db: Session) -> Anggota:
    """Anggota lain, dibuat lebih dulu (id lebih kecil) dan punya data di semua area."""
    lain = _anggota(db, nama="Budi Lain")
    _item(db, lain, jatuh_tempo=HARI_INI - timedelta(days=4), judul="Milik B Terlambat")
    _item(db, lain, jatuh_tempo=HARI_INI + timedelta(days=9), judul="Milik B Dipinjam")
    _item(db, lain, status="DIKEMBALIKAN", judul="Milik B Kembali")
    _item(db, lain, status="HILANG", judul="Milik B Hilang")
    _denda(db, lain, judul="Milik B Denda")
    return lain


@pytest.fixture
def saya(client, db: Session, b: Anggota) -> Anggota:
    """Anggota A yang login lewat `client`. Data B sudah ada di DB."""
    a = _anggota(db, nama="Ani Saya")
    _login(client, a)
    return a


def _item(
    db: Session,
    anggota: Anggota,
    *,
    jatuh_tempo: date = HARI_INI + timedelta(days=10),
    status: str = "DIPINJAM",
    judul: str = "Buku Uji",
    harga: int = 100_000,
):
    tanggal_pinjam = jatuh_tempo - timedelta(days=30)
    j = pabrik.judul(db, judul=judul, harga=harga)
    status_eks = {"DIKEMBALIKAN": "TERSEDIA"}.get(status, status)
    e = pabrik.eksemplar(db, judul_buku_id=j.id, status=status_eks)
    trx = pabrik.transaksi(db, anggota_id=anggota.id)
    tambahan = {}
    if status == "DIKEMBALIKAN":
        tambahan = {"tanggal_kembali": tanggal_pinjam + timedelta(days=3)}
    elif status in ("HILANG", "RUSAK"):
        tambahan = {
            "tanggal_kejadian": tanggal_pinjam + timedelta(days=2),
            "keterangan": "Catatan internal admin",
            "admin_pencatat_id": pabrik.admin(db).id,
        }
    item = pabrik.item(
        db,
        transaksi_id=trx.id,
        eksemplar_id=e.id,
        tanggal_pinjam=tanggal_pinjam,
        jatuh_tempo=jatuh_tempo,
        status=status,
        **tambahan,
    )
    return item, e


def _denda(db: Session, anggota: Anggota, *, terlambat: int = 8, **kw) -> Tagihan:
    """Tagihan Denda lewat pengembalian terlambat (5.3.9). 8 hari × Rp100.000 → Rp20.000."""
    _, e = _item(db, anggota, jatuh_tempo=HARI_INI - timedelta(days=terlambat), **kw)
    h = pengembalian.konfirmasi(db, kode_eksemplar=e.kode)
    return db.get(Tagihan, h.tagihan.id)


def _penggantian(db: Session, anggota: Anggota, *, harga: int = 75_000, **kw) -> Tagihan:
    """Tagihan Penggantian lewat pencatatan hilang (5.3.10)."""
    item, _ = _item(db, anggota, harga=harga, **kw)
    h = hilang_rusak.catat(
        db,
        item_id=item.id,
        jenis=StatusItem.HILANG,
        tanggal_kejadian=item.tanggal_pinjam,
        keterangan="Laporan lisan",
        admin_id=pabrik.admin(db).id,
    )
    return db.get(Tagihan, h.tagihan.id)


def _selesaikan(db: Session, t: Tagihan, cara: str, nominal: int | None = None) -> None:
    layanan_tagihan.selesaikan(
        db,
        t.id,
        cara=CaraPenyelesaian(cara),
        nominal=nominal,
        tanggal=HARI_INI,
        admin_id=pabrik.admin(db).id,
    )


def _ok(r):
    assert r.status_code == 200, r.text
    return r.json()


# --------------------------------------------------------------------------- FR-AGT-01 QR


def test_FR_AGT_01_qr_berisi_kode_dan_nama_sendiri(client, saya):
    assert _ok(client.get(f"{API}/qr")) == {
        "kode": saya.kode,
        "nama": "Ani Saya",
        "isi_qr": saya.kode,  # isi QR = ID anggota (BR-04), teks polos
    }  # tanpa NIK, foto, email, telepon


# ------------------------------------------------------------------- FR-AGT-02 pinjaman aktif


def test_FR_AGT_02_pinjaman_aktif_sisa_hari_dan_jatuh_tempo(client, db, saya):
    _, e = _item(db, saya, jatuh_tempo=HARI_INI + timedelta(days=5), judul="Laskar Pelangi")
    assert _ok(client.get(f"{API}/pinjaman")) == [
        {
            "kode_eksemplar": e.kode,
            "judul": "Laskar Pelangi",
            "tanggal_pinjam": (HARI_INI - timedelta(days=25)).isoformat(),
            "jatuh_tempo": (HARI_INI + timedelta(days=5)).isoformat(),
            "sisa_hari": 5,
            "terlambat": False,
            "hari_terlambat": 0,
        }
    ]


def test_FR_AGT_02_OQ_34_tepat_jatuh_tempo_tidak_terlambat(client, db, saya):
    _item(db, saya, jatuh_tempo=HARI_INI)
    [p] = _ok(client.get(f"{API}/pinjaman"))
    assert (p["sisa_hari"], p["terlambat"], p["hari_terlambat"]) == (0, False, 0)


def test_FR_AGT_02_OQ_34_lewat_satu_hari_terlambat(client, db, saya):
    _item(db, saya, jatuh_tempo=HARI_INI - timedelta(days=1))
    [p] = _ok(client.get(f"{API}/pinjaman"))
    assert (p["sisa_hari"], p["terlambat"], p["hari_terlambat"]) == (0, True, 1)


def test_FR_AGT_02_FR_DND_06_tetap_terlambat_setelah_plafon(client, db, saya):
    _item(db, saya, jatuh_tempo=HARI_INI - timedelta(days=80))
    [p] = _ok(client.get(f"{API}/pinjaman"))
    assert (p["sisa_hari"], p["terlambat"], p["hari_terlambat"]) == (0, True, 80)


def test_FR_AGT_02_K_07_hari_dihitung_dalam_wib(client, db, saya, jam):
    _item(db, saya, jatuh_tempo=HARI_INI)
    jam(datetime(2026, 11, 15, 16, 59, tzinfo=UTC))  # 15/11 23:59 WIB
    _login(client, saya)  # login ulang: sesi 03:00 UTC sudah menganggur > 8 jam (NFR-SEC-04)
    [p] = _ok(client.get(f"{API}/pinjaman"))
    assert (p["sisa_hari"], p["terlambat"], p["hari_terlambat"]) == (0, False, 0)
    jam(datetime(2026, 11, 15, 17, 0, tzinfo=UTC))  # masih 15/11 di UTC, sudah 16/11 00:00 WIB
    [p] = _ok(client.get(f"{API}/pinjaman"))
    assert (p["sisa_hari"], p["terlambat"], p["hari_terlambat"]) == (0, True, 1)


def test_FR_AGT_02_hanya_item_dipinjam_urut_jatuh_tempo(client, db, saya):
    _item(db, saya, jatuh_tempo=HARI_INI + timedelta(days=7), judul="Kedua")
    _item(db, saya, jatuh_tempo=HARI_INI - timedelta(days=2), judul="Pertama")
    _item(db, saya, status="DIKEMBALIKAN", judul="Sudah Kembali")
    _item(db, saya, status="HILANG", judul="Hilang")
    _item(db, saya, status="RUSAK", judul="Rusak")
    data = _ok(client.get(f"{API}/pinjaman"))
    assert [p["judul"] for p in data] == ["Pertama", "Kedua"]


# --------------------------------------------------------------------------- FR-AGT-03 riwayat


def test_FR_AGT_03_OQ_35_riwayat_memuat_hilang_rusak_dan_dikembalikan(client, db, saya):
    tgl = HARI_INI + timedelta(days=10)
    _, e_pinjam = _item(db, saya, jatuh_tempo=tgl, judul="Masih Dipinjam")
    _, e_telat = _item(db, saya, jatuh_tempo=tgl - timedelta(days=11), judul="Telat")
    _, e_kembali = _item(db, saya, jatuh_tempo=tgl - timedelta(days=12), status="DIKEMBALIKAN")
    _, e_hilang = _item(db, saya, jatuh_tempo=tgl - timedelta(days=13), status="HILANG")
    _, e_rusak = _item(db, saya, jatuh_tempo=tgl - timedelta(days=14), status="RUSAK")

    hasil = _ok(client.get(f"{API}/riwayat"))
    assert hasil["total"] == 5
    per_kode = {i["kode_eksemplar"]: i for i in hasil["data"]}
    semua = (e_pinjam, e_telat, e_kembali, e_hilang, e_rusak)
    assert set(per_kode) == {e.kode for e in semua}
    for i in hasil["data"]:
        assert set(i) == {
            "kode_eksemplar",
            "judul",
            "tanggal_pinjam",
            "jatuh_tempo",
            "tanggal_kembali",
            "status",
            "terlambat",
            "tanggal_kejadian",
        }  # tanpa keterangan & admin pencatat (OQ-35)
        # tak pernah TERLAMBAT sebagai status
        assert i["status"] in {"DIPINJAM", "DIKEMBALIKAN", "HILANG", "RUSAK"}

    assert (per_kode[e_pinjam.kode]["status"], per_kode[e_pinjam.kode]["terlambat"]) == (
        "DIPINJAM",
        False,
    )
    assert (per_kode[e_telat.kode]["status"], per_kode[e_telat.kode]["terlambat"]) == (
        "DIPINJAM",
        True,
    )
    kembali = per_kode[e_kembali.kode]
    assert kembali["status"] == "DIKEMBALIKAN"
    assert kembali["tanggal_kembali"] == (tgl - timedelta(days=12 + 27)).isoformat()
    assert kembali["terlambat"] is False
    assert kembali["tanggal_kejadian"] is None
    for e, status, mundur in ((e_hilang, "HILANG", 13), (e_rusak, "RUSAK", 14)):
        x = per_kode[e.kode]
        assert x["status"] == status
        assert x["terlambat"] is False  # BR-15: kewajiban beralih ke tagihan penggantian
        assert x["tanggal_kembali"] is None
        assert x["tanggal_kejadian"] == (tgl - timedelta(days=mundur + 28)).isoformat()


def test_FR_AGT_03_riwayat_urutan_terbaru_dan_halaman(client, db, saya):
    for n, mundur in enumerate((20, 0, 10)):  # urutan sisip sengaja acak
        _item(db, saya, jatuh_tempo=HARI_INI - timedelta(days=mundur), judul=f"R{n}")
    _item(db, saya, jatuh_tempo=HARI_INI, judul="R3")  # tanggal pinjam sama dengan R1 → id

    h1 = _ok(client.get(f"{API}/riwayat", params={"halaman": 1, "per_halaman": 3}))
    h2 = _ok(client.get(f"{API}/riwayat", params={"halaman": 2, "per_halaman": 3}))
    h9 = _ok(client.get(f"{API}/riwayat", params={"halaman": 9, "per_halaman": 3}))
    assert [i["judul"] for i in h1["data"]] == ["R3", "R1", "R2"]
    assert [i["judul"] for i in h2["data"]] == ["R0"]
    assert (h1["total"], h1["halaman"], h1["per_halaman"]) == (4, 1, 3)
    assert (h9["data"], h9["total"]) == ([], 4)


@pytest.mark.parametrize("params", [{"halaman": 0}, {"per_halaman": 0}, {"per_halaman": 101}])
@pytest.mark.parametrize("path", ["/riwayat", "/tagihan"])
def test_FR_AGT_03_04_batas_halaman_ditolak(client, saya, path, params):
    r = client.get(f"{API}{path}", params=params)
    assert r.status_code == 422
    assert r.json()["detail"]["kode"] == "VALIDASI_ISIAN"


# --------------------------------------------------------------------------- FR-AGT-04 tagihan


def test_FR_AGT_04_OQ_36_tagihan_jenis_nominal_status_cara(client, db, saya):
    t_belum = _denda(db, saya, judul="Denda Belum")
    t_tunai = _denda(db, saya, terlambat=15, judul="Denda Tunai")
    _selesaikan(db, t_tunai, "TUNAI", nominal=30_000)
    t_ganti = _penggantian(db, saya, harga=75_000, judul="Ganti Buku")
    _selesaikan(db, t_ganti, "BUKU_PENGGANTI")

    hasil = _ok(client.get(f"{API}/tagihan"))
    assert hasil["total"] == 3
    per_id = {t["id"]: t for t in hasil["data"]}
    assert set(per_id) == {t_belum.id, t_tunai.id, t_ganti.id}
    for t in hasil["data"]:
        assert set(t) == {
            "id",
            "jenis",
            "nominal",
            "status",
            "cara_penyelesaian",
            "tanggal_dibentuk",
            "tanggal_penyelesaian",
            "kode_eksemplar",
            "judul",
        }  # tanpa admin pengonfirmasi & nominal_dibayar (OQ-36)

    belum = per_id[t_belum.id]
    assert (belum["jenis"], belum["nominal"], belum["status"], belum["cara_penyelesaian"]) == (
        "DENDA",
        20_000,
        "BELUM_LUNAS",
        None,
    )
    assert belum["judul"] == "Denda Belum"
    assert belum["tanggal_dibentuk"] == HARI_INI.isoformat()
    assert belum["tanggal_penyelesaian"] is None
    tunai = per_id[t_tunai.id]
    assert (tunai["jenis"], tunai["nominal"], tunai["status"], tunai["cara_penyelesaian"]) == (
        "DENDA",
        30_000,
        "LUNAS",
        "TUNAI",
    )
    assert tunai["tanggal_penyelesaian"] == HARI_INI.isoformat()
    ganti = per_id[t_ganti.id]
    assert (ganti["jenis"], ganti["nominal"], ganti["status"], ganti["cara_penyelesaian"]) == (
        "PENGGANTIAN",
        75_000,
        "LUNAS",
        "BUKU_PENGGANTI",
    )


def test_FR_AGT_04_tagihan_urutan_dan_halaman(client, db, saya):
    ids = [_denda(db, saya).id for _ in range(3)]  # tanggal dibentuk sama → id terbaru dulu
    h1 = _ok(client.get(f"{API}/tagihan", params={"per_halaman": 2}))
    h2 = _ok(client.get(f"{API}/tagihan", params={"halaman": 2, "per_halaman": 2}))
    assert [t["id"] for t in h1["data"] + h2["data"]] == ids[::-1]
    assert h1["total"] == 3


# --------------------------------------------------------------------------- FR-AGT-05 kelayakan


def test_FR_AGT_05_layak_tanpa_alasan(client, saya):
    assert _ok(client.get(f"{API}/kelayakan")) == {"layak": True, "alasan": []}


def test_FR_AGT_05_terblokir_tagihan_menyebut_jumlah_dan_total(client, db, saya):
    _denda(db, saya)
    _penggantian(db, saya, harga=40_000)
    assert _ok(client.get(f"{API}/kelayakan")) == {
        "layak": False,
        "alasan": [
            {
                "kode": "PJM_ADA_TAGIHAN",
                "pesan": "Anggota memiliki 2 tagihan Belum Lunas dengan total Rp60.000.",
                "rujukan": "FR-PJM-03",
            }
        ],
    }


def test_FR_AGT_05_terblokir_item_terlambat_menyebut_judul_dan_hari(client, db, saya):
    _item(db, saya, jatuh_tempo=HARI_INI - timedelta(days=3), judul="Bumi Manusia")
    k = _ok(client.get(f"{API}/kelayakan"))
    assert k["layak"] is False
    assert [a["kode"] for a in k["alasan"]] == ["PJM_ADA_TERLAMBAT"]
    assert "'Bumi Manusia' terlambat 3 hari" in k["alasan"][0]["pesan"]
    assert k["alasan"][0]["rujukan"] == "FR-PJM-04"


def test_FR_AGT_05_sama_dengan_kelayakan_yang_dilihat_admin(client, db, saya):
    _denda(db, saya)
    _item(db, saya, jatuh_tempo=HARI_INI - timedelta(days=5), judul="Terlambat Juga")
    k = peminjaman.kelayakan_anggota(db, saya.id)
    assert _ok(client.get(f"{API}/kelayakan")) == {
        "layak": False,
        "alasan": [{"kode": a.kode, "pesan": a.pesan, "rujukan": a.rujukan} for a in k.alasan],
    }
    assert len(k.alasan) == 2


def test_FR_AGT_05_FR_TGH_07_layak_lagi_setelah_lunas(client, db, saya):
    t_denda = _denda(db, saya)  # 5.3.9
    t_ganti = _penggantian(db, saya, harga=40_000)  # 5.3.10
    assert _ok(client.get(f"{API}/kelayakan"))["layak"] is False

    _selesaikan(db, t_denda, "TRANSFER", nominal=20_000)  # 5.3.11
    k = _ok(client.get(f"{API}/kelayakan"))
    assert [a["pesan"] for a in k["alasan"]] == [
        "Anggota memiliki 1 tagihan Belum Lunas dengan total Rp40.000."
    ]

    _selesaikan(db, t_ganti, "BUKU_PENGGANTI")
    assert _ok(client.get(f"{API}/kelayakan")) == {"layak": True, "alasan": []}


# --------------------------------------------------------------------------- NFR-SEC-03 akses


def test_NFR_SEC_03_anggota_A_tidak_melihat_data_B(client, db, saya, b):
    """A juga punya data; hasil harus persis milik A di kelima endpoint."""
    _, e_a = _item(db, saya, jatuh_tempo=HARI_INI + timedelta(days=3), judul="Milik A")
    _item(db, saya, status="RUSAK", judul="Milik A Rusak")
    t_a = _penggantian(db, saya, harga=50_000, judul="Milik A Ganti")
    _selesaikan(db, t_a, "TUNAI", nominal=50_000)

    assert _ok(client.get(f"{API}/qr"))["kode"] == saya.kode
    assert _ok(client.get(f"{API}/kelayakan")) == {"layak": True, "alasan": []}  # B terblokir
    assert [p["kode_eksemplar"] for p in _ok(client.get(f"{API}/pinjaman"))] == [e_a.kode]
    riwayat = _ok(client.get(f"{API}/riwayat"))
    assert sorted(i["judul"] for i in riwayat["data"]) == [
        "Milik A",
        "Milik A Ganti",
        "Milik A Rusak",
    ]
    assert riwayat["total"] == 3
    tagihan = _ok(client.get(f"{API}/tagihan"))
    assert ([t["id"] for t in tagihan["data"]], tagihan["total"]) == ([t_a.id], 1)

    # pembanding: B memang punya data di setiap area
    assert peminjaman.kelayakan_anggota(db, b.id).layak is False


def test_NFR_SEC_03_anggota_tanpa_data_melihat_daftar_kosong(client, saya):
    assert _ok(client.get(f"{API}/pinjaman")) == []
    assert _ok(client.get(f"{API}/riwayat"))["total"] == 0
    assert _ok(client.get(f"{API}/tagihan"))["total"] == 0


def test_NFR_SEC_03_parameter_anggota_di_query_diabaikan(client, saya, b):
    for path in ENDPOINT:
        biasa = _ok(client.get(f"{API}{path}"))
        coba = _ok(
            client.get(
                f"{API}{path}",
                params={"anggota_id": b.id, "id": b.id, "kode": b.kode, "anggota": b.kode},
            )
        )
        assert coba == biasa, path


def test_NFR_SEC_03_endpoint_area_hanya_get_tanpa_body_dan_tanpa_parameter_anggota():
    rute = [r for r in area.router.routes if isinstance(r, APIRoute)]
    assert sorted(r.path for r in rute) == sorted(ENDPOINT)
    for r in rute:
        assert r.methods == {"GET"}, r.path
        assert r.body_field is None, r.path
        assert not r.dependant.path_params, r.path
        assert {p.name for p in r.dependant.query_params} <= {"halaman", "per_halaman"}, r.path


@pytest.mark.parametrize("path", ENDPOINT)
def test_NFR_SEC_03_tanpa_login_401(client, path):
    r = client.get(f"{API}{path}")
    assert r.status_code == 401


@pytest.mark.parametrize("path", ENDPOINT)
def test_NFR_SEC_03_admin_ditolak_403(klien_admin, path):
    r = klien_admin.get(f"{API}{path}")
    assert r.status_code == 403
    assert r.json()["detail"]["kode"] == "AKN_KHUSUS_ANGGOTA"

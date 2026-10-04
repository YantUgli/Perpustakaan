"""WP 5.2.3 + 5.3.13 — dashboard admin: FR-LAP-01, OQ-40, K-07, NFR-SEC-03.

Angka dashboard bersifat global, jadi test memastikan DB test kosong dulu (`test_seed.py` juga
mengandalkan ini) lalu memakai data seed deterministik yang angkanya diketahui.
"""

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.keamanan import hash_password
from app.models import Anggota, Eksemplar, ItemTransaksi, JudulBuku, Tagihan
from app.seed.data_uji import seed_data_uji
from app.services import laporan
from tests import pabrik

HARI_INI = date(2026, 11, 15)
API = "/api/v1/admin/dashboard"
# Data seed deterministik (random seed 5221): 60 judul, 205 eksemplar = 195 Tersedia + 10 Rusak.
SEED_JUDUL, SEED_TERSEDIA, SEED_RUSAK = 60, 195, 10


@pytest.fixture(autouse=True)
def jam(atur_waktu):
    atur_waktu(datetime(2026, 11, 15, 3, 0, tzinfo=UTC))  # 10:00 WIB
    return atur_waktu


@pytest.fixture(autouse=True)
def db_kosong(db: Session):
    for model in (JudulBuku, Eksemplar, Anggota, ItemTransaksi, Tagihan):
        jumlah = db.scalar(select(func.count()).select_from(model))
        assert jumlah == 0, f"DB test harus kosong: {model.__tablename__} berisi {jumlah} baris"


def _pinjam(db: Session, e: Eksemplar, anggota: Anggota, *, jatuh_tempo: date, status="DIPINJAM"):
    trx = pabrik.transaksi(db, anggota_id=anggota.id)
    tambahan = {}
    if status == "DIKEMBALIKAN":
        tambahan = {"tanggal_kembali": jatuh_tempo - timedelta(days=1)}
    elif status in ("HILANG", "RUSAK"):
        tambahan = {
            "tanggal_kejadian": jatuh_tempo - timedelta(days=20),
            "keterangan": "Laporan lisan",
            "admin_pencatat_id": pabrik.admin(db).id,
        }
    e.status = {"DIKEMBALIKAN": "TERSEDIA"}.get(status, status)
    return pabrik.item(
        db,
        transaksi_id=trx.id,
        eksemplar_id=e.id,
        tanggal_pinjam=jatuh_tempo - timedelta(days=30),
        jatuh_tempo=jatuh_tempo,
        status=status,
        **tambahan,
    )


def _tagihan(db: Session, item: ItemTransaksi, jenis: str, nominal: int, *, lunas: bool = False):
    data = {"item_transaksi_id": item.id, "jenis": jenis, "nominal": nominal}
    if lunas:
        data |= {
            "status": "LUNAS",
            "cara_penyelesaian": "TUNAI",
            "nominal_dibayar": nominal,
            "tanggal_penyelesaian": pabrik.TGL,
            "admin_pengonfirmasi_id": pabrik.admin(db).id,
        }
    return pabrik.simpan(db, pabrik.tagihan_baru(db, **data))


def _dashboard_seed_dan_transaksi(db: Session) -> None:
    """Seed + transaksi yang diketahui; data dibuat langsung agar angkanya terkendali."""
    r = seed_data_uji(db, app_env="dev")
    assert (r.judul, r.eksemplar) == (SEED_JUDUL, SEED_TERSEDIA + SEED_RUSAK)
    tersedia = list(
        db.scalars(select(Eksemplar).where(Eksemplar.status == "TERSEDIA").order_by(Eksemplar.id))
    )
    a1, a2, a3 = (pabrik.anggota(db) for _ in range(3))
    _pinjam(db, tersedia[0], a1, jatuh_tempo=HARI_INI + timedelta(days=5))
    _pinjam(db, tersedia[1], a1, jatuh_tempo=HARI_INI)  # tepat jatuh tempo: belum terlambat
    _pinjam(db, tersedia[2], a2, jatuh_tempo=HARI_INI - timedelta(days=1))  # terlambat
    _pinjam(db, tersedia[3], a2, jatuh_tempo=HARI_INI - timedelta(days=90))  # terlambat > plafon
    kembali_lunas = _pinjam(
        db, tersedia[4], a3, jatuh_tempo=HARI_INI - timedelta(days=9), status="DIKEMBALIKAN"
    )
    kembali_belum = _pinjam(
        db, tersedia[5], a3, jatuh_tempo=HARI_INI - timedelta(days=8), status="DIKEMBALIKAN"
    )
    hilang = _pinjam(db, tersedia[6], a3, jatuh_tempo=HARI_INI - timedelta(days=2), status="HILANG")
    _tagihan(db, kembali_lunas, "DENDA", 20_000, lunas=True)  # Lunas: tidak dihitung
    _tagihan(db, kembali_belum, "DENDA", 15_555)
    _tagihan(db, hilang, "PENGGANTIAN", 75_000)


def test_FR_LAP_01_OQ_40_angka_cocok_dengan_data_seed(klien_admin, db):
    _dashboard_seed_dan_transaksi(db)
    r = klien_admin.get(API)
    assert r.status_code == 200, r.text
    assert r.json() == {
        "jumlah_judul": SEED_JUDUL,
        "eksemplar_per_status": {
            "TERSEDIA": SEED_TERSEDIA - 5,  # 4 dipinjam + 1 hilang; 2 dikembalikan kembali Tersedia
            "DIPINJAM": 4,
            "HILANG": 1,
            "RUSAK": SEED_RUSAK,
        },
        "jumlah_anggota": 3,
        "item_dipinjam": 4,  # termasuk yang terlambat (OQ-40, sama dengan BR-08)
        "item_terlambat": 2,
        "tagihan_belum_lunas_jumlah": 2,
        "tagihan_belum_lunas_total": 15_555 + 75_000,
    }


def test_FR_LAP_01_eksemplar_per_status_termasuk_nol(klien_admin, db):
    r = klien_admin.get(API)
    assert r.json() == {
        "jumlah_judul": 0,
        "eksemplar_per_status": {"TERSEDIA": 0, "DIPINJAM": 0, "HILANG": 0, "RUSAK": 0},
        "jumlah_anggota": 0,
        "item_dipinjam": 0,
        "item_terlambat": 0,
        "tagihan_belum_lunas_jumlah": 0,
        "tagihan_belum_lunas_total": 0,
    }


def test_FR_LAP_01_tepat_jatuh_tempo_tidak_terlambat(db):
    e = pabrik.eksemplar(db)
    _pinjam(db, e, pabrik.anggota(db), jatuh_tempo=HARI_INI)
    d = laporan.dashboard(db)
    assert (d.item_dipinjam, d.item_terlambat) == (1, 0)


def test_FR_LAP_01_K_07_terlambat_dihitung_wib(db, jam):
    e = pabrik.eksemplar(db)
    _pinjam(db, e, pabrik.anggota(db), jatuh_tempo=HARI_INI)
    jam(datetime(2026, 11, 15, 16, 59, tzinfo=UTC))  # 15/11 23:59 WIB
    assert laporan.dashboard(db).item_terlambat == 0
    jam(datetime(2026, 11, 15, 17, 0, tzinfo=UTC))  # masih 15/11 di UTC, sudah 16/11 WIB
    assert laporan.dashboard(db).item_terlambat == 1


def test_FR_LAP_01_hilang_rusak_dikembalikan_bukan_item_dipinjam(db):
    a = pabrik.anggota(db)
    lewat = HARI_INI - timedelta(days=10)
    for status in ("DIKEMBALIKAN", "HILANG", "RUSAK"):
        _pinjam(db, pabrik.eksemplar(db), a, jatuh_tempo=lewat, status=status)
    d = laporan.dashboard(db)
    assert (d.item_dipinjam, d.item_terlambat) == (0, 0)


def test_FR_LAP_01_tagihan_lunas_tidak_dihitung(db):
    a = pabrik.anggota(db)
    item = _pinjam(db, pabrik.eksemplar(db), a, jatuh_tempo=HARI_INI, status="DIKEMBALIKAN")
    _tagihan(db, item, "DENDA", 30_000, lunas=True)
    d = laporan.dashboard(db)
    assert (d.tagihan_belum_lunas_jumlah, d.tagihan_belum_lunas_total) == (0, 0)


# --------------------------------------------------------------------------- akses (NFR-SEC-03)


def test_NFR_SEC_03_dashboard_tanpa_login_401(client):
    assert client.get(API).status_code == 401


def test_NFR_SEC_03_dashboard_anggota_403(client, db):
    a = pabrik.anggota(
        db,
        email=f"agt{uuid.uuid4().hex[:10]}@perpus.example",
        password_hash=hash_password("rahasia-123"),
    )
    r = client.post("/api/v1/auth/login", json={"email": a.email, "password": "rahasia-123"})
    assert r.status_code == 200
    r = client.get(API)
    assert r.status_code == 403
    assert r.json()["detail"]["kode"] == "AKN_KHUSUS_ADMIN"

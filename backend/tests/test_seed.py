"""WP 5.2.2 — seed admin awal (FR-AKN-12, K-04, OQ-14) dan data uji/performa (OQ-15, NFR-PRF-01)."""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, delete, func, select

from app.core.config import Settings
from app.core.keamanan import verifikasi_password
from app.models import Admin, Eksemplar, JudulBuku, Kategori, Rak
from app.seed.admin import GalatSeed, HasilSeedAdmin, seed_admin
from app.seed.data_uji import seed_data_uji, seed_performa
from tests import pabrik as p
from tests.conftest import DATABASE_URL_TEST

BACKEND = Path(__file__).resolve().parents[1]
PASSWORD = "Rahasia-Uji-123"


def _jumlah(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


# --- Seed admin -----------------------------------------------------------------------------


def test_FR_AKN_12_seed_admin_dari_env(db):
    hasil = seed_admin(db, nama="Admin Utama", email="kepala@perpus.example", password=PASSWORD)
    assert hasil is HasilSeedAdmin.DIBUAT
    admin = db.scalars(select(Admin).where(Admin.email == "kepala@perpus.example")).one()
    assert admin.nama == "Admin Utama"


@pytest.mark.parametrize(
    "kosong", [{"nama": None}, {"email": ""}, {"password": None}, {"nama": "   "}]
)
def test_FR_AKN_12_env_kosong_gagal_tanpa_insert(db, kosong):
    awal = _jumlah(db, Admin)
    data = {"nama": "Admin", "email": "a@perpus.example", "password": PASSWORD} | kosong
    with pytest.raises(GalatSeed):
        seed_admin(db, **data)
    assert _jumlah(db, Admin) == awal


def test_NFR_SEC_01_password_admin_tersimpan_sebagai_hash_argon2(db):
    seed_admin(db, nama="Admin", email="hash@perpus.example", password=PASSWORD)
    admin = db.scalars(select(Admin).where(Admin.email == "hash@perpus.example")).one()
    assert admin.password_hash != PASSWORD
    assert PASSWORD not in admin.password_hash
    assert admin.password_hash.startswith("$argon2id$")
    assert verifikasi_password(PASSWORD, admin.password_hash)
    assert not verifikasi_password("salah-password", admin.password_hash)


@pytest.mark.parametrize("password", ["1234567", "pendek", "a"])
def test_NFR_SEC_02_password_admin_kurang_8_ditolak(db, password):
    with pytest.raises(GalatSeed) as info:
        seed_admin(db, nama="Admin", email="pendek@perpus.example", password=password)
    assert "8 karakter" in str(info.value)


def test_seed_admin_idempoten_tidak_menimpa_password(db):
    """ASUMSI(OQ-14): seed bukan jalan belakang untuk mengubah admin."""
    seed_admin(db, nama="Admin", email="tetap@perpus.example", password=PASSWORD)
    hash_awal = db.scalars(
        select(Admin.password_hash).where(Admin.email == "tetap@perpus.example")
    ).one()
    hasil = seed_admin(
        db, nama="Nama Lain", email="TETAP@perpus.example ", password="Password-Baru-999"
    )
    assert hasil is HasilSeedAdmin.SUDAH_ADA
    admin = db.scalars(select(Admin).where(Admin.email == "tetap@perpus.example")).one()
    assert admin.password_hash == hash_awal
    assert admin.nama == "Admin"
    jumlah = db.scalar(
        select(func.count()).where(func.lower(Admin.email) == "tetap@perpus.example")
    )
    assert jumlah == 1


def test_OQ_02_email_admin_sudah_dipakai_anggota_ditolak(db):
    p.anggota(db, email="budi@perpus.example")
    with pytest.raises(GalatSeed) as info:
        seed_admin(db, nama="Admin", email="Budi@Perpus.example", password=PASSWORD)
    assert "anggota" in str(info.value)


def test_OQ_09_email_admin_beda_huruf_dianggap_sama(db):
    seed_admin(db, nama="Admin", email="Kepala@Perpus.example", password=PASSWORD)
    assert seed_admin(db, nama="Admin", email="kepala@perpus.example", password=PASSWORD) is (
        HasilSeedAdmin.SUDAH_ADA
    )


@pytest.mark.parametrize("email", ["bukan-email", "a@", "@perpus.example", "a b@perpus.example"])
def test_FR_AKN_03_email_admin_format_salah_ditolak(db, email):
    with pytest.raises(GalatSeed) as info:
        seed_admin(db, nama="Admin", email=email, password=PASSWORD)
    assert "email" in str(info.value).lower()


def test_FR_AKN_03_email_admin_di_trim_sebelum_disimpan(db):
    seed_admin(db, nama="  Admin  ", email="  rapi@perpus.example  ", password=PASSWORD)
    admin = db.scalars(select(Admin).where(Admin.email == "rapi@perpus.example")).one()
    assert admin.nama == "Admin"


def test_tidak_ada_kredensial_admin_di_env_example():
    isi = (BACKEND / ".env.example").read_text()
    baris = {
        k.strip(): v.strip()
        for k, _, v in (b.partition("=") for b in isi.splitlines())
        if k.strip().startswith("ADMIN_AWAL_")
    }
    assert set(baris) == {"ADMIN_AWAL_NAMA", "ADMIN_AWAL_EMAIL", "ADMIN_AWAL_PASSWORD"}
    assert all(v == "" for v in baris.values())


# --- APP_ENV --------------------------------------------------------------------------------


@pytest.mark.parametrize("nilai", ["dev", "staging", "production"])
def test_OQ_15_app_env_sah_diterima(nilai):
    assert Settings(app_env=nilai).app_env == nilai


@pytest.mark.parametrize("nilai", ["prod", "Production", "development", ""])
def test_OQ_15_app_env_tidak_dikenal_ditolak(nilai):
    with pytest.raises(ValidationError):
        Settings(app_env=nilai)


# --- Data uji & performa --------------------------------------------------------------------


def test_OQ_15_seed_data_uji_ditolak_bila_app_env_production(db):
    awal = _jumlah(db, JudulBuku)
    with pytest.raises(GalatSeed):
        seed_data_uji(db, app_env="production")
    with pytest.raises(GalatSeed):
        seed_performa(db, app_env="production")
    assert _jumlah(db, JudulBuku) == awal


def test_seed_data_uji_isi_dan_idempoten(db):
    r1 = seed_data_uji(db, app_env="dev")
    jumlah = {m: _jumlah(db, m) for m in (Kategori, Rak, JudulBuku, Eksemplar)}
    assert r1.kategori >= 5 and r1.rak >= 5 and r1.judul >= 50 and r1.eksemplar >= 150
    r2 = seed_data_uji(db, app_env="dev")
    assert (r2.kategori, r2.rak, r2.judul, r2.eksemplar) == (0, 0, 0, 0)
    assert {m: _jumlah(db, m) for m in jumlah} == jumlah


def test_seed_data_uji_status_hanya_tersedia_atau_rusak(db):
    """FR-BKU-07: Rusak dari luar transaksi = ubah status saja, tanpa item & tagihan."""
    seed_data_uji(db, app_env="dev")
    status = set(db.scalars(select(Eksemplar.status).distinct()))
    assert status == {"TERSEDIA", "RUSAK"}
    assert db.scalar(select(func.count()).select_from(p.ItemTransaksi)) == 0
    assert db.scalar(select(func.count()).select_from(p.Tagihan)) == 0


def _isbn13_valid(isbn: str) -> bool:
    if len(isbn) != 13 or not isbn.isdigit():
        return False
    total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(isbn[:12]))
    return (10 - total % 10) % 10 == int(isbn[12])


def test_seed_data_uji_isbn_13_valid_dan_unik(db):
    seed_data_uji(db, app_env="dev")
    isbn = db.scalars(select(JudulBuku.isbn)).all()
    assert all(_isbn13_valid(i) for i in isbn)
    assert len(isbn) == len(set(isbn))


def test_OQ_01_seed_data_uji_memuat_harga_tidak_bulat(db):
    seed_data_uji(db, app_env="dev")
    harga = db.scalars(select(JudulBuku.harga)).all()
    assert all(h > 0 for h in harga)
    assert any(h % 10 != 0 for h in harga)  # 10% × harga menghasilkan pecahan rupiah


def test_NFR_PRF_01_seed_performa_10000_eksemplar_dan_idempoten(db):
    r1 = seed_performa(db, app_env="staging")
    assert r1.eksemplar == 10_000
    assert _jumlah(db, Eksemplar) >= 10_000
    total = _jumlah(db, Eksemplar)
    r2 = seed_performa(db, app_env="staging")
    assert r2.eksemplar == 0
    assert _jumlah(db, Eksemplar) == total  # bukan 20.000
    assert set(db.scalars(select(Eksemplar.status).distinct())) <= {"TERSEDIA", "RUSAK"}
    assert db.scalar(select(func.count()).where(Eksemplar.rak_id.is_(None))) == 0  # OQ-10


# --- CLI (proses terpisah, DB _test, dibersihkan setelahnya) --------------------------------


def _cli(*args: str, **env: str) -> subprocess.CompletedProcess:
    lingkungan = os.environ | {"DATABASE_URL": DATABASE_URL_TEST, "APP_ENV": "dev"} | env
    return subprocess.run(  # noqa: S603
        [sys.executable, "-m", "app.seed", *args],
        cwd=BACKEND,
        env=lingkungan,
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )


@pytest.fixture
def hapus_admin_cli():
    email = "cli-seed@perpus.example"
    yield email
    eng = create_engine(DATABASE_URL_TEST)
    with eng.begin() as k:
        k.execute(delete(Admin).where(func.lower(Admin.email) == email))
    eng.dispose()


def test_seed_cli_admin_end_to_end_tanpa_membocorkan_password(hapus_admin_cli):
    email = hapus_admin_cli
    env = {
        "ADMIN_AWAL_NAMA": "Admin CLI",
        "ADMIN_AWAL_EMAIL": email,
        "ADMIN_AWAL_PASSWORD": PASSWORD,
    }
    pertama = _cli("admin", **env)
    assert pertama.returncode == 0, pertama.stderr
    assert email in pertama.stdout
    kedua = _cli("admin", **env)
    assert kedua.returncode == 0, kedua.stderr
    assert "sudah ada" in kedua.stdout
    for hasil in (pertama, kedua):
        assert PASSWORD not in hasil.stdout + hasil.stderr


def test_seed_cli_galat_tanpa_membocorkan_password():
    rahasia = "pndk7!x"
    hasil = _cli(
        "admin",
        ADMIN_AWAL_NAMA="Admin",
        ADMIN_AWAL_EMAIL="galat@perpus.example",
        ADMIN_AWAL_PASSWORD=rahasia,
    )
    assert hasil.returncode != 0
    assert "8 karakter" in hasil.stderr
    assert rahasia not in hasil.stdout + hasil.stderr


def test_seed_cli_data_uji_ditolak_di_production():
    hasil = _cli("data-uji", APP_ENV="production")
    assert hasil.returncode != 0
    assert "production" in hasil.stderr


def test_seed_cli_app_env_salah_ketik_ditolak():
    hasil = _cli("data-uji", APP_ENV="prod")
    assert hasil.returncode != 0
    assert "APP_ENV" in hasil.stderr


def test_OQ_15_aplikasi_gagal_start_bila_app_env_salah_ketik(monkeypatch):
    from app.core.config import get_settings
    from app.main import create_app

    monkeypatch.setenv("APP_ENV", "prod")
    get_settings.cache_clear()
    try:
        with pytest.raises(ValidationError):
            create_app()
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()

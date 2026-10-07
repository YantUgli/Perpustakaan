"""Seed skenario QA & reset (WBS 6.1.2; OQ-15). Angka denda literal dari tabel SRS FR-DND-01..04."""

import os
import subprocess
import sys
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from sqlalchemy import delete, func, select, text

from app.core.galat import GalatBisnis
from app.core.keamanan import verifikasi_password
from app.models import (
    Admin,
    Anggota,
    Eksemplar,
    ItemTransaksi,
    JudulBuku,
    Sesi,
    Tagihan,
    TransaksiPeminjaman,
)
from app.models.status import CaraPenyelesaian, StatusEksemplar, StatusItem, StatusTransaksi
from app.seed.admin import GalatSeed
from app.seed.reset import reset_data
from app.seed.skenario import HARGA_SKENARIO, seed_skenario
from app.services import peminjaman, pengembalian, tagihan
from tests import pabrik as p
from tests.conftest import DATABASE_URL_TEST

BACKEND = Path(__file__).resolve().parents[1]
PASSWORD = "Skenario-Uji-123"
H = date(2026, 10, 15)


@pytest.fixture
def hari_h(atur_waktu):
    atur_waktu(datetime(2026, 10, 15, 3, 0, tzinfo=UTC))  # 10:00 WIB
    return H


@pytest.fixture
def admin(db):
    return p.admin(db)


def _seed(db):
    return seed_skenario(db, app_env="dev", password=PASSWORD)


def _akun(hasil, skenario: str):
    return next(a for a in hasil.akun if a.skenario == skenario)


def _anggota_id(db, kode: str) -> int:
    return db.scalar(select(Anggota.id).where(Anggota.kode == kode))


def _jumlah(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


# --- Penolakan -------------------------------------------------------------------------------


def test_OQ_15_skenario_ditolak_di_production(db, admin, hari_h):
    awal = _jumlah(db, Anggota)
    with pytest.raises(GalatSeed, match="production"):
        seed_skenario(db, app_env="production", password=PASSWORD)
    assert _jumlah(db, Anggota) == awal


def test_OQ_15_reset_ditolak_di_production(db, admin, hari_h):
    nama_db = db.scalar(text("SELECT current_database()"))
    p.anggota(db)
    awal = _jumlah(db, Anggota)
    with pytest.raises(GalatSeed, match="production"):
        reset_data(db, app_env="production", nama_db=nama_db, password=PASSWORD)
    assert _jumlah(db, Anggota) == awal


@pytest.mark.parametrize("nama_db", ["perpustakaan", "", "salah_test"])
def test_reset_ditolak_bila_nama_db_tidak_cocok(db, admin, hari_h, nama_db):
    p.anggota(db)
    awal = _jumlah(db, Anggota)
    with pytest.raises(GalatSeed, match="tidak cocok"):
        reset_data(db, app_env="dev", nama_db=nama_db, password=PASSWORD)
    assert _jumlah(db, Anggota) == awal


def test_skenario_butuh_admin(db, hari_h):
    db.execute(delete(Sesi))
    db.execute(delete(Admin))  # di-rollback bersama transaksi test
    with pytest.raises(GalatSeed, match="seed admin"):
        _seed(db)


@pytest.mark.parametrize("password", [None, "", "pendek7"])
def test_skenario_password_env_wajib_dan_minimal_8(db, admin, hari_h, password):
    with pytest.raises(GalatSeed, match="SKENARIO_PASSWORD") as info:
        seed_skenario(db, app_env="dev", password=password)
    if password:
        assert password not in str(info.value)


# --- Isi skenario ----------------------------------------------------------------------------


def test_skenario_akun_bisa_login_dengan_password_env(db, admin, hari_h):
    hasil = _seed(db)
    assert len(hasil.akun) == 10
    for akun in hasil.akun:
        a = db.scalars(select(Anggota).where(Anggota.kode == akun.kode_anggota)).one()
        assert a.email == akun.email
        assert a.password_hash.startswith("$argon2id$")
        assert verifikasi_password(PASSWORD, a.password_hash)
        assert len(a.nik) == 16 and a.nik.isdigit()


@pytest.mark.parametrize(
    ("skenario", "hari", "denda"),
    [
        ("terlambat-0", 0, 0),
        ("terlambat-1", 1, 10_000),
        ("terlambat-7", 7, 10_000),
        ("terlambat-8", 8, 20_000),
        ("terlambat-70", 70, 100_000),
        ("terlambat-71", 71, 100_000),
    ],
)
def test_FR_DND_01_skenario_denda_sesuai_tabel_srs(db, admin, hari_h, skenario, hari, denda):
    assert HARGA_SKENARIO == 100_000
    akun = _akun(_seed(db), skenario)
    (kode,) = akun.kode_eksemplar
    prv = pengembalian.pratinjau(db, kode)
    assert prv.hari_terlambat == hari
    assert prv.denda == denda
    assert prv.peminjam.kode == akun.kode_anggota


@pytest.mark.parametrize("hari", [1, 7, 8, 70, 71])
def test_FR_PJM_04_skenario_terlambat_diblokir_menyebut_hari(db, admin, hari_h, hari):
    akun = _akun(_seed(db), f"terlambat-{hari}")
    k = peminjaman.kelayakan_anggota(db, _anggota_id(db, akun.kode_anggota))
    assert not k.layak
    assert [a.kode for a in k.alasan] == ["PJM_ADA_TERLAMBAT"]
    assert f"terlambat {hari} hari" in k.alasan[0].pesan
    assert "Buku Skenario QA" in k.alasan[0].pesan


@pytest.mark.parametrize("skenario", ["terlambat-0", "batas-3", "bersih"])
def test_FR_PJM_04_skenario_tanpa_terlambat_tetap_layak(db, admin, hari_h, skenario):
    akun = _akun(_seed(db), skenario)
    assert peminjaman.kelayakan_anggota(db, _anggota_id(db, akun.kode_anggota)).layak


@pytest.mark.parametrize(
    ("skenario", "total"), [("tagihan-denda", "Rp20.000"), ("tagihan-penggantian", "Rp100.000")]
)
def test_FR_PJM_03_skenario_tagihan_belum_lunas_diblokir(db, admin, hari_h, skenario, total):
    akun = _akun(_seed(db), skenario)
    k = peminjaman.kelayakan_anggota(db, _anggota_id(db, akun.kode_anggota))
    assert not k.layak
    assert [a.kode for a in k.alasan] == ["PJM_ADA_TAGIHAN"]
    assert "1 tagihan Belum Lunas" in k.alasan[0].pesan
    assert total in k.alasan[0].pesan


def test_FR_PJM_08_skenario_batas_3_item_keempat_ditolak(db, admin, hari_h):
    hasil = _seed(db)
    akun = _akun(hasil, "batas-3")
    assert len(akun.kode_eksemplar) == 3
    assert len(hasil.eksemplar_tersedia) >= 3
    with pytest.raises(GalatBisnis) as info:
        peminjaman.validasi_item(
            db,
            anggota_id=_anggota_id(db, akun.kode_anggota),
            kode_eksemplar=hasil.eksemplar_tersedia[0],
            keranjang=[],
        )
    assert info.value.kode == "PJM_ITEM_MELEBIHI_BATAS"


def test_FR_PJM_08_skenario_bersih_boleh_3_item_tersedia(db, admin, hari_h):
    hasil = _seed(db)
    anggota_id = _anggota_id(db, _akun(hasil, "bersih").kode_anggota)
    keranjang: list[str] = []
    for kode in hasil.eksemplar_tersedia[:3]:
        peminjaman.validasi_item(
            db, anggota_id=anggota_id, kode_eksemplar=kode, keranjang=keranjang
        )
        keranjang.append(kode)


def _tagihan_anggota(db, kode_anggota: str) -> Tagihan:
    return db.scalars(
        select(Tagihan)
        .join(ItemTransaksi, Tagihan.item_transaksi_id == ItemTransaksi.id)
        .join(TransaksiPeminjaman, ItemTransaksi.transaksi_id == TransaksiPeminjaman.id)
        .join(Anggota, TransaksiPeminjaman.anggota_id == Anggota.id)
        .where(Anggota.kode == kode_anggota)
    ).one()


def test_FR_DND_04_skenario_tagihan_denda_dari_kembali_terlambat_10_hari(db, admin, hari_h):
    akun = _akun(_seed(db), "tagihan-denda")
    t = _tagihan_anggota(db, akun.kode_anggota)
    item = db.get(ItemTransaksi, t.item_transaksi_id)
    assert (t.jenis, t.status, t.nominal) == ("DENDA", "BELUM_LUNAS", 20_000)
    assert item.status == StatusItem.DIKEMBALIKAN
    assert item.tanggal_pinjam == date(2026, 8, 31)  # H−45
    assert item.jatuh_tempo == date(2026, 9, 30)  # H−15
    assert item.tanggal_kembali == t.tanggal_dibentuk == date(2026, 10, 10)  # H−5
    assert db.get(Eksemplar, item.eksemplar_id).status == StatusEksemplar.TERSEDIA


def test_FR_TGH_04_skenario_penggantian_bisa_diselesaikan_buku_pengganti(db, admin, hari_h):
    akun = _akun(_seed(db), "tagihan-penggantian")
    t = _tagihan_anggota(db, akun.kode_anggota)
    item = db.get(ItemTransaksi, t.item_transaksi_id)
    assert (t.jenis, t.status, t.nominal) == ("PENGGANTIAN", "BELUM_LUNAS", 100_000)
    assert t.tanggal_dibentuk == H  # OQ-27
    assert item.status == StatusItem.HILANG
    assert item.tanggal_pinjam <= item.tanggal_kejadian <= H  # OQ-26
    assert item.keterangan.strip() and item.admin_pencatat_id is not None
    (kode,) = akun.kode_eksemplar
    assert db.scalar(select(Eksemplar.status).where(Eksemplar.kode == kode)) == "HILANG"

    hasil = tagihan.selesaikan(
        db, t.id, cara=CaraPenyelesaian.BUKU_PENGGANTI, nominal=None, tanggal=H, admin_id=admin.id
    )
    assert hasil.status == "LUNAS"
    assert db.scalar(select(Eksemplar.status).where(Eksemplar.kode == kode)) == "TERSEDIA"
    anggota_id = _anggota_id(db, akun.kode_anggota)
    assert peminjaman.kelayakan_anggota(db, anggota_id).layak  # FR-TGH-07


def test_FR_TGH_02_skenario_tagihan_denda_bisa_dibayar_tunai(db, admin, hari_h):
    akun = _akun(_seed(db), "tagihan-denda")
    t = _tagihan_anggota(db, akun.kode_anggota)
    hasil = tagihan.selesaikan(
        db, t.id, cara=CaraPenyelesaian.TUNAI, nominal=20_000, tanggal=H, admin_id=admin.id
    )
    assert hasil.status == "LUNAS"


def test_FR_KMB_08_skenario_status_transaksi_konsisten(db, admin, hari_h):
    hasil = _seed(db)
    for akun in hasil.akun:
        transaksi = db.scalars(
            select(TransaksiPeminjaman)
            .join(Anggota, TransaksiPeminjaman.anggota_id == Anggota.id)
            .where(Anggota.kode == akun.kode_anggota)
        ).all()
        if akun.skenario == "bersih":
            assert transaksi == []
            continue
        assert len(transaksi) == 1, akun.skenario
        (trx,) = transaksi
        item = db.scalars(select(ItemTransaksi).where(ItemTransaksi.transaksi_id == trx.id)).all()
        assert len(item) == (3 if akun.skenario == "batas-3" else 1)
        assert trx.tanggal_transaksi == item[0].tanggal_pinjam
        harapan = (
            StatusTransaksi.SELESAI
            if akun.skenario.startswith("tagihan-")
            else StatusTransaksi.AKTIF
        )
        assert trx.status == harapan, akun.skenario
        # FR-KMB-08: Selesai ⇔ tidak ada item yang masih Dipinjam
        masih_dipinjam = any(i.status == StatusItem.DIPINJAM for i in item)
        assert (trx.status == StatusTransaksi.SELESAI) == (not masih_dipinjam)


def test_skenario_idempoten_per_email(db, admin, hari_h):
    pertama = _seed(db)
    jumlah = {m: _jumlah(db, m) for m in (Anggota, Eksemplar, ItemTransaksi, Tagihan, JudulBuku)}
    kedua = _seed(db)
    assert all(a.dibuat for a in pertama.akun)
    assert not any(a.dibuat for a in kedua.akun)
    assert [a.kode_anggota for a in kedua.akun] == [a.kode_anggota for a in pertama.akun]
    assert {m: _jumlah(db, m) for m in jumlah} == jumlah


# --- Reset -----------------------------------------------------------------------------------


def test_reset_kosongkan_data_pertahankan_admin_hapus_sesi(db, admin, hari_h):
    nama_db = db.scalar(text("SELECT current_database()"))
    lama = p.anggota(db, email="lama@perpus.example")
    p.item(db)
    p.simpan(
        db,
        Sesi(
            token_hash="h-admin",
            role="ADMIN",
            admin_id=admin.id,
            dibuat_pada=datetime(2026, 10, 15, tzinfo=UTC),
            terakhir_aktif=datetime(2026, 10, 15, tzinfo=UTC),
        ),
    )
    admin_awal = _jumlah(db, Admin)

    hasil = reset_data(db, app_env="staging", nama_db=nama_db, password=PASSWORD)

    assert _jumlah(db, Admin) == admin_awal
    assert db.get(Admin, admin.id) is not None
    assert _jumlah(db, Sesi) == 0
    assert db.scalar(select(Anggota.id).where(Anggota.email == lama.email)) is None
    assert _jumlah(db, Anggota) == len(hasil.skenario.akun) == 10
    assert hasil.data_uji.judul == 60
    assert _jumlah(db, JudulBuku) == 61  # 60 data uji + 1 judul skenario


def test_reset_kode_mulai_dari_000001(db, admin, hari_h):
    nama_db = db.scalar(text("SELECT current_database()"))
    p.anggota(db)
    p.eksemplar(db)
    reset_data(db, app_env="dev", nama_db=nama_db, password=PASSWORD)
    assert db.scalar(select(func.min(Anggota.kode))) == "AGT-000001"
    assert db.scalar(select(func.min(Eksemplar.kode))) == "EKS-000001"
    assert db.scalar(select(func.min(Anggota.id))) == 1


# --- CLI (hanya jalur penolakan: tidak ada yang di-commit) ------------------------------------


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


@pytest.mark.parametrize("args", [("reset",), ("reset", "--ya")])
def test_reset_cli_tanpa_konfirmasi_nama_db_ditolak(args):
    hasil = _cli(*args, SKENARIO_PASSWORD=PASSWORD)
    assert hasil.returncode != 0
    assert "--ya" in hasil.stderr


def test_reset_cli_nama_db_salah_ditolak_dan_mencetak_host_db_tanpa_kredensial():
    hasil = _cli("reset", "--ya", "perpustakaan", SKENARIO_PASSWORD=PASSWORD)
    assert hasil.returncode != 0
    assert "tidak cocok" in hasil.stderr
    assert "perpustakaan_test" in hasil.stdout  # nama DB yang sebenarnya dituju
    assert "127.0.0.1" in hasil.stdout or "localhost" in hasil.stdout
    keluaran = hasil.stdout + hasil.stderr
    assert "perpustakaan:perpustakaan@" not in keluaran
    assert PASSWORD not in keluaran


def test_reset_cli_ditolak_di_production():
    hasil = _cli(
        "reset", "--ya", "perpustakaan_test", APP_ENV="production", SKENARIO_PASSWORD=PASSWORD
    )
    assert hasil.returncode != 0
    assert "production" in hasil.stderr


def test_skenario_cli_password_kosong_ditolak_tanpa_insert():
    hasil = _cli("skenario", SKENARIO_PASSWORD="")
    assert hasil.returncode != 0
    assert "SKENARIO_PASSWORD" in hasil.stderr

"""WP 5.3.7 — jatuh tempo & denda: FR-PJM-11, FR-DND-01..06, BR-11..13, NFR-MNT-02, OQ-01.

Logika murni tanpa DB. "Terlambat bukan status tersimpan" (FR-DND-05) sudah dijaga di test_skema.py:
`test_status_item_tidak_dikenal_ditolak` dan `test_tidak_ada_kolom_di_luar_lingkup`.
"""

from datetime import UTC, date, datetime, timedelta

import pytest

from app.core.waktu import hari_ini_wib
from app.models.status import StatusItem
from app.services.kalkulasi import (
    hitung_denda,
    hitung_hari_terlambat,
    hitung_jatuh_tempo,
    hitung_minggu_dihitung,
    is_terlambat,
)

JT = date(2026, 10, 31)  # jatuh tempo acuan
HARGA = 100_000


def _denda(hari: int, harga: int = HARGA) -> int:
    return hitung_denda(jatuh_tempo=JT, tanggal_kembali=JT + timedelta(days=hari), harga=harga)


# --------------------------------------------------------------------------- jatuh tempo


def test_FR_PJM_11_jatuh_tempo_01_10_menjadi_31_10():
    assert hitung_jatuh_tempo(date(2026, 10, 1)) == date(2026, 10, 31)


def test_FR_PJM_11_jatuh_tempo_lintas_bulan():
    assert hitung_jatuh_tempo(date(2027, 1, 15)) == date(2027, 2, 14)


def test_FR_PJM_11_jatuh_tempo_lintas_tahun():
    assert hitung_jatuh_tempo(date(2026, 12, 15)) == date(2027, 1, 14)


@pytest.mark.parametrize(
    ("pinjam", "harapan"),
    [
        (date(2027, 1, 31), date(2027, 3, 2)),  # Februari 28 hari
        (date(2028, 1, 31), date(2028, 3, 1)),  # kabisat, Februari 29 hari
    ],
)
def test_FR_PJM_11_jatuh_tempo_februari_kabisat_dan_bukan(pinjam, harapan):
    assert hitung_jatuh_tempo(pinjam) == harapan


# --------------------------------------------------------------------------- hari terlambat


def test_FR_DND_01_kembali_tepat_jatuh_tempo_tidak_terlambat():
    assert hitung_hari_terlambat(JT, JT) == 0
    assert _denda(0) == 0


@pytest.mark.parametrize("hari_awal", [1, 7, 30])
def test_FR_DND_01_kembali_lebih_awal_nol(hari_awal):
    kembali = JT - timedelta(days=hari_awal)
    assert hitung_hari_terlambat(JT, kembali) == 0
    assert hitung_denda(jatuh_tempo=JT, tanggal_kembali=kembali, harga=HARGA) == 0


def test_FR_DND_01_hari_terlambat_lintas_bulan_dan_tahun():
    jt, kembali = date(2026, 12, 28), date(2027, 1, 5)
    assert hitung_hari_terlambat(jt, kembali) == 8
    assert hitung_minggu_dihitung(8) == 2
    assert hitung_denda(jatuh_tempo=jt, tanggal_kembali=kembali, harga=HARGA) == 20_000


# --------------------------------------------------------------------------- tabel SRS §4.7


@pytest.mark.parametrize(
    ("hari", "minggu", "denda"),
    [
        (0, 0, 0),
        (1, 1, 10_000),
        (7, 1, 10_000),
        (8, 2, 20_000),
        (70, 10, 100_000),
        (71, 10, 100_000),  # plafon
    ],
)
def test_NFR_MNT_02_tabel_contoh_srs_4_7(hari, minggu, denda):
    assert hitung_hari_terlambat(JT, JT + timedelta(days=hari)) == hari
    assert hitung_minggu_dihitung(hari) == minggu
    assert _denda(hari) == denda


@pytest.mark.parametrize(
    ("hari", "minggu"), [(14, 2), (15, 3), (21, 3), (22, 4), (63, 9), (64, 10), (365, 10)]
)
def test_FR_DND_02_03_batas_minggu_dan_plafon(hari, minggu):
    assert hitung_minggu_dihitung(hari) == minggu
    assert _denda(hari) == minggu * 10_000


# --------------------------------------------------------------------------- pembulatan OQ-01


@pytest.mark.parametrize(
    ("harga", "hari", "denda"),
    [
        (15_555, 1, 1_556),  # 1.555,5 → setengah ke atas
        (15_555, 8, 3_111),  # 3.111 bulat
        (15_555, 15, 4_667),  # 4.666,5 → setengah ke atas
        (99_999, 1, 10_000),  # 9.999,9 → ke atas
        (33_333, 1, 3_333),  # 3.333,3 → ke bawah
        (47_250, 70, 47_250),  # plafon = 100% harga
        (1, 1, 0),  # 0,1 → ke bawah
        (5, 1, 1),  # 0,5 → setengah ke atas
    ],
)
def test_OQ_01_pembulatan_setengah_ke_atas(harga, hari, denda):
    assert _denda(hari, harga) == denda


def test_FR_DND_04_denda_selalu_int():
    for hari in (0, 1, 8, 71):
        hasil = _denda(hari, 15_555)
        assert type(hasil) is int


# --------------------------------------------------------------------------- plafon & terlambat


def test_FR_DND_03_06_plafon_denda_tidak_bertambah_setelah_70_hari():
    assert {_denda(h) for h in (70, 71, 100, 1000)} == {100_000}


@pytest.mark.parametrize(
    ("status", "selisih", "harapan"),
    [
        (StatusItem.DIPINJAM, -1, False),  # sebelum jatuh tempo
        (StatusItem.DIPINJAM, 0, False),  # tepat jatuh tempo
        (StatusItem.DIPINJAM, 1, True),  # lewat
        (StatusItem.DIKEMBALIKAN, 1, False),
        (StatusItem.HILANG, 1, False),
        (StatusItem.RUSAK, 1, False),
        (StatusItem.DIKEMBALIKAN, 0, False),
    ],
)
def test_FR_DND_05_is_terlambat_hanya_dipinjam_dan_lewat_jatuh_tempo(status, selisih, harapan):
    assert is_terlambat(status, JT, JT + timedelta(days=selisih)) is harapan


def test_FR_DND_06_tetap_terlambat_setelah_plafon():
    hari_ini = JT + timedelta(days=100)
    assert is_terlambat(StatusItem.DIPINJAM, JT, hari_ini) is True
    assert _denda(100) == 100_000


def test_FR_DND_05_K_07_tengah_malam_wib_sudah_terlambat(atur_waktu):
    # 31/10 17:30 UTC = 01/11 00:30 WIB → sudah lewat jatuh tempo 31/10
    atur_waktu(datetime(2026, 10, 31, 17, 30, tzinfo=UTC))
    assert hari_ini_wib() == date(2026, 11, 1)
    assert is_terlambat(StatusItem.DIPINJAM, JT, hari_ini_wib()) is True
    assert hitung_hari_terlambat(JT, hari_ini_wib()) == 1
    # 31/10 16:59 UTC = 31/10 23:59 WIB → belum terlambat
    atur_waktu(datetime(2026, 10, 31, 16, 59, tzinfo=UTC))
    assert is_terlambat(StatusItem.DIPINJAM, JT, hari_ini_wib()) is False


# --------------------------------------------------------------------------- pengaman programmer


@pytest.mark.parametrize(
    ("harga", "galat"), [(0, ValueError), (-100, ValueError), (True, TypeError), (1.5, TypeError)]
)
def test_DR_05_harga_tidak_valid_ditolak(harga, galat):
    with pytest.raises(galat):
        _denda(1, harga)


def test_hari_terlambat_negatif_ditolak_di_minggu_dihitung():
    with pytest.raises(ValueError):
        hitung_minggu_dihitung(-1)

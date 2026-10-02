"""K-07: tanggal bisnis dihitung dalam Asia/Jakarta (WIB, UTC+7)."""

from datetime import UTC, date, datetime, timedelta

import pytest

from app.core import waktu
from app.core.waktu import hari_ini_wib, sekarang_wib


def test_K07_batas_1659_utc_masih_tanggal_sama(atur_waktu):
    atur_waktu(datetime(2026, 10, 1, 16, 59, 59, tzinfo=UTC))  # 23:59:59 WIB
    assert hari_ini_wib() == date(2026, 10, 1)


def test_K07_batas_1700_utc_sudah_besok(atur_waktu):
    atur_waktu(datetime(2026, 10, 1, 17, 0, 0, tzinfo=UTC))  # 00:00 WIB
    assert hari_ini_wib() == date(2026, 10, 2)


def test_K07_hari_ini_wib_beda_dengan_utc(atur_waktu):
    saat = datetime(2026, 12, 31, 20, 0, tzinfo=UTC)
    atur_waktu(saat)
    assert saat.date() == date(2026, 12, 31)
    assert hari_ini_wib() == date(2027, 1, 1)  # lintas tahun


def test_K07_sekarang_wib_berzona_jakarta(atur_waktu):
    atur_waktu(datetime(2026, 10, 1, 0, 0, tzinfo=UTC))
    assert sekarang_wib().utcoffset() == timedelta(hours=7)


def test_K07_patokan_berlaku_untuk_impor_langsung(atur_waktu):
    """Modul yang melakukan `from app.core.waktu import hari_ini_wib` ikut terpatok."""
    from app.core.waktu import hari_ini_wib as diimpor

    atur_waktu(datetime(2030, 5, 5, 3, 0, tzinfo=UTC))
    assert diimpor() == date(2030, 5, 5)


def test_K07_jam_tanpa_zona_ditolak():
    waktu.atur_jam(lambda: datetime(2026, 10, 1, 12, 0))  # noqa: DTZ001 — sengaja naive
    try:
        with pytest.raises(ValueError):
            hari_ini_wib()
    finally:
        waktu.atur_jam(None)


def test_K07_tanpa_patokan_memakai_jam_sistem():
    waktu.atur_jam(None)
    harapan = datetime.now(UTC).astimezone(waktu.ZONA_WIB).date()
    assert hari_ini_wib() in {harapan, harapan + timedelta(days=1)}

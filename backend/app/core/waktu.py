"""Satu-satunya sumber "sekarang" dan "hari ini" untuk logika bisnis (K-07).

Semua tanggal bisnis dihitung dalam Asia/Jakarta (WIB), bukan UTC server dan bukan jam basis data.
Dilarang memanggil `date.today()` / `datetime.now()` langsung, dan dilarang memakai `CURRENT_DATE`
/ `now()` di SQL untuk tanggal bisnis.

Untuk test, jam bisa dipatok lewat `atur_jam()` (dipakai fixture `atur_waktu` di tests/conftest.py).
Karena `hari_ini_wib()` membaca jam saat dipanggil, patokan berlaku di semua modul tanpa peduli
cara modul tersebut mengimpor fungsi ini.
"""

from collections.abc import Callable
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

ZONA_WIB = ZoneInfo("Asia/Jakarta")


def _jam_sistem() -> datetime:
    return datetime.now(UTC)


_jam: Callable[[], datetime] = _jam_sistem


def atur_jam(jam: Callable[[], datetime] | None) -> None:
    """Ganti sumber jam (khusus test). `None` mengembalikan ke jam sistem."""
    global _jam
    _jam = jam or _jam_sistem


def sekarang_wib() -> datetime:
    """Waktu sekarang (aware) dalam zona WIB."""
    jam = _jam()
    if jam.tzinfo is None:
        raise ValueError("Sumber jam harus mengembalikan datetime ber-zona waktu.")
    return jam.astimezone(ZONA_WIB)


def hari_ini_wib() -> date:
    """Tanggal hari ini menurut WIB (K-07)."""
    return sekarang_wib().date()

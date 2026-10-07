"""Jatuh tempo & denda: FR-PJM-11, FR-DND-01..06, BR-11..13, NFR-MNT-02.

Logika murni: tanpa DB dan tanpa membaca jam. "Hari ini" dikirim pemanggil dari `hari_ini_wib()`
(K-07). Hanya menghitung — pembentukan tagihan (5.3.9), blokir (5.3.8), dan pengecualian denda
untuk item Hilang/Rusak (FR-HLR-04, 5.3.10) milik pemanggil. Uang = int Rupiah; tanpa float/Decimal.
"""

from datetime import date, timedelta

from app.models.status import StatusItem

MASA_PINJAM_HARI = 30  # BR-11, FR-PJM-11
PERSEN_DENDA_PER_MINGGU = 10  # BR-12, FR-DND-04
MAKS_MINGGU_DENDA = 10  # BR-13, FR-DND-03


def hitung_jatuh_tempo(tanggal_pinjam: date) -> date:
    """FR-PJM-11: tanggal pinjam + 30 hari kalender (01/10 → 31/10)."""
    return tanggal_pinjam + timedelta(days=MASA_PINJAM_HARI)


def hitung_hari_terlambat(jatuh_tempo: date, tanggal_kembali: date) -> int:
    """FR-DND-01: tanggal kembali − jatuh tempo (hari kalender WIB); ≤ 0 → 0 (tidak terlambat)."""
    return max((tanggal_kembali - jatuh_tempo).days, 0)


def hitung_minggu_dihitung(hari_terlambat: int) -> int:
    """FR-DND-02: ceil(hari ÷ 7), FR-DND-03: maksimum 10 minggu. Aritmetika integer."""
    if hari_terlambat < 0:
        raise ValueError("hari_terlambat tidak boleh negatif; pakai hitung_hari_terlambat().")
    return min((hari_terlambat + 6) // 7, MAKS_MINGGU_DENDA)


def hitung_denda(*, jatuh_tempo: date, tanggal_kembali: date, harga: int) -> int:
    """FR-DND-04: minggu dihitung × 10% × harga judul, Rupiah bulat.

    Plafon (FR-DND-03/06) hanya membatasi nominal; tidak mengubah status apa pun.
    """
    if not isinstance(harga, int) or isinstance(harga, bool):
        raise TypeError("harga harus int Rupiah.")
    if harga <= 0:
        raise ValueError("harga harus lebih dari 0 (DR-05).")
    minggu = hitung_minggu_dihitung(hitung_hari_terlambat(jatuh_tempo, tanggal_kembali))
    # ASUMSI(OQ-01): hitung minggu × harga × 10 / 100 lalu bulatkan setengah ke atas (integer).
    return (minggu * harga * PERSEN_DENDA_PER_MINGGU + 50) // 100


def is_terlambat(status: StatusItem, jatuh_tempo: date, hari_ini: date) -> bool:
    """FR-DND-05: Dipinjam dan hari ini (WIB) melewati jatuh tempo. Kondisi turunan, dihitung saat
    dibutuhkan; bukan status tersimpan. FR-DND-06: tetap benar setelah plafon denda tercapai."""
    return status == StatusItem.DIPINJAM and hari_ini > jatuh_tempo

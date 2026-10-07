"""Format Rupiah & normalisasi kode (decisions.md §B; dipakai pesan FR-PJM-03 dan FR-PJM-05/07)."""

from datetime import date

import pytest

from app.core.format import format_rupiah, format_tanggal
from app.core.validasi import normalisasi_kode


@pytest.mark.parametrize(
    ("nominal", "teks"),
    [
        (0, "Rp0"),
        (5, "Rp5"),
        (999, "Rp999"),
        (1_000, "Rp1.000"),
        (35_555, "Rp35.555"),
        (100_000, "Rp100.000"),
        (1_250_000, "Rp1.250.000"),
        (12_345_678_901, "Rp12.345.678.901"),
    ],
)
def test_format_rupiah_tanpa_spasi_titik_ribuan(nominal, teks):
    assert format_rupiah(nominal) == teks


@pytest.mark.parametrize("salah", [1.5, "1000", True, -1])
def test_format_rupiah_hanya_int_tidak_negatif(salah):
    with pytest.raises((TypeError, ValueError)):
        format_rupiah(salah)


@pytest.mark.parametrize(
    ("tanggal", "teks"),
    [(date(2026, 10, 1), "01/10/2026"), (date(2027, 12, 31), "31/12/2027")],
)
def test_format_tanggal_dd_mm_yyyy(tanggal, teks):
    assert format_tanggal(tanggal) == teks


@pytest.mark.parametrize(
    ("masuk", "keluar"),
    [(" eks-000012 ", "EKS-000012"), ("agt-000001", "AGT-000001"), ("EKS-000001", "EKS-000001")],
)
def test_normalisasi_kode_trim_dan_huruf_besar(masuk, keluar):
    assert normalisasi_kode(masuk) == keluar

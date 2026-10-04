"""Router admin: dashboard & laporan (FR-LAP-01..04). Didaftarkan ke `router_admin` (NFR-SEC-03).

Semua endpoint GET dan hanya membaca. Endpoint JSON dan ekspor memakai filter yang sama dan
memanggil query yang sama (satu sumber filter). Sengaja TIDAK ada: grafik, CSV, kirim email,
penjadwalan.
"""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.laporan import (
    BarisTagihanKeluar,
    BarisTransaksiKeluar,
    DashboardKeluar,
    LaporanTagihanKeluar,
    LaporanTransaksiKeluar,
)
from app.services import ekspor
from app.services import laporan as layanan
from app.services.laporan import FilterTagihan, FilterTransaksi, StatusLaporan

router = APIRouter(tags=["dashboard & laporan"])
DB = Annotated[Session, Depends(get_db)]
Halaman = Annotated[int, Query(ge=1)]
PerHalaman = Annotated[int, Query(ge=1, le=100)]
Format = Annotated[Literal["pdf", "xlsx"], Query()]


def filter_transaksi(
    dari: date | None = None,
    sampai: date | None = None,
    status: Annotated[
        Literal["DIPINJAM", "TERLAMBAT", "DIKEMBALIKAN", "HILANG", "RUSAK"] | None,
        Query(description="ASUMSI(OQ-37): status item; TERLAMBAT turunan"),
    ] = None,
) -> FilterTransaksi:
    """FR-LAP-02: rentang tanggal pinjam (OQ-07, inklusif OQ-38) dan status."""
    return FilterTransaksi(
        dari=dari, sampai=sampai, status=StatusLaporan(status) if status else None
    )


def filter_tagihan(
    dari: date | None = None,
    sampai: date | None = None,
    jenis: Literal["DENDA", "PENGGANTIAN"] | None = None,
    status: Literal["BELUM_LUNAS", "LUNAS"] | None = None,
    cara: Literal["TUNAI", "TRANSFER", "BUKU_PENGGANTI"] | None = None,
) -> FilterTagihan:
    """FR-LAP-03: rentang tanggal dibentuk (OQ-11, inklusif OQ-38), jenis, status, cara."""
    return FilterTagihan(dari=dari, sampai=sampai, jenis=jenis, status=status, cara=cara)


FilterTrx = Annotated[FilterTransaksi, Depends(filter_transaksi)]
FilterTgh = Annotated[FilterTagihan, Depends(filter_tagihan)]


def _berkas(b: ekspor.BerkasEkspor) -> Response:
    return Response(
        content=b.isi,
        media_type=b.media_type,
        headers={"Content-Disposition": f'attachment; filename="{b.nama_berkas}"'},
    )


@router.get("/dashboard", response_model=DashboardKeluar)
def dashboard(db: DB):
    """FR-LAP-01: ringkasan judul, eksemplar per status, anggota, pinjaman, tagihan Belum Lunas."""
    return DashboardKeluar.dari(layanan.dashboard(db))


@router.get("/laporan/transaksi", response_model=LaporanTransaksiKeluar)
def laporan_transaksi(db: DB, f: FilterTrx, halaman: Halaman = 1, per_halaman: PerHalaman = 20):
    """FR-LAP-02: laporan peminjaman & pengembalian per item."""
    data, total = layanan.laporan_transaksi(db, f, halaman=halaman, per_halaman=per_halaman)
    return LaporanTransaksiKeluar(
        data=[BarisTransaksiKeluar.dari(b) for b in data],
        total=total,
        halaman=halaman,
        per_halaman=per_halaman,
    )


@router.get(
    "/laporan/transaksi/ekspor",
    response_class=Response,
    responses={200: {"content": {ekspor.MIME_PDF: {}, ekspor.MIME_XLSX: {}}}},
)
def ekspor_transaksi(db: DB, f: FilterTrx, format: Format):
    """FR-LAP-04: semua baris laporan transaksi sesuai filter aktif, sebagai PDF atau xlsx."""
    return _berkas(ekspor.ekspor_transaksi(db, f, format))


@router.get("/laporan/tagihan", response_model=LaporanTagihanKeluar)
def laporan_tagihan(db: DB, f: FilterTgh, halaman: Halaman = 1, per_halaman: PerHalaman = 20):
    """FR-LAP-03: laporan denda & penggantian beserta total nominal."""
    h = layanan.laporan_tagihan(db, f, halaman=halaman, per_halaman=per_halaman)
    return LaporanTagihanKeluar(
        data=[BarisTagihanKeluar.dari(b) for b in h.baris],
        total=h.jumlah,
        total_nominal=h.total_nominal,
        halaman=halaman,
        per_halaman=per_halaman,
    )


@router.get(
    "/laporan/tagihan/ekspor",
    response_class=Response,
    responses={200: {"content": {ekspor.MIME_PDF: {}, ekspor.MIME_XLSX: {}}}},
)
def ekspor_tagihan(db: DB, f: FilterTgh, format: Format):
    """FR-LAP-04: semua baris laporan tagihan + total sesuai filter aktif, sebagai PDF atau xlsx."""
    return _berkas(ekspor.ekspor_tagihan(db, f, format))

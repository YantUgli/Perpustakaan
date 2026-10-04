"""Router area anggota: FR-AGT-01..05. Didaftarkan ke `router_anggota` (NFR-SEC-03).

Identitas anggota selalu dari sesi; tidak ada parameter path/query/body berisi id atau kode anggota,
dan semua endpoint hanya membaca (GET). Sengaja TIDAK ada menu lapor hilang (K-01), perpanjangan
(FR-PJM-13), maupun estimasi denda berjalan.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import butuh_anggota
from app.db import get_db
from app.schemas.area_anggota import (
    HalamanRiwayat,
    HalamanTagihanAnggota,
    ItemRiwayatKeluar,
    KelayakanKeluar,
    PinjamanAktifKeluar,
    QrKeluar,
    TagihanAnggotaKeluar,
)
from app.services import area_anggota as layanan
from app.services.autentikasi import Pengguna

router = APIRouter(tags=["area anggota"])
DB = Annotated[Session, Depends(get_db)]
Anggota = Annotated[Pengguna, Depends(butuh_anggota)]
Halaman = Annotated[int, Query(ge=1)]
PerHalaman = Annotated[int, Query(ge=1, le=100)]


@router.get("/qr", response_model=QrKeluar)
def qr(db: DB, saya: Anggota):
    """FR-AGT-01: data QR identifikasi; gambar QR dibuat di klien (isi = kode anggota)."""
    return QrKeluar.dari(layanan.qr(db, saya.id))


@router.get("/kelayakan", response_model=KelayakanKeluar)
def kelayakan(db: DB, saya: Anggota):
    """FR-AGT-05: status kelayakan meminjam beserta alasannya bila terblokir."""
    return KelayakanKeluar.dari(layanan.kelayakan(db, saya.id))


@router.get("/pinjaman", response_model=list[PinjamanAktifKeluar])
def pinjaman(db: DB, saya: Anggota):
    """FR-AGT-02: pinjaman aktif (maks. 3) dengan jatuh tempo, sisa hari, dan penanda terlambat."""
    return [PinjamanAktifKeluar.dari(p) for p in layanan.pinjaman_aktif(db, saya.id)]


@router.get("/riwayat", response_model=HalamanRiwayat)
def riwayat(db: DB, saya: Anggota, halaman: Halaman = 1, per_halaman: PerHalaman = 20):
    """FR-AGT-03: riwayat peminjaman & pengembalian, termasuk item Hilang/Rusak."""
    data, total = layanan.riwayat(db, saya.id, halaman=halaman, per_halaman=per_halaman)
    return HalamanRiwayat(
        data=[ItemRiwayatKeluar.dari(i) for i in data],
        total=total,
        halaman=halaman,
        per_halaman=per_halaman,
    )


@router.get("/tagihan", response_model=HalamanTagihanAnggota)
def tagihan(db: DB, saya: Anggota, halaman: Halaman = 1, per_halaman: PerHalaman = 20):
    """FR-AGT-04: tagihan dengan jenis, nominal, status, dan cara penyelesaian."""
    data, total = layanan.tagihan(db, saya.id, halaman=halaman, per_halaman=per_halaman)
    return HalamanTagihanAnggota(
        data=[TagihanAnggotaKeluar.dari(t) for t in data],
        total=total,
        halaman=halaman,
        per_halaman=per_halaman,
    )

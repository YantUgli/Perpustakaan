"""Router admin: peminjaman (FR-PJM-01..13, BR-07). Didaftarkan ke `router_admin` (NFR-SEC-03).

Keranjang disusun di klien; `validasi-item` tidak mengubah data, `POST /peminjaman` memeriksa ulang
semuanya (FR-PJM-10). Sengaja TIDAK ada endpoint perpanjangan (FR-PJM-13).
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import butuh_admin
from app.db import get_db
from app.schemas.peminjaman import (
    AlasanKeluar,
    AnggotaRingkas,
    IdentitasAnggotaKeluar,
    ItemDipinjamKeluar,
    ItemValidKeluar,
    KonfirmasiMasuk,
    TransaksiKeluar,
    ValidasiItemMasuk,
)
from app.services import peminjaman as layanan
from app.services.autentikasi import Pengguna

router = APIRouter(prefix="/peminjaman", tags=["peminjaman"])
DB = Annotated[Session, Depends(get_db)]
Admin = Annotated[Pengguna, Depends(butuh_admin)]


@router.get("/anggota/{kode}", response_model=IdentitasAnggotaKeluar)
def identifikasi_anggota(kode: str, db: DB):
    """FR-PJM-01/02: kode dari QR anggota atau diketik; tampilkan kelayakan beserta alasannya."""
    a = layanan.identifikasi_anggota(db, kode)
    return IdentitasAnggotaKeluar(
        id=a.id,
        kode=a.kode,
        nama=a.nama,
        pinjaman_aktif=a.pinjaman_aktif,
        layak=a.kelayakan.layak,
        alasan=[
            AlasanKeluar(kode=x.kode, pesan=x.pesan, rujukan=x.rujukan) for x in a.kelayakan.alasan
        ],
    )


@router.post("/validasi-item", response_model=ItemValidKeluar)
def validasi_item(data: ValidasiItemMasuk, db: DB):
    """FR-PJM-05..08: periksa satu pindaian terhadap keranjang. Tidak mengubah data."""
    i = layanan.validasi_item(
        db, anggota_id=data.anggota_id, kode_eksemplar=data.kode_eksemplar, keranjang=data.keranjang
    )
    return ItemValidKeluar(eksemplar_id=i.eksemplar_id, kode=i.kode, judul=i.judul)


@router.post("", response_model=TransaksiKeluar, status_code=201)
def konfirmasi(data: KonfirmasiMasuk, db: DB, admin: Admin):
    """FR-PJM-10..12: periksa ulang, simpan transaksi dengan admin pemroses dari sesi."""
    h = layanan.konfirmasi(
        db, anggota_id=data.anggota_id, kode_eksemplar=data.kode_eksemplar, admin_id=admin.id
    )
    return TransaksiKeluar(
        id=h.id,
        anggota=AnggotaRingkas(kode=h.anggota_kode, nama=h.anggota_nama),
        tanggal_transaksi=h.tanggal_transaksi,
        item=[
            ItemDipinjamKeluar(
                kode_eksemplar=i.kode_eksemplar,
                judul=i.judul,
                tanggal_pinjam=i.tanggal_pinjam,
                jatuh_tempo=i.jatuh_tempo,
                status=i.status,
            )
            for i in h.item
        ],
    )

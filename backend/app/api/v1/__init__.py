from fastapi import APIRouter, Depends

from app.api.deps import butuh_admin, butuh_anggota
from app.api.v1 import auth, health, katalog
from app.api.v1.admin import eksemplar, hilang_rusak, koleksi, peminjaman, pengembalian

# NFR-SEC-03: endpoint fitur admin/anggota WAJIB didaftarkan ke router ini, bukan ke `router`.
# Pemeriksaan role terpasang di tingkat router; test audit route menjaga aturan ini.
router_admin = APIRouter(prefix="/admin", dependencies=[Depends(butuh_admin)])
router_anggota = APIRouter(prefix="/anggota", dependencies=[Depends(butuh_anggota)])
router_admin.include_router(koleksi.router)
router_admin.include_router(eksemplar.router)
router_admin.include_router(peminjaman.router)
router_admin.include_router(pengembalian.router)
router_admin.include_router(hilang_rusak.router)

router = APIRouter(prefix="/api/v1")
router.include_router(health.router)
router.include_router(auth.router)
router.include_router(katalog.router)  # publik (BR-01)
router.include_router(router_admin)
router.include_router(router_anggota)

from fastapi import APIRouter, Depends

from app.api.deps import butuh_admin, butuh_anggota
from app.api.v1 import auth, health
from app.api.v1.admin import koleksi

# NFR-SEC-03: endpoint fitur admin/anggota WAJIB didaftarkan ke router ini, bukan ke `router`.
# Pemeriksaan role terpasang di tingkat router; test audit route menjaga aturan ini.
router_admin = APIRouter(prefix="/admin", dependencies=[Depends(butuh_admin)])
router_anggota = APIRouter(prefix="/anggota", dependencies=[Depends(butuh_anggota)])
router_admin.include_router(koleksi.router)

router = APIRouter(prefix="/api/v1")
router.include_router(health.router)
router.include_router(auth.router)
router.include_router(router_admin)
router.include_router(router_anggota)

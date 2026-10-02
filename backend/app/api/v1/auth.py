"""Router autentikasi: login, logout, identitas sesi (FR-AKN-05/06, OQ-04)."""

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import butuh_login
from app.db import get_db
from app.schemas.auth import PermintaanLogin, ResponsLogin, ResponsSaya
from app.services import autentikasi
from app.services.autentikasi import NAMA_COOKIE, Pengguna

router = APIRouter(prefix="/auth", tags=["autentikasi"])

# ASUMSI(OQ-04): Secure selalu aktif, tanpa saklar (browser menganggap localhost aman).
# SameSite=Lax melindungi dari CSRF hanya bila tidak ada GET yang mengubah state.
_ATRIBUT_COOKIE = {"httponly": True, "secure": True, "samesite": "lax", "path": "/"}

TokenCookie = Annotated[str | None, Cookie(alias=NAMA_COOKIE)]
DB = Annotated[Session, Depends(get_db)]


@router.post("/login", response_model=ResponsLogin)
def login(data: PermintaanLogin, response: Response, db: DB, token: TokenCookie = None):
    """FR-AKN-05: login admin/anggota; sesi baru di cookie (OQ-04)."""
    token_baru, pengguna = autentikasi.login(
        db, email=data.email, password=data.password, token_lama=token
    )
    response.set_cookie(NAMA_COOKIE, token_baru, **_ATRIBUT_COOKIE)
    return ResponsLogin(role=pengguna.role, nama=pengguna.nama)


@router.post("/logout", status_code=204)
def logout(db: DB, token: TokenCookie = None) -> Response:
    """FR-AKN-06: akhiri sesi di server dan kosongkan cookie."""
    autentikasi.logout(db, token)
    response = Response(status_code=204)
    response.delete_cookie(NAMA_COOKIE, **_ATRIBUT_COOKIE)
    return response


@router.get("/saya", response_model=ResponsSaya)
def saya(pengguna: Annotated[Pengguna, Depends(butuh_login)]):
    """Identitas pemilik sesi, agar frontend dapat mengarahkan sesuai role (FR-AKN-05)."""
    return ResponsSaya(role=pengguna.role, nama=pengguna.nama, email=pengguna.email)

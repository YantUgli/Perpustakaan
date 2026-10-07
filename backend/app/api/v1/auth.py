"""Router autentikasi: daftar, login, logout, identitas sesi (FR-AKN-01..06, OQ-04)."""

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Form, Response, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import butuh_login
from app.db import get_db
from app.schemas.auth import PermintaanLogin, ResponsLogin, ResponsSaya
from app.schemas.pendaftaran import HasilDaftarKeluar
from app.services import autentikasi, pendaftaran
from app.services.autentikasi import NAMA_COOKIE, Pengguna

router = APIRouter(prefix="/auth", tags=["autentikasi"])

# ASUMSI(OQ-04): Secure selalu aktif, tanpa saklar (browser menganggap localhost aman).
# SameSite=Lax melindungi dari CSRF hanya bila tidak ada GET yang mengubah state.
_ATRIBUT_COOKIE = {"httponly": True, "secure": True, "samesite": "lax", "path": "/"}

TokenCookie = Annotated[str | None, Cookie(alias=NAMA_COOKIE)]
DB = Annotated[Session, Depends(get_db)]


# Isian berbentuk teks dengan bawaan "" agar isian yang hilang diperiksa service dan dilaporkan
# per isian sekaligus (IR-UI-04), bukan berhenti di validasi bawaan FastAPI.
Isian = Annotated[str, Form()]


@router.post("/daftar", response_model=HasilDaftarKeluar, status_code=201)
def daftar(
    db: DB,
    nama: Isian = "",
    alamat: Isian = "",
    email: Isian = "",
    telepon: Isian = "",
    nik: Isian = "",
    password: Isian = "",
    foto: UploadFile | None = None,
):
    """FR-AKN-01..04: pendaftaran publik; akun langsung aktif, tanpa login otomatis (OQ-30)."""
    hasil = pendaftaran.daftar(
        db,
        nama=nama,
        alamat=alamat,
        email=email,
        telepon=telepon,
        nik=nik,
        password=password,
        foto=foto.file if foto is not None else None,
    )
    return HasilDaftarKeluar(
        kode=hasil.kode, nama=hasil.nama, email=hasil.email, isi_qr=hasil.isi_qr
    )


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

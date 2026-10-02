"""Dependency autentikasi & otorisasi (NFR-SEC-03); dipasang di tingkat router (app/api/v1)."""

from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.db import get_db
from app.models.status import Role
from app.services.autentikasi import NAMA_COOKIE, Pengguna, pengguna_dari_token


def butuh_login(
    db: Annotated[Session, Depends(get_db)],
    token: Annotated[str | None, Cookie(alias=NAMA_COOKIE)] = None,
) -> Pengguna:
    """401 bila tidak ada sesi sah atau sesi kedaluwarsa (NFR-SEC-04)."""
    return pengguna_dari_token(db, token)


def butuh_admin(pengguna: Annotated[Pengguna, Depends(butuh_login)]) -> Pengguna:
    """403 bila yang login bukan admin (BR-02, NFR-SEC-03)."""
    if pengguna.role is not Role.ADMIN:
        raise GalatBisnis(
            kode="AKN_KHUSUS_ADMIN",
            pesan="Halaman ini hanya untuk admin.",
            rujukan="NFR-SEC-03",
            status_code=403,
        )
    return pengguna


def butuh_anggota(pengguna: Annotated[Pengguna, Depends(butuh_login)]) -> Pengguna:
    """403 bila yang login bukan anggota (BR-02, NFR-SEC-03)."""
    if pengguna.role is not Role.ANGGOTA:
        raise GalatBisnis(
            kode="AKN_KHUSUS_ANGGOTA",
            pesan="Halaman ini hanya untuk anggota.",
            rujukan="NFR-SEC-03",
            status_code=403,
        )
    return pengguna

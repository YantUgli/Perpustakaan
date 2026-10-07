"""Router area anggota: profil (FR-AKN-07..09). Didaftarkan ke `router_anggota` (NFR-SEC-03).

Identitas anggota selalu dari sesi; tidak ada parameter path/body berisi id atau kode anggota.
Sengaja TIDAK ada: ubah NIK/foto (K-05), unggah ulang foto, lupa password mandiri (K-03).
"""

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import butuh_anggota
from app.db import get_db
from app.schemas.anggota import GantiPasswordMasuk, ProfilKeluar, UbahProfilMasuk
from app.services import anggota as layanan
from app.services.autentikasi import NAMA_COOKIE, Pengguna

router = APIRouter(prefix="/profil", tags=["profil anggota"])
DB = Annotated[Session, Depends(get_db)]
Anggota = Annotated[Pengguna, Depends(butuh_anggota)]


@router.get("", response_model=ProfilKeluar)
def profil(db: DB, saya: Anggota):
    return ProfilKeluar.dari(layanan.profil(db, saya.id))


@router.put("", response_model=ProfilKeluar)
def ubah_profil(data: UbahProfilMasuk, db: DB, saya: Anggota):
    """FR-AKN-07/08: nama, alamat, email (cek unik lintas admin–anggota), telepon."""
    return ProfilKeluar.dari(layanan.ubah_profil(db, saya.id, **data.model_dump()))


@router.put("/password", status_code=204)
def ganti_password(
    data: GantiPasswordMasuk,
    db: DB,
    saya: Anggota,
    token: Annotated[str | None, Cookie(alias=NAMA_COOKIE)] = None,
) -> Response:
    """FR-AKN-09: wajib password lama; sesi lain akun ini dicabut (OQ-32)."""
    layanan.ganti_password(
        db,
        saya.id,
        password_lama=data.password_lama,
        password_baru=data.password_baru,
        token_sesi_kini=token,
    )
    return Response(status_code=204)

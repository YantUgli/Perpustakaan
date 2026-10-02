from pydantic import BaseModel

from app.models.status import Role


class PermintaanLogin(BaseModel):
    email: str
    password: str


class ResponsLogin(BaseModel):
    """Frontend mengarahkan ke dashboard sesuai `role` (FR-AKN-05)."""

    role: Role
    nama: str


class ResponsSaya(BaseModel):
    role: Role
    nama: str
    email: str

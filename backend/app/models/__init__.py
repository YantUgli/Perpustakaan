"""Model SQLAlchemy. Impor setiap modul model di sini agar terdaftar di `Base.metadata`."""

from app.models.base import Base

__all__ = ["Base"]

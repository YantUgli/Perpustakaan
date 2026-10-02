from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.db import get_db
from app.schemas.health import StatusHealth

router = APIRouter(tags=["health"])


@router.get("/health", response_model=StatusHealth)
def health(db: Session = Depends(get_db)) -> StatusHealth:  # noqa: B008
    """Memeriksa aplikasi hidup dan basis data dapat dihubungi."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise GalatBisnis(
            kode="DB_TIDAK_TERSEDIA",
            pesan="Basis data tidak dapat dihubungi.",
            status_code=503,
        ) from exc
    return StatusHealth(status="ok", database="ok")

from fastapi import FastAPI

from app.api.v1 import router as router_v1
from app.core.config import get_settings
from app.core.galat import daftarkan_penangan_galat


def create_app() -> FastAPI:
    get_settings()  # validasi konfigurasi (termasuk APP_ENV) saat start, bukan saat request pertama
    app = FastAPI(
        title="Sistem Informasi Perpustakaan",
        version="0.1.0",
        # Kontrak API = OpenAPI otomatis (IR-COM-01).
        openapi_url="/api/v1/openapi.json",
        docs_url="/api/v1/docs",
        redoc_url=None,
    )
    daftarkan_penangan_galat(app)
    app.include_router(router_v1)
    return app


app = create_app()

"""Konfigurasi aplikasi dari environment / berkas `.env`."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    # Hanya dipakai pytest; nama database wajib berakhiran `_test` (lihat tests/conftest.py).
    database_url_test: str | None = None

    # ASUMSI(OQ-15): hanya tiga nilai sah; salah ketik (mis. "prod") ditolak saat start.
    # Server produksi wajib APP_ENV=production (data uji/performa ditolak di sana).
    app_env: Literal["dev", "staging", "production"] = "dev"

    # Akun admin awal untuk `python -m app.seed admin` (FR-AKN-12). Jangan isi di .env.example.
    admin_awal_nama: str | None = None
    admin_awal_email: str | None = None
    admin_awal_password: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()

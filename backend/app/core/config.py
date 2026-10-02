"""Konfigurasi aplikasi dari environment / berkas `.env`."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    # Hanya dipakai pytest; nama database wajib berakhiran `_test` (lihat tests/conftest.py).
    database_url_test: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()

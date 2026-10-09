"""Konfigurasi aplikasi dari environment / berkas `.env`."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    # Hanya dipakai pytest; nama database wajib berakhiran `_test` (lihat tests/conftest.py).
    database_url_test: str | None = None

    # ASUMSI(OQ-15): hanya tiga nilai sah; salah ketik (mis. "prod") ditolak saat start.
    # Server produksi wajib APP_ENV=production (data uji/performa ditolak di sana).
    app_env: Literal["dev", "staging", "production"] = "dev"

    # Tempat simpan gambar (decisions §B "Penyimpanan file"): `lokal` = folder STORAGE_DIR (dev, CI,
    # test); `supabase` = bucket privat Supabase Storage (server; disk container tidak persisten).
    storage_backend: Literal["lokal", "supabase"] = "lokal"
    # Folder unggahan mode lokal; path di DB relatif terhadap folder ini. Jangan di-commit.
    storage_dir: Path = Path(__file__).resolve().parents[2] / "storage"
    # Mode supabase: kunci secret/service_role hanya di env server, tidak pernah ke frontend.
    supabase_url: str | None = None
    supabase_service_key: SecretStr | None = None
    supabase_bucket: str = "perpustakaan"

    # Akun admin awal untuk `python -m app.seed admin` (FR-AKN-12). Jangan isi di .env.example.
    admin_awal_nama: str | None = None
    admin_awal_email: str | None = None
    admin_awal_password: str | None = None

    # Password semua akun `python -m app.seed skenario` / `reset` (dev/staging). Jangan di-commit.
    skenario_password: str | None = None

    @model_validator(mode="after")
    def _supabase_lengkap(self) -> "Settings":
        """Mode supabase tanpa URL/kunci → gagal start, bukan gagal saat unggah pertama."""
        if self.storage_backend == "supabase" and not (
            self.supabase_url and self.supabase_service_key
        ):
            raise ValueError(
                "STORAGE_BACKEND=supabase wajib SUPABASE_URL dan SUPABASE_SERVICE_KEY."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

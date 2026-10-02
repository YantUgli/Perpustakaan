"""Fixture bersama. Semua test memakai PostgreSQL sungguhan pada database berakhiran `_test`."""

import os
from collections.abc import Callable, Iterator
from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.core import waktu
from app.core.config import Settings, get_settings
from tests.penjaga_db import DatabaseTestTidakAman, pastikan_url_db_test

# Penjaga dijalankan saat conftest dimuat, sebelum aplikasi membuat engine apa pun.
_settings_awal = Settings()
try:
    DATABASE_URL_TEST = pastikan_url_db_test(
        _settings_awal.database_url_test, _settings_awal.database_url
    )
except DatabaseTestTidakAman as exc:
    pytest.exit(f"Test dihentikan: {exc}", returncode=2)

# Arahkan aplikasi ke database test.
os.environ["DATABASE_URL"] = DATABASE_URL_TEST
get_settings.cache_clear()


def alembic_config():
    """Config Alembic yang mengarah ke database test."""
    from alembic.config import Config

    backend = Path(__file__).resolve().parents[1]
    cfg = Config(str(backend / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend / "alembic"))
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL_TEST)
    cfg.attributes["configure_logger"] = False
    return cfg


@pytest.fixture(scope="session", autouse=True)
def skema_terbaru() -> None:
    """Pastikan DB test berada di migration terbaru sebelum test apa pun (NFR-MNT-01)."""
    from alembic import command

    command.upgrade(alembic_config(), "head")


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    eng = create_engine(DATABASE_URL_TEST)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    """Sesi dalam transaksi luar yang di-rollback tiap test; commit di service = savepoint."""
    koneksi = engine.connect()
    trx = koneksi.begin()
    sesi = Session(bind=koneksi, join_transaction_mode="create_savepoint", expire_on_commit=False)
    try:
        yield sesi
    finally:
        sesi.close()
        trx.rollback()
        koneksi.close()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    from app.db import get_db
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app, base_url="https://testserver") as c:  # cookie sesi ber-atribut Secure
        yield c


@pytest.fixture
def atur_waktu() -> Iterator[Callable[[datetime], None]]:
    """Patok jam aplikasi: `atur_waktu(datetime(2026, 10, 1, 17, 0, tzinfo=UTC))`."""

    def _atur(saat: datetime) -> None:
        waktu.atur_jam(lambda: saat)

    yield _atur
    waktu.atur_jam(None)


@pytest.fixture(autouse=True)
def penyimpanan_sementara(tmp_path: Path, monkeypatch) -> Iterator[Path]:
    """Unggahan test ditulis ke folder sementara, tidak pernah ke backend/storage/."""
    folder = tmp_path / "storage"
    folder.mkdir()
    monkeypatch.setenv("STORAGE_DIR", str(folder))
    get_settings.cache_clear()
    yield folder
    monkeypatch.undo()
    get_settings.cache_clear()


@pytest.fixture
def klien_admin(client: TestClient, db: Session) -> TestClient:
    """`client` yang sudah login sebagai admin."""
    from app.core.keamanan import hash_password
    from tests import pabrik

    akun = pabrik.admin(db, password_hash=hash_password("rahasia-123"))
    r = client.post("/api/v1/auth/login", json={"email": akun.email, "password": "rahasia-123"})
    assert r.status_code == 200
    return client

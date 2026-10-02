"""NFR-MNT-01: skema hanya lewat migration; rantai migration harus naik/turun bersih."""

from pathlib import Path

from alembic.config import Config
from sqlalchemy import Engine, inspect

from alembic import command
from tests.conftest import DATABASE_URL_TEST

BACKEND = Path(__file__).resolve().parents[1]


def _config() -> Config:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL_TEST)
    cfg.attributes["configure_logger"] = False
    return cfg


def test_NFR_MNT_01_alembic_upgrade_downgrade_bersih(engine: Engine):
    cfg = _config()
    command.upgrade(cfg, "head")
    assert "alembic_version" in inspect(engine).get_table_names()
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")

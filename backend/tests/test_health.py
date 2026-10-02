from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import get_db


def test_health_ok(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": "ok"}


def test_health_db_mati_503(client):
    mati = create_engine(
        "postgresql+psycopg://x:x@127.0.0.1:1/x_test", connect_args={"connect_timeout": 1}
    )

    def _db_mati():
        with Session(bind=mati) as s:
            yield s

    client.app.dependency_overrides[get_db] = _db_mati
    r = client.get("/api/v1/health")
    assert r.status_code == 503
    assert r.json()["detail"]["kode"] == "DB_TIDAK_TERSEDIA"
    assert r.json()["detail"]["pesan"] == "Basis data tidak dapat dihubungi."


def test_IR_COM_01_openapi_tersedia_di_prefix_v1(client):
    r = client.get("/api/v1/openapi.json")
    assert r.status_code == 200
    assert "/api/v1/health" in r.json()["paths"]

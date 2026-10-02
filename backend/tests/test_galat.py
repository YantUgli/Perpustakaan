"""Format error standar (decisions.md §B)."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.galat import GalatBisnis, daftarkan_penangan_galat


def test_format_galat_bisnis():
    app = FastAPI()
    daftarkan_penangan_galat(app)

    @app.get("/coba")
    def coba():
        raise GalatBisnis(
            kode="PJM_ITEM_MELEBIHI_BATAS",
            pesan="Anggota sudah meminjam 3 eksemplar; batas maksimal 3.",
            rujukan="FR-PJM-08",
            status_code=409,
        )

    r = TestClient(app).get("/coba")
    assert r.status_code == 409
    assert r.json() == {
        "detail": {
            "kode": "PJM_ITEM_MELEBIHI_BATAS",
            "pesan": "Anggota sudah meminjam 3 eksemplar; batas maksimal 3.",
            "rujukan": "FR-PJM-08",
        }
    }

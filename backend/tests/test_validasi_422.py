"""Titipan 5.1 (dikerjakan WP 5.3.3): galat 422 validasi FastAPI berbahasa Indonesia, format §B.

NFR-USA-02, IR-UI-04, IR-COM-01. Penangan tidak pernah memantulkan `input`/`ctx`/`url` Pydantic.
"""

import pytest
from fastapi.exceptions import RequestValidationError

from app.core.galat import galat_validasi

RAHASIA = "RahasiaSangatPenting-9"
_KATA_INGGRIS = ("Field required", "Input should", "valid integer", "JSON decode", "Value error")


def _detail(r) -> dict:
    assert r.status_code == 422, r.text
    for kata in _KATA_INGGRIS:
        assert kata not in r.text, r.text
    d = r.json()["detail"]
    assert d["kode"] == "VALIDASI_ISIAN"
    assert d["rujukan"] == "IR-UI-04"
    return d


def test_NFR_USA_02_isian_hilang_wajib_diisi_per_isian(client):
    d = _detail(client.post("/api/v1/auth/login", json={}))
    assert d["isian"] == {"email": "Wajib diisi.", "password": "Wajib diisi."}
    assert "email" in d["pesan"] and "password" in d["pesan"]


def test_NFR_USA_02_json_rusak(client):
    r = client.post(
        "/api/v1/auth/login",
        content='{"email": "a@b.example", "password": "' + RAHASIA,
        headers={"content-type": "application/json"},
    )
    d = _detail(r)
    assert d["pesan"] == "Data permintaan bukan JSON yang valid."
    assert RAHASIA not in r.text


@pytest.mark.parametrize(
    "password",
    [[RAHASIA], {"isi": RAHASIA}, 123],
)
def test_IR_UI_04_password_tidak_pernah_terpantul(client, password):
    r = client.post("/api/v1/auth/login", json={"email": "x@perpus.example", "password": password})
    d = _detail(r)
    assert d["isian"] == {"password": "Harus berupa teks."}
    assert RAHASIA not in r.text
    assert "input" not in r.text and "ctx" not in r.text and "url" not in r.text


@pytest.mark.parametrize(
    ("params", "isian"),
    [
        ({"halaman": 0}, {"halaman": "Minimal 1."}),
        ({"per_halaman": 101}, {"per_halaman": "Maksimal 100."}),
        ({"halaman": "x"}, {"halaman": "Harus berupa bilangan bulat."}),
    ],
)
def test_NFR_USA_02_query_batas_dan_tipe(client, params, isian):
    assert _detail(client.get("/api/v1/katalog/judul", params=params))["isian"] == isian


def test_NFR_USA_02_literal_dan_tanggal(klien_admin):
    d = _detail(klien_admin.get("/api/v1/admin/tagihan", params={"status": "TERLAMBAT"}))
    assert d["isian"] == {"status": "Harus salah satu dari: BELUM_LUNAS, LUNAS."}

    d = _detail(
        klien_admin.post(
            "/api/v1/admin/tagihan/1/penyelesaian",
            json={"cara": "TUNAI", "nominal": 1, "tanggal": "15-11-2026"},
        )
    )
    assert d["isian"] == {"tanggal": "Format tanggal tidak valid (YYYY-MM-DD)."}


def test_IR_UI_04_tipe_tak_dipetakan_pakai_pesan_cadangan_tanpa_input():
    exc = RequestValidationError(
        [
            {
                "type": "jenis_aneh_baru",
                "loc": ("body", "kode_rak"),
                "msg": "Some English message",
                "input": RAHASIA,
                "ctx": {"rahasia": RAHASIA},
            }
        ]
    )
    g = galat_validasi(exc)
    assert (g.kode, g.status_code, g.rujukan) == ("VALIDASI_ISIAN", 422, "IR-UI-04")
    assert g.isian == {"kode_rak": "Nilai tidak valid."}
    teks = str(g.ke_dict())
    assert RAHASIA not in teks and "Some English" not in teks


def test_IR_UI_04_kunci_isian_tanpa_prefix_dan_indeks():
    exc = RequestValidationError(
        [
            {"type": "missing", "loc": ("body", "kode_eksemplar"), "msg": "x", "input": None},
            {"type": "int_parsing", "loc": ("query", "id", 2), "msg": "x", "input": "a"},
        ]
    )
    assert galat_validasi(exc).isian == {
        "kode_eksemplar": "Wajib diisi.",
        "id": "Harus berupa bilangan bulat.",
    }


def test_format_galat_dengan_isian():
    from app.core.galat import GalatBisnis

    g = GalatBisnis("X", "Periksa isian: NIK.", "FR-AKN-03", 422, isian={"nik": "Salah."})
    assert g.ke_dict() == {
        "detail": {
            "kode": "X",
            "pesan": "Periksa isian: NIK.",
            "rujukan": "FR-AKN-03",
            "isian": {"nik": "Salah."},
        }
    }


def test_IR_COM_01_skema_422_openapi_mengikuti_format_galat():
    from app.main import create_app

    spec = create_app().openapi()
    skema = spec["components"]["schemas"]
    assert "HTTPValidationError" not in skema and "ValidationError" not in skema
    assert set(skema["GalatDetail"]["properties"]) == {"kode", "pesan", "rujukan", "isian"}
    assert set(skema["GalatDetail"]["required"]) == {"kode", "pesan"}
    assert skema["GalatRespons"]["properties"]["detail"]["$ref"].endswith("/GalatDetail")
    ref_422 = [
        op["responses"]["422"]["content"]["application/json"]["schema"]["$ref"]
        for path in spec["paths"].values()
        for op in path.values()
        if "422" in op.get("responses", {})
    ]
    assert ref_422  # ada endpoint dengan 422
    assert set(ref_422) == {"#/components/schemas/GalatRespons"}
    daftar = spec["paths"]["/api/v1/auth/daftar"]["post"]["responses"]["422"]
    assert daftar["description"] == "Validasi isian gagal"

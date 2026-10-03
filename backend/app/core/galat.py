"""Format error standar (docs/proyek/decisions.md §B).

Bentuk respons: `{"detail": {"kode": ..., "pesan": ..., "rujukan": ...}}`, ditambah `isian`
(`{nama_isian: pesan}`) hanya bila galat menyangkut isian tertentu (IR-UI-04).
`pesan` wajib kalimat Bahasa Indonesia yang menyebut alasan konkret.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class GalatBisnis(Exception):
    def __init__(
        self,
        kode: str,
        pesan: str,
        rujukan: str | None = None,
        status_code: int = 400,
        isian: dict[str, str] | None = None,
    ) -> None:
        super().__init__(pesan)
        self.kode = kode
        self.pesan = pesan
        self.rujukan = rujukan
        self.status_code = status_code
        self.isian = isian or None

    def ke_dict(self) -> dict:
        detail = {"kode": self.kode, "pesan": self.pesan, "rujukan": self.rujukan}
        if self.isian:
            detail["isian"] = dict(self.isian)
        return {"detail": detail}


def _tangani_galat_bisnis(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, GalatBisnis)  # noqa: S101 — hanya didaftarkan untuk GalatBisnis
    return JSONResponse(status_code=exc.status_code, content=exc.ke_dict())


# Lokasi dari `loc` Pydantic yang bukan nama isian.
_LOKASI = {"body", "query", "path", "header", "cookie"}
_PESAN_TETAP = {
    "missing": "Wajib diisi.",
    "string_type": "Harus berupa teks.",
    "int_type": "Harus berupa bilangan bulat.",
    "int_parsing": "Harus berupa bilangan bulat.",
    "int_from_float": "Harus berupa bilangan bulat.",
    "bool_type": "Harus berupa benar/salah.",
    "bool_parsing": "Harus berupa benar/salah.",
    "date_type": "Format tanggal tidak valid (YYYY-MM-DD).",
    "date_parsing": "Format tanggal tidak valid (YYYY-MM-DD).",
    "date_from_datetime_parsing": "Format tanggal tidak valid (YYYY-MM-DD).",
    "date_from_datetime_inexact": "Format tanggal tidak valid (YYYY-MM-DD).",
    "list_type": "Harus berupa daftar.",
    "dict_type": "Format data tidak valid.",
    "model_attributes_type": "Format data tidak valid.",
    "extra_forbidden": "Isian ini tidak dikenal atau tidak dapat diubah.",  # K-05, NFR-SEC-03
}
_PESAN_BATAS = {  # tipe → (kunci ctx, templat); ctx berisi batas skema, bukan masukan pengguna
    "greater_than_equal": ("ge", "Minimal {}."),
    "less_than_equal": ("le", "Maksimal {}."),
    "greater_than": ("gt", "Harus lebih dari {}."),
    "less_than": ("lt", "Harus kurang dari {}."),
    "string_too_short": ("min_length", "Minimal {} karakter."),
    "string_too_long": ("max_length", "Maksimal {} karakter."),
}
_PESAN_CADANGAN = "Nilai tidak valid."


def _nama_isian(loc: tuple) -> str | None:
    nama = [x for x in loc if isinstance(x, str) and x not in _LOKASI]
    return nama[-1] if nama else None


def _pesan_indonesia(err: dict) -> str:
    """Pesan Indonesia dari tipe galat Pydantic. Sengaja tidak memakai `msg` (Inggris) maupun
    `input`; dari `ctx` hanya diambil batas/pilihan yang didefinisikan skema."""
    jenis = err.get("type", "")
    ctx = err.get("ctx") or {}
    if jenis in _PESAN_TETAP:
        return _PESAN_TETAP[jenis]
    if jenis in _PESAN_BATAS:
        kunci, templat = _PESAN_BATAS[jenis]
        return templat.format(ctx[kunci]) if kunci in ctx else _PESAN_CADANGAN
    if jenis in {"literal_error", "enum"} and "expected" in ctx:
        pilihan = str(ctx["expected"]).replace("'", "").replace(" or ", ", ")
        return f"Harus salah satu dari: {pilihan}."
    return _PESAN_CADANGAN


def galat_validasi(exc: RequestValidationError) -> GalatBisnis:
    """Titipan 5.1 (NFR-USA-02, IR-UI-04): 422 validasi FastAPI → format §B berbahasa Indonesia.

    Tidak pernah memuat `input`, `ctx`, `url`, atau `msg` Pydantic — mencegah password terpantul."""
    isian: dict[str, str] = {}
    umum: list[str] = []
    for err in exc.errors():
        if err.get("type") == "json_invalid":
            umum.append("Data permintaan bukan JSON yang valid.")
            continue
        nama = _nama_isian(tuple(err.get("loc", ())))
        if nama is None:
            umum.append("Format data permintaan tidak valid.")
        else:
            isian.setdefault(nama, _pesan_indonesia(err))  # satu pesan pertama per isian
    if isian:
        pesan = f"Periksa isian: {', '.join(isian)}."
    else:
        pesan = umum[0] if umum else "Data permintaan tidak valid."
    return GalatBisnis(
        kode="VALIDASI_ISIAN", pesan=pesan, rujukan="IR-UI-04", status_code=422, isian=isian
    )


def _tangani_validasi(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)  # noqa: S101
    galat = galat_validasi(exc)
    return JSONResponse(status_code=galat.status_code, content=galat.ke_dict())


def daftarkan_penangan_galat(app: FastAPI) -> None:
    app.add_exception_handler(GalatBisnis, _tangani_galat_bisnis)
    app.add_exception_handler(RequestValidationError, _tangani_validasi)


class GalatDetail(BaseModel):
    kode: str
    pesan: str
    rujukan: str | None = None
    isian: dict[str, str] | None = None


class GalatRespons(BaseModel):
    detail: GalatDetail


def pasang_skema_galat_openapi(app: FastAPI) -> None:
    """IR-COM-01: skema 422 di OpenAPI mengikuti format galat §B (bukan `HTTPValidationError`)."""

    def openapi() -> dict:
        if app.openapi_schema:
            return app.openapi_schema
        spec = get_openapi(title=app.title, version=app.version, routes=app.routes)
        skema = spec.setdefault("components", {}).setdefault("schemas", {})
        skema.pop("HTTPValidationError", None)
        skema.pop("ValidationError", None)
        tambahan = GalatRespons.model_json_schema(ref_template="#/components/schemas/{model}")
        skema.update(tambahan.pop("$defs", {}))
        skema["GalatRespons"] = tambahan
        for path in spec.get("paths", {}).values():
            for op in path.values():
                if "422" in op.get("responses", {}):
                    op["responses"]["422"] = {
                        "description": "Validasi isian gagal",
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/GalatRespons"}
                            }
                        },
                    }
        app.openapi_schema = spec
        return spec

    app.openapi = openapi

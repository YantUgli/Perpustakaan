"""Format error standar (docs/proyek/decisions.md §B).

Bentuk respons: `{"detail": {"kode": ..., "pesan": ..., "rujukan": ...}}`.
`pesan` wajib kalimat Bahasa Indonesia yang menyebut alasan konkret.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class GalatBisnis(Exception):
    def __init__(
        self,
        kode: str,
        pesan: str,
        rujukan: str | None = None,
        status_code: int = 400,
    ) -> None:
        super().__init__(pesan)
        self.kode = kode
        self.pesan = pesan
        self.rujukan = rujukan
        self.status_code = status_code

    def ke_dict(self) -> dict:
        return {"detail": {"kode": self.kode, "pesan": self.pesan, "rujukan": self.rujukan}}


def _tangani_galat_bisnis(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, GalatBisnis)  # noqa: S101 — hanya didaftarkan untuk GalatBisnis
    return JSONResponse(status_code=exc.status_code, content=exc.ke_dict())


def daftarkan_penangan_galat(app: FastAPI) -> None:
    app.add_exception_handler(GalatBisnis, _tangani_galat_bisnis)

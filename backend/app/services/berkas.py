"""Unggahan gambar (cover; nanti foto anggota WP 5.3.3): NFR-SEC-06.

- Jenis ditentukan dari **isi** (magic bytes + dekode penuh Pillow), bukan nama/Content-Type.
- Nama berkas di disk dibuat server (UUID + ekstensi format terdeteksi); nama klien diabaikan.
- Path yang disimpan di DB relatif terhadap `STORAGE_DIR`.
"""

import io
import uuid
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from PIL import Image, UnidentifiedImageError

from app.core.config import get_settings
from app.core.galat import GalatBisnis

UKURAN_MAKS_GAMBAR = 2 * 1024 * 1024  # NFR-SEC-06: 2 MB = 2.097.152 byte; tepat 2 MB masih diterima
BATAS_PIKSEL = 40_000_000  # cegah decompression bomb (berkas kecil, resolusi raksasa)

# Batas piksel dipasang eksplisit; peringatan bom Pillow (> batas) diperlakukan sebagai galat, dan
# Pillow sendiri melempar DecompressionBombError di atas 2× batas. Filter dipasang sekali saat impor
# (bukan catch_warnings per panggilan) agar aman dipakai bersamaan di threadpool FastAPI.
Image.MAX_IMAGE_PIXELS = BATAS_PIKSEL
warnings.filterwarnings("error", category=Image.DecompressionBombWarning)

_MAGIC = {b"\xff\xd8\xff": "JPEG", b"\x89PNG\r\n\x1a\n": "PNG"}
_EKSTENSI = {"JPEG": "jpg", "PNG": "png"}
_MEDIA_TYPE = {"jpg": "image/jpeg", "png": "image/png"}
_UKURAN_POTONGAN = 64 * 1024


@dataclass(frozen=True)
class GambarSah:
    isi: bytes
    ekstensi: str


def _galat(kode: str, pesan: str) -> GalatBisnis:
    return GalatBisnis(kode=kode, pesan=pesan, rujukan="NFR-SEC-06", status_code=422)


def _baca_terbatas(berkas: BinaryIO, maks: int) -> bytes:
    """Baca paling banyak `maks + 1` byte; lebih dari `maks` → ditolak tanpa membaca sisanya."""
    potongan, total = [], 0
    while total <= maks:
        data = berkas.read(min(_UKURAN_POTONGAN, maks + 1 - total))
        if not data:
            break
        potongan.append(data)
        total += len(data)
    if total > maks:
        raise _galat("BKU_COVER_TERLALU_BESAR", "Ukuran berkas melebihi batas 2 MB.")
    return b"".join(potongan)


def periksa_gambar(berkas: BinaryIO, *, label: str = "Cover") -> GambarSah:
    """NFR-SEC-06: JPG/PNG, ≤ 2 MB, dapat didekode utuh, resolusi ≤ BATAS_PIKSEL."""
    isi = _baca_terbatas(berkas, UKURAN_MAKS_GAMBAR)
    format_magic = next((f for m, f in _MAGIC.items() if isi.startswith(m)), None)
    if format_magic is None:
        raise _galat("BKU_COVER_FORMAT", f"{label} harus berupa gambar JPG atau PNG.")
    try:
        with Image.open(io.BytesIO(isi)) as img:
            if img.format != format_magic:
                raise _galat("BKU_COVER_FORMAT", f"{label} harus berupa gambar JPG atau PNG.")
            if img.width * img.height > BATAS_PIKSEL:
                raise Image.DecompressionBombError
            img.load()  # dekode penuh: berkas terpotong/rusak gagal di sini
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise _galat(
            "BKU_COVER_RESOLUSI",
            f"Resolusi gambar terlalu besar (maksimal {BATAS_PIKSEL // 1_000_000} megapiksel).",
        ) from exc
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise _galat("BKU_COVER_RUSAK", "Berkas gambar rusak atau tidak dapat dibaca.") from exc
    return GambarSah(isi=isi, ekstensi=_EKSTENSI[format_magic])


def _folder() -> Path:
    return get_settings().storage_dir.resolve()


def _path_absolut(path_relatif: str) -> Path:
    folder = _folder()
    path = (folder / path_relatif).resolve()
    if not path.is_relative_to(folder):  # pertahanan berlapis; path di DB selalu buatan server
        raise ValueError(f"Path di luar STORAGE_DIR: {path_relatif}")
    return path


def simpan(gambar: GambarSah, subfolder: str) -> str:
    """Tulis ke `<STORAGE_DIR>/<subfolder>/<uuid>.<ext>`; kembalikan path relatif untuk DB."""
    path_relatif = f"{subfolder}/{uuid.uuid4().hex}.{gambar.ekstensi}"
    path = _path_absolut(path_relatif)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as f:  # "x": tidak pernah menimpa berkas yang ada
        f.write(gambar.isi)
    return path_relatif


@dataclass(frozen=True)
class BerkasTersimpan:
    path: Path
    media_type: str


def berkas_tersimpan(path_relatif: str | None) -> BerkasTersimpan | None:
    """Berkas yang aman disajikan: ada di disk, di dalam `STORAGE_DIR`, berekstensi buatan server.

    Content-Type diambil dari ekstensi yang dibuat `simpan()`, bukan dari isi permintaan.
    Selain itu (kosong, di luar folder, hilang, ekstensi asing) → None.
    """
    if not path_relatif:
        return None
    try:
        path = _path_absolut(path_relatif)
    except ValueError:
        return None
    media_type = _MEDIA_TYPE.get(path.suffix.lstrip(".").lower())
    if media_type is None or not path.is_file():
        return None
    return BerkasTersimpan(path=path, media_type=media_type)


def hapus(path_relatif: str | None) -> None:
    if path_relatif:
        _path_absolut(path_relatif).unlink(missing_ok=True)

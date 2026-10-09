"""Unggahan gambar (cover WP 5.3.5, foto anggota WP 5.3.3): NFR-SEC-06.

- Jenis ditentukan dari **isi** (magic bytes + dekode penuh Pillow), bukan nama/Content-Type.
- Nama berkas dibuat server (`<subfolder>/<uuid>.<ext>`); nama klien diabaikan.
- Path di DB sama untuk kedua tempat simpan (decisions §B "Penyimpanan file", `STORAGE_BACKEND`):
  `lokal` → relatif terhadap `STORAGE_DIR`; `supabase` → nama objek di bucket privat Supabase
  Storage.
  Gambar hanya keluar lewat endpoint backend (foto: OQ-42), tidak pernah lewat URL bucket.
"""

import io
import logging
import re
import uuid
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Protocol

import httpx
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


def _baca_terbatas(berkas: BinaryIO, maks: int, prefiks: str) -> bytes:
    """Baca paling banyak `maks + 1` byte; lebih dari `maks` → ditolak tanpa membaca sisanya."""
    potongan, total = [], 0
    while total <= maks:
        data = berkas.read(min(_UKURAN_POTONGAN, maks + 1 - total))
        if not data:
            break
        potongan.append(data)
        total += len(data)
    if total > maks:
        raise _galat(f"{prefiks}_TERLALU_BESAR", "Ukuran berkas melebihi batas 2 MB.")
    return b"".join(potongan)


def periksa_gambar(
    berkas: BinaryIO, *, label: str = "Cover", prefiks: str = "BKU_COVER"
) -> GambarSah:
    """NFR-SEC-06: JPG/PNG, ≤ 2 MB, dapat didekode utuh, resolusi ≤ BATAS_PIKSEL.

    Kode galat `<prefiks>_*`: cover `BKU_COVER_*` (kontrak 5.3.5), foto anggota `AKN_FOTO_*`."""
    isi = _baca_terbatas(berkas, UKURAN_MAKS_GAMBAR, prefiks)
    format_magic = next((f for m, f in _MAGIC.items() if isi.startswith(m)), None)
    if format_magic is None:
        raise _galat(f"{prefiks}_FORMAT", f"{label} harus berupa gambar JPG atau PNG.")
    try:
        with Image.open(io.BytesIO(isi)) as img:
            if img.format != format_magic:
                raise _galat(f"{prefiks}_FORMAT", f"{label} harus berupa gambar JPG atau PNG.")
            if img.width * img.height > BATAS_PIKSEL:
                raise Image.DecompressionBombError
            img.load()  # dekode penuh: berkas terpotong/rusak gagal di sini
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise _galat(
            f"{prefiks}_RESOLUSI",
            f"Resolusi gambar terlalu besar (maksimal {BATAS_PIKSEL // 1_000_000} megapiksel).",
        ) from exc
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise _galat(f"{prefiks}_RUSAK", "Berkas gambar rusak atau tidak dapat dibaca.") from exc
    return GambarSah(isi=isi, ekstensi=_EKSTENSI[format_magic])


# ------------------------------------------------------------------------------- tempat simpan

log = logging.getLogger(__name__)

# Bentuk path buatan `simpan()`; selain ini tidak pernah dibaca/dikirim (pertahanan berlapis).
_POLA_PATH = re.compile(r"(cover|foto)/[0-9a-f]{32}\.(jpg|png)")
_TIMEOUT_DETIK = 10.0
# Diisi test dengan httpx.MockTransport agar mode supabase diuji tanpa jaringan.
TRANSPORT_UJI: httpx.BaseTransport | None = None


@dataclass(frozen=True)
class BerkasTersimpan:
    isi: bytes
    media_type: str


def _galat_penyimpanan() -> GalatBisnis:
    """Tempat simpan tak dapat dihubungi: unggah ditolak sebelum DB berubah, baca → 503."""
    return GalatBisnis(
        kode="BERKAS_PENYIMPANAN_GAGAL",
        pesan="Penyimpanan gambar sedang tidak dapat dihubungi. Coba lagi beberapa saat.",
        rujukan="NFR-REL-01",
        status_code=503,
    )


class _Penyimpanan(Protocol):
    def tulis(self, path: str, isi: bytes, media_type: str) -> None: ...
    def baca(self, path: str) -> bytes | None: ...
    def ada(self, path: str) -> bool: ...
    def hapus(self, path: str) -> None: ...


class _Lokal:
    """Folder `STORAGE_DIR`: dev, CI, test. Di server container, disk hilang setiap deploy."""

    def __init__(self, folder: Path) -> None:
        self.folder = folder.resolve()

    def _absolut(self, path: str) -> Path:
        absolut = (self.folder / path).resolve()
        if not absolut.is_relative_to(self.folder):  # pola path sudah dicek; ini lapis kedua
            raise ValueError(f"Path di luar STORAGE_DIR: {path}")
        return absolut

    def tulis(self, path: str, isi: bytes, media_type: str) -> None:
        absolut = self._absolut(path)
        absolut.parent.mkdir(parents=True, exist_ok=True)
        with absolut.open("xb") as f:  # "x": tidak pernah menimpa berkas yang ada
            f.write(isi)

    def baca(self, path: str) -> bytes | None:
        absolut = self._absolut(path)
        return absolut.read_bytes() if absolut.is_file() else None

    def ada(self, path: str) -> bool:
        return self._absolut(path).is_file()

    def hapus(self, path: str) -> None:
        self._absolut(path).unlink(missing_ok=True)


class _Supabase:
    """Bucket privat Supabase Storage lewat REST API, dengan kunci secret/service_role."""

    def __init__(self, url: str, kunci: str, bucket: str) -> None:
        self.dasar = f"{url.rstrip('/')}/storage/v1/object"
        self.bucket = bucket
        self.header = {"apikey": kunci, "Authorization": f"Bearer {kunci}"}

    def _klien(self) -> httpx.Client:
        return httpx.Client(headers=self.header, timeout=_TIMEOUT_DETIK, transport=TRANSPORT_UJI)

    @staticmethod
    def _hilang(r: httpx.Response) -> bool:
        """Objek tidak ada: 404, atau 400 ber-`statusCode` "404" (bentuk lama Storage API)."""
        if r.status_code == 404:
            return True
        if r.status_code == 400:
            try:
                return str(r.json().get("statusCode")) == "404"
            except ValueError:
                return False
        return False

    def _minta(self, metode: str, url: str, **kw) -> httpx.Response:
        try:
            with self._klien() as k:
                return k.request(metode, url, **kw)
        except httpx.HTTPError as exc:
            log.warning("Supabase Storage %s gagal: %s", metode, type(exc).__name__)
            raise _galat_penyimpanan() from exc

    def tulis(self, path: str, isi: bytes, media_type: str) -> None:
        r = self._minta(
            "POST",
            f"{self.dasar}/{self.bucket}/{path}",
            content=isi,
            headers={"Content-Type": media_type, "x-upsert": "false"},
        )
        if r.status_code != 200:
            log.warning("Supabase Storage unggah ditolak: HTTP %s", r.status_code)
            raise _galat_penyimpanan()

    def baca(self, path: str) -> bytes | None:
        r = self._minta("GET", f"{self.dasar}/authenticated/{self.bucket}/{path}")
        if r.status_code == 200:
            return r.content
        if self._hilang(r):
            return None
        log.warning("Supabase Storage baca ditolak: HTTP %s", r.status_code)
        raise _galat_penyimpanan()

    def ada(self, path: str) -> bool:
        """Gangguan → False: halaman profil tetap terbuka dengan avatar inisial (OQ-42)."""
        try:
            r = self._minta("HEAD", f"{self.dasar}/authenticated/{self.bucket}/{path}")
        except GalatBisnis:
            return False
        return r.status_code == 200

    def hapus(self, path: str) -> None:
        """Dipanggil setelah commit; gangguan hanya dicatat (objek yatim), tidak menggagalkan."""
        try:
            r = self._minta("DELETE", f"{self.dasar}/{self.bucket}", json={"prefixes": [path]})
        except GalatBisnis:
            return
        if r.status_code != 200:
            log.warning("Supabase Storage hapus ditolak: HTTP %s", r.status_code)


def _penyimpanan() -> _Penyimpanan:
    s = get_settings()
    if s.storage_backend == "supabase" and s.supabase_url and s.supabase_service_key:
        # URL & kunci dijamin ada oleh validator Settings untuk mode supabase.
        kunci = s.supabase_service_key.get_secret_value()
        return _Supabase(s.supabase_url, kunci, s.supabase_bucket)
    return _Lokal(s.storage_dir)


def _path_sah(path_relatif: str | None) -> bool:
    return bool(path_relatif) and _POLA_PATH.fullmatch(path_relatif) is not None


def simpan(gambar: GambarSah, subfolder: str) -> str:
    """Simpan ke `<subfolder>/<uuid>.<ext>`; kembalikan path untuk DB. Gangguan → 503."""
    path_relatif = f"{subfolder}/{uuid.uuid4().hex}.{gambar.ekstensi}"
    _penyimpanan().tulis(path_relatif, gambar.isi, _MEDIA_TYPE[gambar.ekstensi])
    return path_relatif


def berkas_tersimpan(path_relatif: str | None) -> BerkasTersimpan | None:
    """Gambar yang aman disajikan: path berbentuk buatan server dan objeknya ada.

    Content-Type diambil dari ekstensi yang dibuat `simpan()`, bukan dari isi permintaan.
    Kosong, bentuk path asing, atau objek hilang → None (endpoint 404); gangguan → 503.
    """
    if not _path_sah(path_relatif):
        return None
    isi = _penyimpanan().baca(path_relatif)
    if isi is None:
        return None
    return BerkasTersimpan(isi=isi, media_type=_MEDIA_TYPE[path_relatif.rsplit(".", 1)[1]])


def ada(path_relatif: str | None) -> bool:
    """Penanda `ada_foto` (OQ-42) tanpa mengunduh isi; gangguan → False."""
    return _path_sah(path_relatif) and _penyimpanan().ada(path_relatif)


def hapus(path_relatif: str | None) -> None:
    if _path_sah(path_relatif):
        _penyimpanan().hapus(path_relatif)

"""WP 5.3.5 — unggah cover judul: NFR-SEC-06 (JPG/PNG, ≤ 2 MB, isi diperiksa), OQ-12, OQ-19."""

import io
import struct
import subprocess
import sys
import zlib
from pathlib import Path

import pytest
from PIL import Image
from sqlalchemy.orm import Session

from app.models import JudulBuku
from app.services.berkas import BATAS_PIKSEL, UKURAN_MAKS_GAMBAR
from tests import pabrik

API = "/api/v1/admin/judul"


def _gambar(fmt: str, ukuran: tuple[int, int] = (20, 30)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", ukuran, (200, 30, 30)).save(buf, format=fmt)
    return buf.getvalue()


def _png_header_saja(lebar: int, tinggi: int) -> bytes:
    """PNG sah secara struktur dengan dimensi raksasa tetapi berkas kecil (decompression bomb)."""

    def chunk(jenis: bytes, isi: bytes) -> bytes:
        return (
            struct.pack(">I", len(isi)) + jenis + isi + struct.pack(">I", zlib.crc32(jenis + isi))
        )

    ihdr = struct.pack(">IIBBBBB", lebar, tinggi, 1, 0, 0, 0, 0)  # 1-bit grayscale
    idat = zlib.compress(b"\x00" * 64)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def _unggah(klien, judul_id: int, isi: bytes, nama: str = "cover.jpg", tipe: str = "image/jpeg"):
    return klien.put(f"{API}/{judul_id}/cover", files={"berkas": (nama, isi, tipe)})


def _berkas_di(folder: Path) -> list[Path]:
    return sorted(p for p in folder.rglob("*") if p.is_file())


def _galat(r, kode: str) -> dict:
    assert r.status_code == 422, r.text
    assert r.json()["detail"]["kode"] == kode
    assert r.json()["detail"]["rujukan"] == "NFR-SEC-06"
    return r.json()["detail"]


# ------------------------------------------------------------------------------------ diterima


@pytest.mark.parametrize(("fmt", "ext"), [("JPEG", "jpg"), ("PNG", "png")])
def test_NFR_SEC_06_cover_jpg_dan_png_diterima(
    klien_admin, db: Session, penyimpanan_sementara, fmt, ext
):
    j = pabrik.judul(db)
    r = _unggah(klien_admin, j.id, _gambar(fmt), nama=f"sampul.{ext}")
    assert r.status_code == 200, r.text
    path = r.json()["cover_path"]
    assert path.startswith("cover/") and path.endswith(f".{ext}")
    assert (penyimpanan_sementara / path).read_bytes() == _gambar(fmt)
    db.expire_all()
    assert db.get(JudulBuku, j.id).cover_path == path  # relatif terhadap STORAGE_DIR


def test_NFR_SEC_06_ekstensi_mengikuti_isi_bukan_nama(klien_admin, db):
    j = pabrik.judul(db)
    r = _unggah(klien_admin, j.id, _gambar("PNG"), nama="foto.jpg", tipe="image/jpeg")
    assert r.status_code == 200
    assert r.json()["cover_path"].endswith(".png")


def test_NFR_SEC_06_cover_tepat_2mb_diterima(klien_admin, db):
    isi = _gambar("PNG")
    isi += b"\x00" * (UKURAN_MAKS_GAMBAR - len(isi))  # data setelah IEND diabaikan dekoder
    assert len(isi) == 2_097_152
    assert _unggah(klien_admin, pabrik.judul(db).id, isi, nama="a.png").status_code == 200


# ------------------------------------------------------------------------------------ ditolak


def test_NFR_SEC_06_cover_2mb_tambah_1_byte_ditolak(klien_admin, db, penyimpanan_sementara):
    isi = _gambar("PNG")
    isi += b"\x00" * (UKURAN_MAKS_GAMBAR + 1 - len(isi))
    d = _galat(
        _unggah(klien_admin, pabrik.judul(db).id, isi, nama="a.png"), "BKU_COVER_TERLALU_BESAR"
    )
    assert d["pesan"] == "Ukuran berkas melebihi batas 2 MB."
    assert _berkas_di(penyimpanan_sementara) == []


@pytest.mark.parametrize(
    ("isi", "nama"),
    [
        (_gambar("GIF"), "anim.gif"),
        (b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\n", "dokumen.jpg"),
        (b"bukan gambar sama sekali", "teks.png"),
        (b"<svg xmlns='http://www.w3.org/2000/svg'/>", "vektor.png"),
    ],
    ids=["gif", "pdf_berekstensi_jpg", "teks_berekstensi_png", "svg"],
)
def test_NFR_SEC_06_selain_jpg_png_ditolak_berdasarkan_isi(
    klien_admin, db, penyimpanan_sementara, isi, nama
):
    d = _galat(_unggah(klien_admin, pabrik.judul(db).id, isi, nama=nama), "BKU_COVER_FORMAT")
    assert d["pesan"] == "Cover harus berupa gambar JPG atau PNG."
    assert _berkas_di(penyimpanan_sementara) == []


def test_NFR_SEC_06_jpeg_rusak_dengan_magic_bytes_benar_ditolak(
    klien_admin, db, penyimpanan_sementara
):
    utuh = _gambar("JPEG", (200, 200))
    rusak = utuh[: len(utuh) // 2]
    assert rusak[:3] == b"\xff\xd8\xff"
    d = _galat(_unggah(klien_admin, pabrik.judul(db).id, rusak), "BKU_COVER_RUSAK")
    assert d["pesan"] == "Berkas gambar rusak atau tidak dapat dibaca."
    assert _berkas_di(penyimpanan_sementara) == []


@pytest.mark.parametrize(
    "dimensi",
    [
        (7_000, 7_000),
        (30_000, 30_000),
    ],  # di atas batas (peringatan Pillow) dan di atas 2× batas (galat)
    ids=["di_atas_batas", "jauh_di_atas_batas"],
)
def test_NFR_SEC_06_decompression_bomb_ditolak(klien_admin, db, penyimpanan_sementara, dimensi):
    assert dimensi[0] * dimensi[1] > BATAS_PIKSEL
    isi = _png_header_saja(*dimensi)
    assert len(isi) < 1_000
    d = _galat(_unggah(klien_admin, pabrik.judul(db).id, isi, nama="bom.png"), "BKU_COVER_RESOLUSI")
    assert d["pesan"] == "Resolusi gambar terlalu besar (maksimal 40 megapiksel)."
    assert _berkas_di(penyimpanan_sementara) == []


def test_NFR_SEC_06_peringatan_bom_pillow_jadi_galat_di_proses_aplikasi(penyimpanan_sementara):
    """Di luar pytest (proses aplikasi biasa): filter dari berkas.py membuat peringatan jadi galat.

    Dimensi di antara batas dan 2× batas: Pillow hanya *memperingatkan*, tidak melempar galat.
    """
    bom = penyimpanan_sementara / "bom.png"
    bom.write_bytes(_png_header_saja(7_000, 7_000))
    kode = (
        "import sys; from PIL import Image; import app.services.berkas\n"
        "try:\n    Image.open(sys.argv[1])\n"
        "except Image.DecompressionBombWarning:\n    print('GALAT')\n"
    )
    hasil = subprocess.run(  # noqa: S603 — argumen buatan test sendiri
        [sys.executable, "-W", "default", "-c", kode, str(bom)],
        capture_output=True,
        text=True,
        check=True,
        cwd=Path(__file__).resolve().parents[1],
    )
    assert hasil.stdout.strip() == "GALAT", hasil.stderr


def test_NFR_SEC_06_nama_file_dari_klien_diabaikan(klien_admin, db, penyimpanan_sementara):
    j = pabrik.judul(db)
    r = _unggah(klien_admin, j.id, _gambar("JPEG"), nama="../../x.jpg")
    assert r.status_code == 200
    path = r.json()["cover_path"]
    assert ".." not in path and "x.jpg" not in path
    berkas = _berkas_di(penyimpanan_sementara)
    assert len(berkas) == 1
    assert berkas[0].parent == penyimpanan_sementara / "cover"
    assert len(berkas[0].stem) == 32  # UUID hex dari server
    assert not (penyimpanan_sementara.parent.parent / "x.jpg").exists()


# ------------------------------------------------------------------------------------ siklus berkas


def test_OQ_19_ganti_cover_menghapus_file_lama(klien_admin, db, penyimpanan_sementara):
    j = pabrik.judul(db)
    lama = _unggah(klien_admin, j.id, _gambar("JPEG")).json()["cover_path"]
    baru = _unggah(klien_admin, j.id, _gambar("PNG"), nama="b.png").json()["cover_path"]
    assert lama != baru
    assert _berkas_di(penyimpanan_sementara) == [penyimpanan_sementara / baru]


def test_NFR_SEC_06_upload_ditolak_cover_lama_tetap(klien_admin, db, penyimpanan_sementara):
    j = pabrik.judul(db)
    lama = _unggah(klien_admin, j.id, _gambar("JPEG")).json()["cover_path"]
    _galat(_unggah(klien_admin, j.id, b"bukan gambar"), "BKU_COVER_FORMAT")
    db.expire_all()
    assert db.get(JudulBuku, j.id).cover_path == lama
    assert _berkas_di(penyimpanan_sementara) == [penyimpanan_sementara / lama]


def test_OQ_12_hapus_judul_menghapus_file_cover(klien_admin, db, penyimpanan_sementara):
    j = pabrik.judul(db)
    _unggah(klien_admin, j.id, _gambar("JPEG"))
    assert len(_berkas_di(penyimpanan_sementara)) == 1
    assert klien_admin.delete(f"{API}/{j.id}").status_code == 204
    assert _berkas_di(penyimpanan_sementara) == []


def test_OQ_19_tidak_ada_endpoint_hapus_cover(klien_admin, db):
    j = pabrik.judul(db)
    assert klien_admin.delete(f"{API}/{j.id}/cover").status_code == 405


def test_cover_judul_tidak_ada_404(klien_admin, penyimpanan_sementara):
    r = _unggah(klien_admin, 999_999_999, _gambar("JPEG"))
    assert r.status_code == 404
    assert _berkas_di(penyimpanan_sementara) == []

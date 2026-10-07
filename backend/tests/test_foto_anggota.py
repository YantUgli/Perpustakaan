"""Susulan WP 5.3.4 — foto anggota (OQ-42, FR-AKN-01/DR-02, K-05, NFR-SEC-03).

Foto hanya untuk anggota pemiliknya dan admin; tidak publik. Pola keamanan sama dengan cover publik:
path hanya dari DB, wajib di dalam `STORAGE_DIR`, Content-Type dari ekstensi buatan server.
`penyimpanan_sementara` (autouse) mengarahkan `STORAGE_DIR` ke folder sementara.
"""

import io
import uuid
from pathlib import Path

from PIL import Image
from sqlalchemy.orm import Session

from app.core.keamanan import hash_password
from app.models import Anggota
from tests import pabrik
from tests.test_autentikasi import ROUTE_PUBLIK, _route_aplikasi_sungguhan

FOTO_SAYA = "/api/v1/anggota/profil/foto"
PROFIL = "/api/v1/anggota/profil"
ADMIN = "/api/v1/admin/anggota"
PASSWORD = "rahasia-123"


def _gambar(fmt: str, warna: tuple[int, int, int]) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (12, 12), warna).save(buf, format=fmt)
    return buf.getvalue()


def _tulis(folder: Path, isi: bytes, ext: str) -> str:
    """Berkas foto seperti buatan `berkas.simpan()`; kembalikan path relatif untuk DB."""
    path_relatif = f"foto/{uuid.uuid4().hex}.{ext}"
    path = folder / path_relatif
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(isi)
    return path_relatif


def _anggota(db: Session, **kw) -> Anggota:
    data = {
        "email": f"agt{uuid.uuid4().hex[:10]}@perpus.example",
        "password_hash": hash_password(PASSWORD),
    }
    return pabrik.anggota(db, **(data | kw))


def _masuk(client, email: str) -> None:
    client.cookies.clear()
    r = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text


def _masuk_admin(client, db: Session) -> None:
    akun = pabrik.admin(db, email=f"adm{uuid.uuid4().hex[:10]}@perpus.example")
    akun.password_hash = hash_password(PASSWORD)
    db.flush()
    _masuk(client, akun.email)


def _galat_404(r, kode: str) -> None:
    assert r.status_code == 404, r.text
    assert r.json()["detail"]["kode"] == kode


# ---------------------------------------------------------------------------------- akses (role)


def test_OQ_42_pengunjung_401_kedua_endpoint(client, db: Session, penyimpanan_sementara: Path):
    a = _anggota(db, foto_path=_tulis(penyimpanan_sementara, _gambar("PNG", (1, 2, 3)), "png"))
    assert client.get(FOTO_SAYA).status_code == 401
    assert client.get(f"{ADMIN}/{a.kode}/foto").status_code == 401


def test_OQ_42_NFR_SEC_03_anggota_ke_endpoint_admin_403(
    client, db: Session, penyimpanan_sementara: Path
):
    lain = _anggota(db, foto_path=_tulis(penyimpanan_sementara, _gambar("PNG", (1, 2, 3)), "png"))
    saya = _anggota(db)
    _masuk(client, saya.email)
    assert client.get(f"{ADMIN}/{lain.kode}/foto").status_code == 403
    assert client.get(f"{ADMIN}/{saya.kode}/foto").status_code == 403


def test_OQ_42_admin_ke_endpoint_anggota_403(client, db: Session):
    _masuk_admin(client, db)
    assert client.get(FOTO_SAYA).status_code == 403


def test_OQ_42_anggota_hanya_mendapat_foto_sendiri(
    client, db: Session, penyimpanan_sementara: Path
):
    isi_a, isi_b = _gambar("PNG", (10, 20, 30)), _gambar("PNG", (200, 100, 50))
    a = _anggota(db, foto_path=_tulis(penyimpanan_sementara, isi_a, "png"))
    b = _anggota(db, foto_path=_tulis(penyimpanan_sementara, isi_b, "png"))

    _masuk(client, a.email)
    assert client.get(FOTO_SAYA).content == isi_a
    # Parameter identitas dari klien diabaikan; identitas selalu dari sesi (NFR-SEC-03).
    r = client.get(FOTO_SAYA, params={"kode": b.kode, "id": b.id, "anggota_id": b.id})
    assert r.status_code == 200
    assert r.content == isi_a

    _masuk(client, b.email)
    assert client.get(FOTO_SAYA).content == isi_b


def test_OQ_42_admin_mendapat_foto_anggota_per_kode(
    client, db: Session, penyimpanan_sementara: Path
):
    isi = _gambar("JPEG", (90, 90, 90))
    a = _anggota(db, foto_path=_tulis(penyimpanan_sementara, isi, "jpg"))
    _masuk_admin(client, db)
    assert client.get(f"{ADMIN}/{a.kode}/foto").content == isi
    # Kode dinormalisasi (trim + huruf besar), sama dengan detail anggota.
    r = client.get(f"{ADMIN}/ {a.kode.lower()} /foto")
    assert r.status_code == 200
    assert r.content == isi


def test_OQ_42_kode_tidak_dikenal_404(client, db: Session):
    _masuk_admin(client, db)
    _galat_404(client.get(f"{ADMIN}/AGT-999999/foto"), "AKN_ANGGOTA_TIDAK_ADA")


# ---------------------------------------------------------------------------------- 404 berkas


def test_OQ_42_tanpa_foto_404(client, db: Session):
    a = _anggota(db, foto_path=None)
    _masuk(client, a.email)
    r = client.get(FOTO_SAYA)
    _galat_404(r, "AKN_FOTO_TIDAK_ADA")
    assert r.json()["detail"]["rujukan"] == "OQ-42"

    _masuk_admin(client, db)
    _galat_404(client.get(f"{ADMIN}/{a.kode}/foto"), "AKN_FOTO_TIDAK_ADA")


def test_OQ_42_berkas_hilang_404(client, db: Session):
    a = _anggota(db, foto_path="foto/tidakada.jpg")
    _masuk(client, a.email)
    _galat_404(client.get(FOTO_SAYA), "AKN_FOTO_TIDAK_ADA")

    _masuk_admin(client, db)
    _galat_404(client.get(f"{ADMIN}/{a.kode}/foto"), "AKN_FOTO_TIDAK_ADA")


def test_OQ_42_path_di_luar_storage_404(client, db: Session, penyimpanan_sementara: Path):
    rahasia = penyimpanan_sementara.parent / "rahasia.png"
    rahasia.write_bytes(_gambar("PNG", (5, 5, 5)))
    a = _anggota(db, foto_path="../rahasia.png")
    _masuk(client, a.email)
    _galat_404(client.get(FOTO_SAYA), "AKN_FOTO_TIDAK_ADA")

    _masuk_admin(client, db)
    _galat_404(client.get(f"{ADMIN}/{a.kode}/foto"), "AKN_FOTO_TIDAK_ADA")


# ---------------------------------------------------------------------------------- respons


def test_OQ_42_content_type_dari_ekstensi_server(client, db: Session, penyimpanan_sementara: Path):
    jpg = _anggota(db, foto_path=_tulis(penyimpanan_sementara, _gambar("JPEG", (1, 1, 1)), "jpg"))
    png = _anggota(db, foto_path=_tulis(penyimpanan_sementara, _gambar("PNG", (1, 1, 1)), "png"))

    _masuk(client, jpg.email)
    assert client.get(FOTO_SAYA).headers["content-type"] == "image/jpeg"
    _masuk(client, png.email)
    assert client.get(FOTO_SAYA).headers["content-type"] == "image/png"

    _masuk_admin(client, db)
    assert client.get(f"{ADMIN}/{jpg.kode}/foto").headers["content-type"] == "image/jpeg"
    assert client.get(f"{ADMIN}/{png.kode}/foto").headers["content-type"] == "image/png"


def test_OQ_42_respons_foto_cache_control_private_no_store(
    client, db: Session, penyimpanan_sementara: Path
):
    """Keputusan Ayen 2026-10-07: foto = data pribadi; tidak disimpan cache bersama/perangkat."""
    a = _anggota(db, foto_path=_tulis(penyimpanan_sementara, _gambar("PNG", (7, 7, 7)), "png"))
    _masuk(client, a.email)
    r = client.get(FOTO_SAYA)
    assert r.status_code == 200
    assert r.headers["cache-control"] == "private, no-store"

    _masuk_admin(client, db)
    r = client.get(f"{ADMIN}/{a.kode}/foto")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "private, no-store"


def test_OQ_42_ada_foto_true_false(client, db: Session, penyimpanan_sementara: Path):
    """`ada_foto` = berkas benar-benar dapat disajikan (sama dengan endpoint foto → 200)."""
    ada = _anggota(db, foto_path=_tulis(penyimpanan_sementara, _gambar("PNG", (3, 3, 3)), "png"))
    tanpa = _anggota(db, foto_path=None)
    hilang = _anggota(db, foto_path="foto/tidakada.png")

    for a, harapan in ((ada, True), (tanpa, False), (hilang, False)):
        _masuk(client, a.email)
        assert client.get(PROFIL).json()["ada_foto"] is harapan

    _masuk_admin(client, db)
    for a, harapan in ((ada, True), (tanpa, False), (hilang, False)):
        assert client.get(f"{ADMIN}/{a.kode}").json()["ada_foto"] is harapan
        (item,) = client.get(ADMIN, params={"q": a.kode}).json()["data"]
        assert item["ada_foto"] is harapan


# ---------------------------------------------------------------------------------- audit route


def test_OQ_42_K_05_tidak_ada_route_tulis_foto():
    """Foto hanya dibaca: tidak ada unggah ulang/ubah/hapus (K-05), dan tidak ada yang publik."""
    route_foto = {
        (m, r.path) for r in _route_aplikasi_sungguhan() for m in r.methods if "foto" in r.path
    }
    assert route_foto == {
        ("GET", "/api/v1/anggota/profil/foto"),
        ("GET", "/api/v1/admin/anggota/{kode}/foto"),
    }
    assert not route_foto & ROUTE_PUBLIK

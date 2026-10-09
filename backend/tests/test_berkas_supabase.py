"""Penyimpanan gambar di Supabase Storage (decisions §B "Penyimpanan file").

Validasi gambar tetap NFR-SEC-06; yang berubah hanya tempat simpan. Bucket privat: cover & foto
hanya keluar lewat endpoint backend (OQ-42 untuk foto). Supabase dipalsukan dengan
`httpx.MockTransport` — test tidak pernah menyentuh jaringan. Test lain tetap memakai mode `lokal`.
"""

import io
import json
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field

import httpx
import pytest
from PIL import Image
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.galat import GalatBisnis
from app.core.keamanan import hash_password
from app.models import Anggota, JudulBuku
from app.services import berkas
from tests import pabrik

URL = "https://palsu.supabase.co"
KUNCI = "kunci-uji-rahasia"
BUCKET = "perpustakaan"
PASSWORD = "rahasia-123"


def _gambar(fmt: str = "PNG", warna: tuple[int, int, int] = (10, 20, 30)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), warna).save(buf, format=fmt)
    return buf.getvalue()


@dataclass
class SupabasePalsu:
    """Storage API tiruan: objek di memori + catatan permintaan."""

    objek: dict[str, bytes] = field(default_factory=dict)
    permintaan: list[httpx.Request] = field(default_factory=list)
    gangguan: Callable[[httpx.Request], httpx.Response | None] | None = None
    hilang_sebagai_400: bool = False  # sebagian versi Storage API menjawab objek hilang dengan 400

    def _hilang(self) -> httpx.Response:
        if self.hilang_sebagai_400:
            return httpx.Response(400, json={"statusCode": "404", "error": "not_found"})
        return httpx.Response(404, json={"statusCode": "404", "error": "not_found"})

    def __call__(self, req: httpx.Request) -> httpx.Response:
        self.permintaan.append(req)
        if self.gangguan is not None and (r := self.gangguan(req)) is not None:
            return r
        assert req.headers["apikey"] == KUNCI
        assert req.headers["authorization"] == f"Bearer {KUNCI}"
        path = req.url.path
        awal_objek = f"/storage/v1/object/{BUCKET}/"
        awal_baca = f"/storage/v1/object/authenticated/{BUCKET}/"
        if req.method == "POST" and path.startswith(awal_objek):
            kunci = path.removeprefix(awal_objek)
            if kunci in self.objek and req.headers.get("x-upsert") != "true":
                return httpx.Response(409, json={"statusCode": "409", "error": "Duplicate"})
            self.objek[kunci] = req.content
            return httpx.Response(200, json={"Key": f"{BUCKET}/{kunci}"})
        if req.method in ("GET", "HEAD") and path.startswith(awal_baca):
            kunci = path.removeprefix(awal_baca)
            if kunci not in self.objek:
                return self._hilang()
            isi = self.objek[kunci] if req.method == "GET" else b""
            return httpx.Response(200, content=isi)
        if req.method == "DELETE" and path == f"/storage/v1/object/{BUCKET}":
            for kunci in json.loads(req.content)["prefixes"]:
                self.objek.pop(kunci, None)
            return httpx.Response(200, json=[])
        return httpx.Response(418)


@pytest.fixture
def supabase(monkeypatch) -> Iterator[SupabasePalsu]:
    palsu = SupabasePalsu()
    monkeypatch.setenv("STORAGE_BACKEND", "supabase")
    monkeypatch.setenv("SUPABASE_URL", URL)
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", KUNCI)
    monkeypatch.setenv("SUPABASE_BUCKET", BUCKET)
    monkeypatch.setattr(berkas, "TRANSPORT_UJI", httpx.MockTransport(palsu))
    get_settings.cache_clear()
    yield palsu
    get_settings.cache_clear()


def _putus(_req: httpx.Request) -> httpx.Response:
    raise httpx.ConnectError("jaringan putus")


def _galat_503(info: pytest.ExceptionInfo) -> None:
    assert info.value.status_code == 503
    assert info.value.kode == "BERKAS_PENYIMPANAN_GAGAL"
    assert info.value.pesan == (
        "Penyimpanan gambar sedang tidak dapat dihubungi. Coba lagi beberapa saat."
    )


# ------------------------------------------------------------------------------ konfigurasi


def test_supabase_tanpa_url_atau_kunci_gagal_start(monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "supabase")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    with pytest.raises(ValidationError, match="SUPABASE_URL"):
        Settings(_env_file=None)


def test_mode_bawaan_lokal_tanpa_supabase(monkeypatch):
    monkeypatch.delenv("STORAGE_BACKEND", raising=False)
    assert Settings(_env_file=None).storage_backend == "lokal"


def test_kunci_supabase_tidak_tampil_di_repr(supabase):
    assert KUNCI not in repr(get_settings())


# ------------------------------------------------------------------------------ adaptor


def test_NFR_SEC_06_simpan_mengirim_objek_ke_bucket_privat_tanpa_menimpa(supabase):
    isi = _gambar("JPEG")
    path = berkas.simpan(berkas.GambarSah(isi=isi, ekstensi="jpg"), "cover")
    assert path.startswith("cover/") and path.endswith(".jpg")
    (req,) = supabase.permintaan
    assert req.method == "POST"
    assert str(req.url) == f"{URL}/storage/v1/object/{BUCKET}/{path}"
    assert req.headers["content-type"] == "image/jpeg"  # dari ekstensi buatan server
    assert req.headers["x-upsert"] == "false"
    assert supabase.objek[path] == isi


def test_baca_objek_ada(supabase):
    supabase.objek["foto/" + "a" * 32 + ".png"] = b"isi-png"
    b = berkas.berkas_tersimpan("foto/" + "a" * 32 + ".png")
    assert b == berkas.BerkasTersimpan(isi=b"isi-png", media_type="image/png")
    assert str(supabase.permintaan[0].url).startswith(f"{URL}/storage/v1/object/authenticated/")


@pytest.mark.parametrize("sebagai_400", [False, True])
def test_baca_objek_hilang_none(supabase, sebagai_400):
    supabase.hilang_sebagai_400 = sebagai_400
    assert berkas.berkas_tersimpan("cover/" + "b" * 32 + ".jpg") is None
    assert berkas.ada("cover/" + "b" * 32 + ".jpg") is False


@pytest.mark.parametrize(
    "path",
    [
        None,
        "",
        "../rahasia.png",
        "cover/../foto/x.png",
        "lain/" + "c" * 32 + ".png",
        "cover/" + "c" * 32 + ".gif",
        "cover/bukan-uuid.png",
    ],
)
def test_path_tidak_sah_tidak_pernah_dikirim(supabase, path):
    assert berkas.berkas_tersimpan(path) is None
    assert berkas.ada(path) is False
    berkas.hapus(path)
    assert supabase.permintaan == []


@pytest.mark.parametrize(
    "gangguan",
    [_putus, lambda _r: httpx.Response(500), lambda _r: httpx.Response(401)],
)
def test_baca_dan_simpan_saat_gangguan_503(supabase, gangguan):
    supabase.gangguan = gangguan
    with pytest.raises(GalatBisnis) as info:
        berkas.berkas_tersimpan("cover/" + "d" * 32 + ".jpg")
    _galat_503(info)
    with pytest.raises(GalatBisnis) as info:
        berkas.simpan(berkas.GambarSah(isi=_gambar(), ekstensi="png"), "cover")
    _galat_503(info)


def test_ada_saat_gangguan_false(supabase):
    supabase.gangguan = _putus
    assert berkas.ada("foto/" + "e" * 32 + ".png") is False


def test_hapus_mengirim_prefixes_dan_gangguan_tidak_dilempar(supabase):
    path = "cover/" + "f" * 32 + ".png"
    supabase.objek[path] = b"x"
    berkas.hapus(path)
    assert path not in supabase.objek
    supabase.gangguan = _putus
    berkas.hapus(path)  # setelah commit: tidak boleh menggagalkan permintaan


# ------------------------------------------------------------------------------ alur API


def test_FR_BKU_02_cover_unggah_tampil_ganti_hapus_lama(klien_admin, client, db: Session, supabase):
    j = pabrik.judul(db)
    pertama = _gambar("PNG", (1, 2, 3))
    r = klien_admin.put(
        f"/api/v1/admin/judul/{j.id}/cover", files={"berkas": ("a.png", pertama, "image/png")}
    )
    assert r.status_code == 200, r.text
    path_lama = r.json()["cover_path"]
    assert supabase.objek[path_lama] == pertama

    r = client.get(f"/api/v1/katalog/judul/{j.id}/cover")
    assert (r.status_code, r.content, r.headers["content-type"]) == (200, pertama, "image/png")

    kedua = _gambar("JPEG", (200, 100, 0))
    r = klien_admin.put(
        f"/api/v1/admin/judul/{j.id}/cover", files={"berkas": ("b.jpg", kedua, "image/jpeg")}
    )
    assert r.status_code == 200, r.text
    assert path_lama not in supabase.objek  # cover lama dihapus setelah commit
    assert supabase.objek[r.json()["cover_path"]] == kedua


def test_FR_BKU_02_cover_saat_gangguan_503_db_tidak_berubah(klien_admin, db: Session, supabase):
    j = pabrik.judul(db)
    supabase.gangguan = _putus
    r = klien_admin.put(
        f"/api/v1/admin/judul/{j.id}/cover", files={"berkas": ("a.png", _gambar(), "image/png")}
    )
    assert r.status_code == 503, r.text
    assert r.json()["detail"]["kode"] == "BERKAS_PENYIMPANAN_GAGAL"
    db.refresh(j)
    assert db.get(JudulBuku, j.id).cover_path is None


def test_cover_objek_hilang_404_gangguan_503(client, db: Session, supabase):
    j = pabrik.judul(db, cover_path="cover/" + "1" * 32 + ".jpg")
    assert client.get(f"/api/v1/katalog/judul/{j.id}/cover").status_code == 404
    supabase.gangguan = _putus
    assert client.get(f"/api/v1/katalog/judul/{j.id}/cover").status_code == 503


def test_FR_AKN_01_OQ_42_foto_daftar_tampil_untuk_pemilik_dan_admin(client, db: Session, supabase):
    foto = _gambar("PNG", (9, 9, 9))
    email = f"agt{uuid.uuid4().hex[:10]}@perpus.example"
    data = {
        "nama": "Dewi Lestari",
        "alamat": "Jl. Merdeka No. 1",
        "email": email,
        "telepon": "081234567890",
        "nik": str(9_100_000_000_000_000 + uuid.uuid4().int % 10**15),
        "password": PASSWORD,
    }
    r = client.post("/api/v1/auth/daftar", data=data, files={"foto": ("f.png", foto, "image/png")})
    assert r.status_code == 201, r.text
    a = db.query(Anggota).filter_by(email=email).one()
    assert a.foto_path.startswith("foto/") and supabase.objek[a.foto_path] == foto

    r = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    assert client.get("/api/v1/anggota/profil").json()["ada_foto"] is True
    r = client.get("/api/v1/anggota/profil/foto")
    assert (r.status_code, r.content) == (200, foto)
    assert r.headers["cache-control"] == "private, no-store"

    client.cookies.clear()
    admin = pabrik.admin(db, password_hash=hash_password(PASSWORD))
    client.post("/api/v1/auth/login", json={"email": admin.email, "password": PASSWORD})
    r = client.get(f"/api/v1/admin/anggota/{a.kode}/foto")
    assert (r.status_code, r.content) == (200, foto)
    assert r.headers["cache-control"] == "private, no-store"


def test_OQ_42_ada_foto_false_saat_gangguan_profil_tetap_terbuka(client, db: Session, supabase):
    email = f"agt{uuid.uuid4().hex[:10]}@perpus.example"
    pabrik.anggota(
        db,
        email=email,
        password_hash=hash_password(PASSWORD),
        foto_path="foto/" + "2" * 32 + ".png",
    )
    supabase.objek["foto/" + "2" * 32 + ".png"] = b"x"
    client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    supabase.gangguan = _putus
    r = client.get("/api/v1/anggota/profil")
    assert r.status_code == 200 and r.json()["ada_foto"] is False

"""Susulan WP 5.3.4 — anggota mengubah foto sendiri (OQ-48, NFR-SEC-03/06, NFR-REL-01/02).

OQ-48 adalah CR yang membalik K-05 dan menyimpang dari FR-AKN-07 khusus untuk anggota sendiri;
admin tetap tidak dapat mengubah foto (FR-AKN-11). Urutan aman: simpan objek baru → kunci baris
anggota → update `foto_path` → commit → hapus objek lama (gangguan hanya dicatat log).
`penyimpanan_sementara` (autouse) mengarahkan `STORAGE_DIR` ke folder sementara; mode supabase
dipalsukan dengan `httpx.MockTransport` — tidak pernah menyentuh jaringan.
"""

import io
import threading
import time
import uuid
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest
from PIL import Image
from sqlalchemy import Engine, delete, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.keamanan import hash_password
from app.models import Anggota, Sesi
from app.services import anggota as layanan
from app.services import berkas
from app.services.berkas import UKURAN_MAKS_GAMBAR
from tests import pabrik
from tests.test_autentikasi import ROUTE_PUBLIK, _route_aplikasi_sungguhan
from tests.test_berkas_supabase import BUCKET, KUNCI, URL, SupabasePalsu, _putus

FOTO_SAYA = "/api/v1/anggota/profil/foto"
PROFIL = "/api/v1/anggota/profil"
PASSWORD = "rahasia-123"
TAHAN_DETIK = 1.0


def _gambar(fmt: str = "PNG", warna: tuple[int, int, int] = (10, 20, 30)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (12, 12), warna).save(buf, format=fmt)
    return buf.getvalue()


def _tulis(folder: Path, isi: bytes, ext: str = "png") -> str:
    """Berkas foto seperti buatan `berkas.simpan()`; kembalikan path relatif untuk DB."""
    path_relatif = f"foto/{uuid.uuid4().hex}.{ext}"
    path = folder / path_relatif
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(isi)
    return path_relatif


def _berkas_di(folder: Path) -> list[Path]:
    return sorted(p for p in folder.rglob("*") if p.is_file())


def _anggota_masuk(client, db: Session, **kw) -> Anggota:
    a = pabrik.anggota(
        db,
        email=f"agt{uuid.uuid4().hex[:10]}@perpus.example",
        password_hash=hash_password(PASSWORD),
        **kw,
    )
    client.cookies.clear()
    r = client.post("/api/v1/auth/login", json={"email": a.email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return a


def _unggah(client, isi: bytes, nama: str = "f.png", tipe: str = "image/png"):
    return client.put(FOTO_SAYA, files={"foto": (nama, isi, tipe)})


def _galat(r, status: int, kode: str) -> dict:
    assert r.status_code == status, r.text
    d = r.json()["detail"]
    assert d["kode"] == kode
    return d


@pytest.fixture
def supabase_palsu(monkeypatch) -> Iterator[SupabasePalsu]:
    palsu = SupabasePalsu()
    monkeypatch.setenv("STORAGE_BACKEND", "supabase")
    monkeypatch.setenv("SUPABASE_URL", URL)
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", KUNCI)
    monkeypatch.setenv("SUPABASE_BUCKET", BUCKET)
    monkeypatch.setattr(berkas, "TRANSPORT_UJI", httpx.MockTransport(palsu))
    get_settings.cache_clear()
    yield palsu
    get_settings.cache_clear()


# ------------------------------------------------------------------------------ tambah & ganti


def test_OQ_48_tambah_foto_sebelumnya_null(client, db: Session, penyimpanan_sementara: Path):
    a = _anggota_masuk(client, db)
    assert a.foto_path is None
    foto = _gambar("PNG", (1, 2, 3))
    r = _unggah(client, foto)
    assert r.status_code == 200, r.text
    assert r.json()["ada_foto"] is True and r.json()["kode"] == a.kode
    db.refresh(a)
    assert a.foto_path.startswith("foto/") and a.foto_path.endswith(".png")
    assert (penyimpanan_sementara / a.foto_path).read_bytes() == foto


def test_OQ_48_ganti_foto_objek_lama_dihapus(client, db: Session, penyimpanan_sementara: Path):
    lama = _tulis(penyimpanan_sementara, _gambar("PNG", (5, 5, 5)))
    a = _anggota_masuk(client, db, foto_path=lama)
    r = _unggah(client, _gambar("JPEG", (200, 10, 10)), nama="baru.jpg", tipe="image/jpeg")
    assert r.status_code == 200, r.text
    db.refresh(a)
    assert a.foto_path != lama and a.foto_path.endswith(".jpg")
    assert not (penyimpanan_sementara / lama).exists()
    assert _berkas_di(penyimpanan_sementara) == [penyimpanan_sementara / a.foto_path]


def test_OQ_48_GET_foto_sesudahnya_mengembalikan_berkas_baru(
    client, db: Session, penyimpanan_sementara: Path
):
    _anggota_masuk(client, db, foto_path=_tulis(penyimpanan_sementara, _gambar("PNG")))
    baru = _gambar("JPEG", (0, 128, 255))
    assert _unggah(client, baru, nama="x.jpg", tipe="image/jpeg").status_code == 200
    r = client.get(FOTO_SAYA)
    assert (r.status_code, r.content) == (200, baru)
    assert r.headers["content-type"] == "image/jpeg"
    assert r.headers["cache-control"] == "private, no-store"


# ---------------------------------------------------------------------------------- NFR-SEC-06


@pytest.mark.parametrize(
    ("isi", "nama"),
    [
        (_gambar("GIF"), "anim.gif"),
        (b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\n", "dokumen.png"),
    ],
    ids=["gif", "pdf-bernama-png"],
)
def test_OQ_48_NFR_SEC_06_jenis_salah_ditolak(
    client, db: Session, penyimpanan_sementara: Path, isi: bytes, nama: str
):
    lama = _tulis(penyimpanan_sementara, _gambar("PNG"))
    a = _anggota_masuk(client, db, foto_path=lama)
    d = _galat(_unggah(client, isi, nama=nama), 422, "AKN_FOTO_FORMAT")
    assert d["pesan"] == "Foto harus berupa gambar JPG atau PNG."
    assert d["rujukan"] == "NFR-SEC-06"
    db.refresh(a)
    assert a.foto_path == lama
    assert _berkas_di(penyimpanan_sementara) == [penyimpanan_sementara / lama]


def test_OQ_48_NFR_SEC_06_lebih_2MB_ditolak(client, db: Session, penyimpanan_sementara: Path):
    a = _anggota_masuk(client, db)
    isi = _gambar("PNG")
    isi += b"\x00" * (UKURAN_MAKS_GAMBAR + 1 - len(isi))
    d = _galat(_unggah(client, isi), 422, "AKN_FOTO_TERLALU_BESAR")
    assert d["pesan"] == "Ukuran berkas melebihi batas 2 MB."
    db.refresh(a)
    assert a.foto_path is None
    assert _berkas_di(penyimpanan_sementara) == []


def test_OQ_48_NFR_SEC_06_tepat_2MB_diterima(client, db: Session):
    _anggota_masuk(client, db)
    isi = _gambar("PNG")
    isi += b"\x00" * (UKURAN_MAKS_GAMBAR - len(isi))  # data setelah IEND diabaikan dekoder
    assert len(isi) == 2_097_152
    assert _unggah(client, isi).status_code == 200


def test_OQ_48_tanpa_isian_foto_422(client, db: Session):
    _anggota_masuk(client, db)
    d = _galat(client.put(FOTO_SAYA), 422, "VALIDASI_ISIAN")
    assert d["isian"] == {"foto": "Wajib diisi."}


# ------------------------------------------------------------------------------------ NFR-SEC-03


def test_OQ_48_tanpa_sesi_401(client, db: Session, penyimpanan_sementara: Path):
    client.cookies.clear()
    assert _unggah(client, _gambar()).status_code == 401
    assert _berkas_di(penyimpanan_sementara) == []


def test_OQ_48_admin_403(klien_admin, penyimpanan_sementara: Path):
    assert _unggah(klien_admin, _gambar()).status_code == 403
    assert _berkas_di(penyimpanan_sementara) == []


def test_OQ_48_FR_AKN_11_admin_tidak_punya_route_ubah_foto():
    """Satu-satunya route tulis foto milik area anggota (identitas dari sesi), tidak publik."""
    tulis = {
        (m, r.path)
        for r in _route_aplikasi_sungguhan()
        for m in r.methods
        if "foto" in r.path.lower() and m in {"POST", "PUT", "PATCH", "DELETE"}
    }
    assert tulis == {("PUT", FOTO_SAYA)}
    assert not tulis & ROUTE_PUBLIK


def test_OQ_48_K_05_PUT_profil_dengan_foto_tetap_422(client, db: Session):
    a = _anggota_masuk(client, db)
    data = {"nama": a.nama, "alamat": a.alamat, "email": a.email, "telepon": a.telepon}
    d = _galat(client.put(PROFIL, json=data | {"foto": "x.png"}), 422, "VALIDASI_ISIAN")
    assert d["isian"] == {"foto": "Isian ini tidak dikenal atau tidak dapat diubah."}


def test_OQ_48_tidak_mencabut_sesi(client, db: Session):
    a = _anggota_masuk(client, db)
    token_lama = client.cookies.get("sesi_perpus")
    client.cookies.clear()
    r = client.post("/api/v1/auth/login", json={"email": a.email, "password": PASSWORD})
    assert r.status_code == 200
    assert _unggah(client, _gambar()).status_code == 200
    assert db.query(Sesi).filter_by(anggota_id=a.id).count() == 2
    client.cookies.clear()
    client.cookies.set("sesi_perpus", token_lama)
    assert client.get(PROFIL).status_code == 200


# ---------------------------------------------------------------------------------- NFR-REL-01


def test_OQ_48_penyimpanan_gagal_503_db_tidak_berubah(client, db: Session, supabase_palsu):
    lama = "foto/" + "3" * 32 + ".png"
    supabase_palsu.objek[lama] = _gambar()
    a = _anggota_masuk(client, db, foto_path=lama)
    supabase_palsu.gangguan = _putus
    _galat(_unggah(client, _gambar("PNG", (9, 8, 7))), 503, "BERKAS_PENYIMPANAN_GAGAL")
    db.refresh(a)
    assert a.foto_path == lama
    assert set(supabase_palsu.objek) == {lama}


def test_OQ_48_commit_gagal_objek_baru_dibersihkan(
    db: Session, monkeypatch, penyimpanan_sementara: Path
):
    class GagalDisengaja(Exception):
        pass

    lama = _tulis(penyimpanan_sementara, _gambar())
    a = pabrik.anggota(db, foto_path=lama)

    def gagal():
        raise GagalDisengaja

    monkeypatch.setattr(db, "commit", gagal)
    with pytest.raises(GagalDisengaja):
        layanan.ganti_foto_sendiri(db, a.id, io.BytesIO(_gambar("PNG", (4, 4, 4))))
    assert _berkas_di(penyimpanan_sementara) == [penyimpanan_sementara / lama]


def test_OQ_48_gagal_hapus_objek_lama_tetap_200_lokal(
    client, db: Session, monkeypatch, penyimpanan_sementara: Path
):
    lama = _tulis(penyimpanan_sementara, _gambar())
    a = _anggota_masuk(client, db, foto_path=lama)

    def hapus_gagal(_path):
        raise OSError("disk sibuk")

    monkeypatch.setattr(berkas, "hapus", hapus_gagal)
    r = _unggah(client, _gambar("PNG", (7, 7, 7)))
    assert r.status_code == 200, r.text
    db.refresh(a)
    assert a.foto_path != lama
    assert (penyimpanan_sementara / a.foto_path).is_file()


def test_OQ_48_gagal_hapus_objek_lama_tetap_200_supabase(client, db: Session, supabase_palsu):
    lama = "foto/" + "4" * 32 + ".png"
    supabase_palsu.objek[lama] = _gambar()
    a = _anggota_masuk(client, db, foto_path=lama)
    supabase_palsu.gangguan = lambda req: (
        httpx.Response(500, json={"error": "x"}) if req.method == "DELETE" else None
    )
    r = _unggah(client, _gambar("PNG", (6, 6, 6)))
    assert r.status_code == 200, r.text
    db.refresh(a)
    assert a.foto_path != lama and a.foto_path in supabase_palsu.objek
    assert lama in supabase_palsu.objek  # objek yatim, hanya dicatat log


def test_OQ_48_supabase_tambah_ganti_tampil(client, db: Session, supabase_palsu):
    a = _anggota_masuk(client, db)
    pertama, kedua = _gambar("PNG", (1, 1, 1)), _gambar("JPEG", (2, 2, 2))
    assert _unggah(client, pertama).status_code == 200
    db.refresh(a)
    path_pertama = a.foto_path
    assert supabase_palsu.objek == {path_pertama: pertama}

    assert _unggah(client, kedua, nama="b.jpg", tipe="image/jpeg").status_code == 200
    db.refresh(a)
    assert supabase_palsu.objek == {a.foto_path: kedua}
    hapus = [q for q in supabase_palsu.permintaan if q.method == "DELETE"]
    assert len(hapus) == 1 and path_pertama.encode() in hapus[0].content
    r = client.get(FOTO_SAYA)
    assert (r.status_code, r.content) == (200, kedua)


# ---------------------------------------------------------------------------------- NFR-REL-02


def test_OQ_48_NFR_REL_02_unggahan_bersamaan_tidak_meninggalkan_path_terhapus(
    engine: Engine, penyimpanan_sementara: Path
):
    """Unggahan lain memegang kunci baris anggota lalu mengganti `foto_path` ke X. Unggahan yang
    menunggu harus membaca X sebagai foto lama (setelah kunci) dan menghapusnya; `foto_path` akhir
    selalu menunjuk objek yang ada."""
    awal = _tulis(penyimpanan_sementara, _gambar("PNG", (1, 1, 1)))
    antara = _tulis(penyimpanan_sementara, _gambar("PNG", (2, 2, 2)))
    with Session(engine) as s:
        a = pabrik.anggota(s, foto_path=awal)
        s.commit()
        aid = a.id
    terkunci = threading.Event()

    def unggahan_lain() -> None:
        with engine.connect() as k, k.begin():
            k.execute(text("SELECT id FROM anggota WHERE id = :id FOR UPDATE"), {"id": aid})
            terkunci.set()
            time.sleep(TAHAN_DETIK)
            k.execute(
                text("UPDATE anggota SET foto_path = :p WHERE id = :id"), {"p": antara, "id": aid}
            )

    try:
        t = threading.Thread(target=unggahan_lain, daemon=True)
        t.start()
        assert terkunci.wait(timeout=5)
        with Session(engine, autoflush=False, expire_on_commit=False) as s:
            s.execute(text("SET lock_timeout = '10s'"))
            s.commit()
            assert s.get(Anggota, aid).foto_path == awal  # identity map memuat foto lama (basi)
            layanan.ganti_foto_sendiri(s, aid, io.BytesIO(_gambar("PNG", (3, 3, 3))))
        t.join(timeout=10)
        assert not t.is_alive()
        with Session(engine) as s:
            akhir = s.get(Anggota, aid).foto_path
        assert akhir not in (awal, antara)
        assert (penyimpanan_sementara / akhir).is_file()
        assert not (penyimpanan_sementara / antara).exists()  # foto lama dibaca setelah kunci
    finally:
        with Session(engine) as s:
            s.execute(delete(Anggota).where(Anggota.id == aid))
            s.commit()

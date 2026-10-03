"""WP 5.3.2 — katalog publik & pencarian: FR-KTL-01..04, BR-01, NFR-PRF-01, OQ-13, OQ-22..24."""

import io
import time
import uuid
from pathlib import Path

import pytest
from PIL import Image
from sqlalchemy.orm import Session

from app.models import JudulBuku
from app.models.status import StatusEksemplar
from app.seed.data_uji import seed_performa
from tests import pabrik

API = "/api/v1/katalog/judul"


def _penanda() -> str:
    """Token unik agar test tidak bergantung pada isi DB lain."""
    return f"zq{uuid.uuid4().hex[:10]}"


def _cari(client, q: str, **params):
    r = client.get(API, params={"q": q, **params})
    assert r.status_code == 200, r.text
    return r.json()


def _judul_dengan_eksemplar(db: Session, status: list[StatusEksemplar], **kw) -> JudulBuku:
    j = pabrik.judul(db, **kw)
    for s in status:
        pabrik.eksemplar(db, judul_buku_id=j.id, status=s.value)
    return j


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), (0, 120, 0)).save(buf, format="PNG")
    return buf.getvalue()


# --------------------------------------------------------------------------- akses publik (BR-01)


def test_BR_01_FR_KTL_01_katalog_tanpa_login(client):
    r = client.get(API)
    assert r.status_code == 200
    assert set(r.json()) == {"data", "total", "halaman", "per_halaman"}


def test_BR_01_FR_KTL_03_detail_tanpa_login(client, db: Session):
    j = pabrik.judul(db)
    r = client.get(f"{API}/{j.id}")
    assert r.status_code == 200
    assert r.json()["id"] == j.id


# --------------------------------------------------------------------------- isi (FR-KTL-01)


def test_FR_KTL_01_isi_kolom_lengkap(client, db: Session):
    p = _penanda()
    kat = pabrik.kategori(db, nama=f"Sejarah {p}")
    rak = pabrik.rak(db, kode=f"A-{p}", lokasi="Lantai 1")
    j = pabrik.judul(
        db,
        isbn="978-602-03-1234-5",
        judul=f"Buku {p}",
        penulis="Andi Pratama",
        penerbit="Pustaka Contoh",
        tahun=2019,
        kategori_id=kat.id,
        harga=87_500,
    )
    pabrik.eksemplar(db, judul_buku_id=j.id, rak_id=rak.id)

    (b,) = _cari(client, p)["data"]
    assert b == {
        "id": j.id,
        "isbn": "978-602-03-1234-5",
        "judul": f"Buku {p}",
        "penulis": "Andi Pratama",
        "penerbit": "Pustaka Contoh",
        "tahun": 2019,
        "kategori": {"id": kat.id, "nama": f"Sejarah {p}"},
        "harga": 87_500,
        "cover_url": None,  # OQ-10: frontend memakai gambar pengganti
        "rak": [{"kode": f"A-{p}", "lokasi": "Lantai 1"}],
        "tersedia": 1,
        "total": 1,
    }


def test_FR_KTL_01_respons_publik_tanpa_data_per_eksemplar(client, db: Session):
    p = _penanda()
    j = _judul_dengan_eksemplar(
        db, [StatusEksemplar.TERSEDIA, StatusEksemplar.DIPINJAM], judul=f"Buku {p}"
    )
    teks_daftar = client.get(API, params={"q": p}).text
    teks_detail = client.get(f"{API}/{j.id}").text
    for teks in (teks_daftar, teks_detail):
        assert "EKS-" not in teks
        assert "DIPINJAM" not in teks
        assert "status" not in teks
        assert "cover_path" not in teks


def test_OQ_22_rak_unik_dari_eksemplar_tersedia_dan_dipinjam(client, db: Session):
    p = _penanda()
    r1 = pabrik.rak(db, kode=f"B-{p}", lokasi=None)
    r2 = pabrik.rak(db, kode=f"A-{p}", lokasi="Lantai 2")
    r_hilang = pabrik.rak(db, kode=f"H-{p}")
    r_rusak = pabrik.rak(db, kode=f"R-{p}")
    j = pabrik.judul(db, judul=f"Buku {p}")
    for rak, status in [
        (r1, StatusEksemplar.TERSEDIA),
        (r1, StatusEksemplar.TERSEDIA),  # rak sama → tampil sekali
        (r2, StatusEksemplar.DIPINJAM),  # rak rumah buku yang dipinjam tetap tampil
        (r_hilang, StatusEksemplar.HILANG),
        (r_rusak, StatusEksemplar.RUSAK),
    ]:
        pabrik.eksemplar(db, judul_buku_id=j.id, rak_id=rak.id, status=status.value)

    harapan = [{"kode": f"A-{p}", "lokasi": "Lantai 2"}, {"kode": f"B-{p}", "lokasi": None}]
    assert _cari(client, p)["data"][0]["rak"] == harapan
    assert client.get(f"{API}/{j.id}").json()["rak"] == harapan


def test_OQ_23_judul_tanpa_eksemplar_tampil_0_dari_0(client, db: Session):
    p = _penanda()
    pabrik.judul(db, judul=f"Kosong {p}")
    _judul_dengan_eksemplar(
        db, [StatusEksemplar.HILANG, StatusEksemplar.RUSAK], judul=f"Hilang semua {p}"
    )
    data = _cari(client, p)["data"]
    assert [(b["tersedia"], b["total"], b["rak"]) for b in data] == [(0, 0, []), (0, 0, [])]


# --------------------------------------------------------------------------- pencarian (FR-KTL-02)


def test_FR_KTL_02_cari_judul_sebagian_tak_peka_huruf(client, db: Session):
    p = _penanda()
    j = pabrik.judul(db, judul=f"Sejarah Nusantara {p} Modern")
    pabrik.judul(db, judul=f"Lain {_penanda()}")
    for q in [f"NUSANTARA {p.upper()}", f"nusantara {p}", p[2:8], f"tara {p} mod"]:
        assert [b["id"] for b in _cari(client, q)["data"]] == [j.id], q


def test_FR_KTL_02_cari_penulis_sebagian_tak_peka_huruf(client, db: Session):
    p = _penanda()
    j = pabrik.judul(db, penulis=f"Dewi Lestari {p}")
    assert [b["id"] for b in _cari(client, f"LESTARI {p.upper()}")["data"]] == [j.id]


def test_FR_KTL_02_cari_kategori_sebagian_tak_peka_huruf(client, db: Session):
    p = _penanda()
    kat = pabrik.kategori(db, nama=f"Ilmu Komputer {p}")
    j1 = pabrik.judul(db, judul="Algoritma", kategori_id=kat.id)
    j2 = pabrik.judul(db, judul="Basis Data", kategori_id=kat.id)
    hasil = _cari(client, f"komputer {p.upper()}")["data"]
    assert [b["id"] for b in hasil] == [j1.id, j2.id]


@pytest.mark.parametrize(
    ("tersimpan", "dicari"),
    [
        ("9786021234567", "978-602-123"),  # ketik bertanda hubung, tersimpan polos
        ("978-602-123-4567", "6021234"),  # ketik polos, tersimpan bertanda hubung
        ("602 123 456 X", "123456x"),  # spasi & x kecil (ISBN-10)
    ],
)
def test_FR_KTL_02_OQ_13_cari_isbn_mengabaikan_tanda_hubung(client, db: Session, tersimpan, dicari):
    j = pabrik.judul(db, isbn=tersimpan)
    assert j.id in [b["id"] for b in _cari(client, dicari, per_halaman=100)["data"]]


@pytest.mark.parametrize("q", ["-", "  -  ", "- -"])
def test_OQ_24_q_yang_kosong_setelah_normalisasi_isbn_tidak_cocok_semua(client, db: Session, q):
    """Kondisi ISBN dilewati bila normalisasi menghasilkan string kosong (bukan ILIKE '%%')."""
    p = _penanda()
    pabrik.judul(db, judul=f"Tanpa strip {p}", isbn="9786029999991")
    assert p not in client.get(API, params={"q": q, "per_halaman": 100}).text


@pytest.mark.parametrize("wildcard", ["%", "_", "\\"])
def test_FR_KTL_02_wildcard_diperlakukan_literal(client, db: Session, wildcard):
    p = _penanda()
    cocok = pabrik.judul(db, judul=f"Diskon 50{wildcard}x {p}")
    pabrik.judul(db, judul=f"Diskon 50ax {p}")  # akan cocok bila `_`/`%` dianggap wildcard
    assert [b["id"] for b in _cari(client, f"50{wildcard}x {p}")["data"]] == [cocok.id]


@pytest.mark.parametrize("q", ["", "   "])
def test_FR_KTL_02_q_kosong_atau_spasi_menampilkan_semua(client, db: Session, q):
    pabrik.judul(db)
    semua = client.get(API).json()["total"]
    assert semua >= 1
    assert _cari(client, q)["total"] == semua


def test_OQ_24_frasa_utuh_bukan_token_tak_berurutan(client, db: Session):
    p = _penanda()
    pabrik.judul(db, judul=f"Harry Potter {p}")
    assert _cari(client, f"rry potter {p}")["total"] == 1
    assert _cari(client, f"potter harry {p}")["total"] == 0


# --------------------------------------------------------------------------- X dari Y (FR-KTL-03)


def test_FR_KTL_03_x_dari_y_mengabaikan_hilang_rusak(client, db: Session):
    p = _penanda()
    j = _judul_dengan_eksemplar(
        db,
        [
            StatusEksemplar.TERSEDIA,
            StatusEksemplar.TERSEDIA,
            StatusEksemplar.DIPINJAM,
            StatusEksemplar.HILANG,
            StatusEksemplar.RUSAK,
            StatusEksemplar.RUSAK,
        ],
        judul=f"Buku {p}",
    )
    detail = client.get(f"{API}/{j.id}").json()
    assert (detail["tersedia"], detail["total"]) == (2, 3)  # "2 dari 3"
    (b,) = _cari(client, p)["data"]
    assert (b["tersedia"], b["total"]) == (2, 3)


def test_FR_KTL_03_detail_judul_tidak_ada_404(client):
    r = client.get(f"{API}/999999999")
    assert r.status_code == 404
    assert r.json()["detail"]["kode"] == "KTL_JUDUL_TIDAK_ADA"
    assert r.json()["detail"]["rujukan"] == "FR-KTL-03"


# --------------------------------------------------------------------------- pagination (FR-KTL-04)


def test_FR_KTL_04_pagination_total_urutan_dan_halaman_terakhir(client, db: Session):
    p = _penanda()
    for nama in ["delta", "Alfa", "charlie", "Bravo", "echo"]:
        pabrik.judul(db, judul=f"{nama} {p}")

    h1 = _cari(client, p, halaman=1, per_halaman=2)
    h3 = _cari(client, p, halaman=3, per_halaman=2)
    assert (h1["total"], h1["halaman"], h1["per_halaman"]) == (5, 1, 2)
    assert [b["judul"].split()[0] for b in h1["data"]] == ["Alfa", "Bravo"]  # A–Z tak peka huruf
    assert [b["judul"].split()[0] for b in h3["data"]] == ["echo"]


def test_FR_KTL_04_halaman_di_luar_jangkauan_kosong(client, db: Session):
    p = _penanda()
    pabrik.judul(db, judul=f"Satu {p}")
    h = _cari(client, p, halaman=50)
    assert (h["data"], h["total"]) == ([], 1)


def test_FR_KTL_04_default_per_halaman_20(client):
    assert client.get(API).json()["per_halaman"] == 20


@pytest.mark.parametrize(
    "params", [{"halaman": 0}, {"per_halaman": 0}, {"per_halaman": 101}, {"halaman": "x"}]
)
def test_FR_KTL_04_parameter_halaman_di_luar_batas_422(client, params):
    assert client.get(API, params=params).status_code == 422


# --------------------------------------------------------------------------- cover publik


def test_cover_disajikan_publik_dengan_content_type_dari_server(client, klien_admin, db: Session):
    j = pabrik.judul(db)
    r = klien_admin.put(
        f"/api/v1/admin/judul/{j.id}/cover",
        files={"berkas": ("apa.jpg", _png(), "image/jpeg")},  # nama & tipe klien diabaikan
    )
    assert r.status_code == 200, r.text
    cover_url = r.json()["cover_url"]  # field admin (titipan 5.3.5)
    assert cover_url == f"{API}/{j.id}/cover"

    client.cookies.clear()  # publik, tanpa sesi
    detail = client.get(f"{API}/{j.id}").json()
    assert detail["cover_url"] == cover_url
    g = client.get(cover_url)
    assert g.status_code == 200
    assert g.headers["content-type"] == "image/png"
    assert g.content == _png()


def test_cover_404_bila_judul_tanpa_cover_atau_berkas_hilang(
    client, db: Session, penyimpanan_sementara: Path
):
    tanpa = pabrik.judul(db)
    r = client.get(f"{API}/{tanpa.id}/cover")
    assert r.status_code == 404
    assert r.json()["detail"]["kode"] == "KTL_COVER_TIDAK_ADA"

    hilang = pabrik.judul(db, cover_path="cover/tidakada.png")
    assert client.get(f"{API}/{hilang.id}/cover").status_code == 404

    assert client.get(f"{API}/999999999/cover").status_code == 404


def test_cover_path_di_luar_storage_tidak_pernah_disajikan(
    client, db: Session, penyimpanan_sementara: Path
):
    rahasia = penyimpanan_sementara.parent / "rahasia.png"
    rahasia.write_bytes(_png())
    j = pabrik.judul(db, cover_path="../rahasia.png")
    assert client.get(f"{API}/{j.id}/cover").status_code == 404


# --------------------------------------------------------------------------- performa


def test_NFR_PRF_01_pencarian_10000_eksemplar_maks_2_detik(client, db: Session, capsys):
    seed_performa(db, app_env="staging")
    client.get(API, params={"q": "a"})  # pemanasan koneksi/rencana query

    durasi = {}
    for q in ["sejarah", "Pratama", "978-6021-0001", "zzz-tidak-ada", ""]:
        mulai = time.perf_counter()
        r = client.get(API, params={"q": q})
        durasi[q] = time.perf_counter() - mulai
        assert r.status_code == 200

    with capsys.disabled():
        print("\nNFR-PRF-01 durasi (detik):", {k: round(v, 3) for k, v in durasi.items()})
    assert max(durasi.values()) <= 2.0

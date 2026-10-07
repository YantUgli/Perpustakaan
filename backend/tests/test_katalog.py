"""WP 5.3.2 — katalog publik & pencarian.

FR-KTL-01..04, BR-01, NFR-PRF-01, OQ-13, OQ-22..24, OQ-43 (daftar kategori publik),
OQ-44 (filter & urutan katalog).
"""

import io
import time
import uuid
from pathlib import Path

import pytest
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import JudulBuku, Kategori
from app.models.status import StatusEksemplar
from app.seed.data_uji import seed_performa
from tests import pabrik

API = "/api/v1/katalog/judul"
API_KATEGORI = "/api/v1/katalog/kategori"


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


# ------------------------------------------------- filter & urutan katalog (FR-KTL-02, OQ-44)


def _juduls(h: dict) -> list[str]:
    return [b["judul"] for b in h["data"]]


def _galat(r, status: int = 422) -> dict:
    assert r.status_code == status, r.text
    return r.json()["detail"]


def test_FR_KTL_02_OQ_44_tanpa_parameter_baru_sama_dengan_sebelumnya(client, db: Session):
    p = _penanda()
    for nama, tahun in [("delta", 2001), ("Alfa", 2024), ("charlie", 1999), ("Bravo", 2010)]:
        pabrik.judul(db, judul=f"{nama} {p}", tahun=tahun)
    polos = _cari(client, p)
    eksplisit = _cari(client, p, urut="judul_az")
    assert _juduls(polos) == [f"{n} {p}" for n in ["Alfa", "Bravo", "charlie", "delta"]]
    assert polos == eksplisit


def test_OQ_44_filter_kategori_satu(client, db: Session):
    p = _penanda()
    k1, k2 = pabrik.kategori(db), pabrik.kategori(db)
    pabrik.judul(db, judul=f"A {p}", kategori_id=k1.id)
    pabrik.judul(db, judul=f"B {p}", kategori_id=k2.id)
    h = _cari(client, p, kategori_id=k1.id)
    assert (_juduls(h), h["total"]) == ([f"A {p}"], 1)


def test_OQ_44_filter_kategori_berulang_salah_satu(client, db: Session):
    p = _penanda()
    k1, k2, k3 = pabrik.kategori(db), pabrik.kategori(db), pabrik.kategori(db)
    for nama, k in [("A", k1), ("B", k2), ("C", k3)]:
        pabrik.judul(db, judul=f"{nama} {p}", kategori_id=k.id)
    h = _cari(client, p, kategori_id=[k1.id, k3.id])
    assert (_juduls(h), h["total"]) == ([f"A {p}", f"C {p}"], 2)


def test_OQ_44_filter_kategori_tak_dikenal_daftar_kosong(client, db: Session):
    p = _penanda()
    pabrik.judul(db, judul=f"A {p}")
    h = _cari(client, p, kategori_id=999_999_999)
    assert (h["data"], h["total"]) == ([], 0)


def test_OQ_44_kategori_id_di_luar_rentang_bigint_200_daftar_kosong(client, db: Session):
    p = _penanda()
    pabrik.judul(db, judul=f"A {p}")
    h = _cari(client, p, kategori_id=[2**63, -(2**63) - 1])
    assert (h["data"], h["total"]) == ([], 0)


def test_OQ_44_kategori_id_bukan_bilangan_422(client):
    d = _galat(client.get(API, params={"kategori_id": "abc"}))
    assert d["kode"] == "VALIDASI_ISIAN"
    assert d["isian"]["kategori_id"] == "Harus berupa bilangan bulat."


def test_OQ_44_kategori_id_lebih_dari_100_item_422_pesan_spesifik(client):
    r = client.get(API, params={"kategori_id": list(range(1, 102))})
    d = _galat(r)
    assert d["kode"] == "VALIDASI_ISIAN"
    assert d["isian"]["kategori_id"] == "Maksimal 100 item."


def test_OQ_44_kategori_id_tepat_100_item_diterima(client):
    assert client.get(API, params={"kategori_id": list(range(1, 101))}).status_code == 200


def test_OQ_44_filter_tersedia_hanya_judul_dengan_eksemplar_tersedia(client, db: Session):
    p = _penanda()
    st = StatusEksemplar
    _judul_dengan_eksemplar(db, [st.TERSEDIA], judul=f"A satu tersedia {p}")
    _judul_dengan_eksemplar(db, [st.DIPINJAM, st.TERSEDIA, st.RUSAK], judul=f"B campuran {p}")
    _judul_dengan_eksemplar(db, [st.DIPINJAM, st.DIPINJAM], judul=f"C semua dipinjam {p}")
    _judul_dengan_eksemplar(db, [st.HILANG, st.RUSAK], judul=f"D hilang rusak {p}")
    _judul_dengan_eksemplar(db, [], judul=f"E tanpa eksemplar {p}")
    h = _cari(client, p, tersedia="true")
    assert _juduls(h) == [f"A satu tersedia {p}", f"B campuran {p}"]
    assert h["total"] == 2
    assert all(b["tersedia"] >= 1 for b in h["data"])


@pytest.mark.parametrize("nilai", ["false", "1", "True", "ya", "on", ""])
def test_OQ_44_tersedia_nilai_selain_true_422(client, nilai):
    d = _galat(client.get(API, params={"tersedia": nilai}))
    assert d["kode"] == "VALIDASI_ISIAN"
    assert "tersedia" in d["isian"]


def _judul_tahun(db: Session, p: str) -> None:
    for tahun in [1999, 2000, 2005, 2010, 2011]:
        pabrik.judul(db, judul=f"T{tahun} {p}", tahun=tahun)


def test_OQ_44_filter_tahun_inklusif_kedua_batas(client, db: Session):
    p = _penanda()
    _judul_tahun(db, p)
    h = _cari(client, p, tahun_dari=2000, tahun_sampai=2010)
    assert (_juduls(h), h["total"]) == ([f"T2000 {p}", f"T2005 {p}", f"T2010 {p}"], 3)


@pytest.mark.parametrize(
    ("params", "harapan"),
    [({"tahun_dari": 2010}, [2010, 2011]), ({"tahun_sampai": 2000}, [1999, 2000])],
)
def test_OQ_44_filter_tahun_satu_sisi(client, db: Session, params, harapan):
    p = _penanda()
    _judul_tahun(db, p)
    assert _juduls(_cari(client, p, **params)) == [f"T{t} {p}" for t in harapan]


def test_OQ_44_tahun_dari_sama_dengan_sampai_diterima(client, db: Session):
    p = _penanda()
    _judul_tahun(db, p)
    assert _juduls(_cari(client, p, tahun_dari=2005, tahun_sampai=2005)) == [f"T2005 {p}"]


def test_OQ_44_tahun_dari_lebih_besar_422_menyebut_kedua_tahun(client):
    d = _galat(client.get(API, params={"tahun_dari": 2024, "tahun_sampai": 2020}))
    assert d["kode"] == "KTL_RENTANG_TAHUN_TIDAK_VALID"
    assert d["rujukan"] == "OQ-44"
    assert "2024" in d["pesan"] and "2020" in d["pesan"]


@pytest.mark.parametrize("isian", ["tahun_dari", "tahun_sampai"])
def test_OQ_44_tahun_bukan_bilangan_422(client, isian):
    d = _galat(client.get(API, params={isian: "dua ribu"}))
    assert (d["kode"], d["isian"][isian]) == ("VALIDASI_ISIAN", "Harus berupa bilangan bulat.")


@pytest.mark.parametrize("isian", ["tahun_dari", "tahun_sampai"])
def test_OQ_44_tahun_0_ditolak_minimal_1(client, isian):
    d = _galat(client.get(API, params={isian: 0}))
    assert (d["kode"], d["isian"][isian]) == ("VALIDASI_ISIAN", "Minimal 1.")


def test_OQ_44_tahun_sangat_besar_200_data_kosong(client, db: Session):
    p = _penanda()
    _judul_tahun(db, p)
    h = _cari(client, p, tahun_dari=99_999_999_999)
    assert (h["data"], h["total"]) == ([], 0)
    assert _cari(client, p, tahun_sampai=99_999_999_999)["total"] == 5  # tanpa batas atas (OQ-10)


def _judul_urut(db: Session, p: str) -> None:
    # Seri tahun 2010: urut lower(judul) lalu id ("beta" dua kali → id lebih kecil dulu).
    for nama, tahun in [("beta", 2010), ("Alfa", 2010), ("gamma", 1990), ("Delta", 2024)]:
        pabrik.judul(db, judul=f"{nama} {p}", tahun=tahun)
    pabrik.judul(db, judul=f"beta {p}", tahun=2010, penulis="Penulis Kedua")


def test_OQ_44_urut_tahun_terbaru_seri_judul_lalu_id(client, db: Session):
    p = _penanda()
    _judul_urut(db, p)
    h = _cari(client, p, urut="tahun_terbaru")
    assert [(b["judul"].split()[0], b["tahun"]) for b in h["data"]] == [
        ("Delta", 2024),
        ("Alfa", 2010),
        ("beta", 2010),
        ("beta", 2010),
        ("gamma", 1990),
    ]
    beta = [b for b in h["data"] if b["judul"].startswith("beta")]
    assert beta[0]["id"] < beta[1]["id"]


def test_OQ_44_urut_tahun_terlama(client, db: Session):
    p = _penanda()
    _judul_urut(db, p)
    h = _cari(client, p, urut="tahun_terlama")
    assert [b["judul"].split()[0] for b in h["data"]] == ["gamma", "Alfa", "beta", "beta", "Delta"]
    beta = [b for b in h["data"] if b["judul"].startswith("beta")]
    assert beta[0]["id"] < beta[1]["id"]


@pytest.mark.parametrize("nilai", ["judul_za", "acak", "TAHUN_TERBARU", ""])
def test_OQ_44_urut_tidak_sah_422(client, nilai):
    d = _galat(client.get(API, params={"urut": nilai}))
    assert d["kode"] == "VALIDASI_ISIAN"
    assert d["isian"]["urut"] == ("Harus salah satu dari: judul_az, tahun_terbaru, tahun_terlama.")


def test_FR_KTL_02_OQ_44_gabungan_q_dan_semua_filter_total_dan_paginasi(client, db: Session):
    p = _penanda()
    k1, k2, k_lain = pabrik.kategori(db), pabrik.kategori(db), pabrik.kategori(db)
    st = StatusEksemplar
    lolos = []
    for i, (k, tahun) in enumerate([(k1, 2001), (k2, 2015), (k1, 2008), (k2, 2020), (k1, 2003)]):
        _judul_dengan_eksemplar(db, [st.TERSEDIA], judul=f"L{i} {p}", kategori_id=k.id, tahun=tahun)
        lolos.append((tahun, f"L{i} {p}"))
    # Masing-masing gagal tepat satu syarat:
    _judul_dengan_eksemplar(
        db, [st.TERSEDIA], judul=f"X kategori {p}", kategori_id=k_lain.id, tahun=2010
    )
    _judul_dengan_eksemplar(
        db, [st.DIPINJAM], judul=f"X dipinjam {p}", kategori_id=k1.id, tahun=2010
    )
    _judul_dengan_eksemplar(db, [st.TERSEDIA], judul=f"X tahun {p}", kategori_id=k1.id, tahun=1999)
    _judul_dengan_eksemplar(
        db, [st.TERSEDIA], judul="X kata kunci lain", kategori_id=k1.id, tahun=2010
    )

    params = {
        "kategori_id": [k1.id, k2.id],
        "tersedia": "true",
        "tahun_dari": 2000,
        "tahun_sampai": 2020,
        "urut": "tahun_terbaru",
        "per_halaman": 2,
    }
    halaman = [_cari(client, p, halaman=n, **params) for n in (1, 2, 3)]
    assert all(h["total"] == 5 for h in halaman)
    gabung = [j for h in halaman for j in _juduls(h)]
    assert gabung == [j for _, j in sorted(lolos, key=lambda x: -x[0])]
    assert [len(h["data"]) for h in halaman] == [2, 2, 1]


def test_NFR_PRF_01_OQ_44_kombinasi_filter_10000_eksemplar_maks_2_detik(
    client, db: Session, capsys
):
    seed_performa(db, app_env="staging")
    kategori = db.scalars(select(Kategori.id).where(Kategori.nama.in_(["Sejarah", "Sains"]))).all()
    assert len(kategori) == 2
    dasar = {"kategori_id": kategori, "tersedia": "true", "tahun_dari": 1990, "tahun_sampai": 2020}
    client.get(API, params={"q": "a", **dasar})  # pemanasan koneksi/rencana query

    durasi = {}
    for q in ["a", "Pratama", "zzz-tidak-ada", ""]:
        for urut in ["judul_az", "tahun_terbaru", "tahun_terlama"]:
            for halaman in (1, 3):
                mulai = time.perf_counter()
                r = client.get(API, params={"q": q, "urut": urut, "halaman": halaman, **dasar})
                durasi[f"{q or '∅'}/{urut}/h{halaman}"] = time.perf_counter() - mulai
                assert r.status_code == 200, r.text

    with capsys.disabled():
        print(
            "\nNFR-PRF-01 OQ-44 durasi maks/median (detik):",
            round(max(durasi.values()), 3),
            round(sorted(durasi.values())[len(durasi) // 2], 3),
        )
    assert max(durasi.values()) <= 2.0


# ------------------------------------------------------------- daftar kategori publik (OQ-43)


def _nama_kategori_publik(client, awalan: str) -> list[str]:
    r = client.get(API_KATEGORI)
    assert r.status_code == 200, r.text
    return [k["nama"] for k in r.json() if k["nama"].startswith(awalan)]


def test_BR_01_OQ_43_kategori_publik_tanpa_login(client, db: Session):
    k = pabrik.kategori(db, nama=f"{_penanda()} Sejarah")
    client.cookies.clear()
    r = client.get(API_KATEGORI)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)
    assert {"id": k.id, "nama": k.nama} in r.json()


def test_OQ_43_kategori_hanya_id_dan_nama(client, db: Session):
    pabrik.kategori(db, nama=f"{_penanda()} Sains")
    data = client.get(API_KATEGORI).json()
    assert data
    assert all(set(k) == {"id", "nama"} for k in data)


def test_OQ_43_kategori_urut_a_z_tak_peka_huruf(client, db: Session):
    p = _penanda()
    # Urutan mentah (kolasi C) menaruh "Beta"/"Zeta" sebelum "alfa"/"charlie"; lower(nama) tidak.
    for nama in ("Zeta", "alfa", "Beta", "charlie"):
        pabrik.kategori(db, nama=f"{p} {nama}")
    assert _nama_kategori_publik(client, p) == [
        f"{p} alfa",
        f"{p} Beta",
        f"{p} charlie",
        f"{p} Zeta",
    ]


def test_OQ_43_kategori_tanpa_halaman(client, db: Session):
    p = _penanda()
    for i in range(25):  # lebih dari per_halaman bawaan katalog (20)
        pabrik.kategori(db, nama=f"{p} {i:02d}")
    assert len(_nama_kategori_publik(client, p)) == 25


def test_OQ_43_kategori_tanpa_judul_tetap_tampil(client, db: Session):
    p = _penanda()
    kosong = pabrik.kategori(db, nama=f"{p} Kosong")
    berisi = pabrik.kategori(db, nama=f"{p} Berisi")
    pabrik.judul(db, kategori_id=berisi.id)
    assert _nama_kategori_publik(client, p) == [berisi.nama, kosong.nama]


@pytest.mark.parametrize("params", [{"kategori_id": "1"}, {"q": "tidak-ada"}, {"halaman": "2"}])
def test_OQ_43_kategori_tanpa_filter(client, db: Session, params):
    pabrik.kategori(db, nama=f"{_penanda()} Anak")
    tanpa = client.get(API_KATEGORI).json()
    assert client.get(API_KATEGORI, params=params).json() == tanpa


@pytest.mark.parametrize("method", ["post", "put", "delete"])
def test_OQ_43_kategori_publik_hanya_baca(client, method):
    assert getattr(client, method)(API_KATEGORI).status_code == 405

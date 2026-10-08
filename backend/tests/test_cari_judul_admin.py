"""Susulan WP 5.3.5 — pencarian daftar judul admin (OQ-45, change request; aturan OQ-24/OQ-13).

`GET /api/v1/admin/judul?q=…` memakai ulang `katalog.filter_kata_kunci()`; tanpa `q` perilaku lama.
Data memakai penanda unik agar tidak bergantung pada isi DB lain.
"""

import time
import uuid

from sqlalchemy.orm import Session

from app.seed.data_uji import seed_performa
from tests import pabrik

API = "/api/v1/admin/judul"
API_KATALOG = "/api/v1/katalog/judul"


def _penanda() -> str:
    return f"zq{uuid.uuid4().hex[:10]}"


def _daftar(klien, **params) -> dict:
    r = klien.get(API, params=params)
    assert r.status_code == 200, r.text
    return r.json()


def _juduls(h: dict) -> list[str]:
    return [j["judul"] for j in h["data"]]


def test_OQ_45_tanpa_q_perilaku_lama(klien_admin, db: Session):
    p = _penanda()
    for nama in ["Cempaka", "anggrek", "Bakung", "anggrek"]:  # seri → urut id
        pabrik.judul(db, judul=f"{nama} {p}")
    polos = _daftar(klien_admin, halaman=1, per_halaman=100)
    for q in ["", "   "]:
        assert _daftar(klien_admin, q=q, halaman=1, per_halaman=100) == polos
    milik = [j for j in polos["data"] if j["judul"].endswith(p)]
    assert [j["judul"] for j in milik] == [
        f"{n} {p}" for n in ["anggrek", "anggrek", "Bakung", "Cempaka"]
    ]
    assert milik[0]["id"] < milik[1]["id"]


def test_OQ_45_q_cocok_judul_penulis_kategori_tak_peka_huruf(klien_admin, db: Session):
    p = _penanda()
    kat = pabrik.kategori(db, nama=f"Sejarah {p}")
    j_judul = pabrik.judul(db, judul=f"Bumi{p}Manusia")
    j_penulis = pabrik.judul(db, judul="Arus Balik", penulis=f"Pramoedya {p} Toer")
    j_kategori = pabrik.judul(db, judul="Gadis Pantai", kategori_id=kat.id)
    pabrik.judul(db, judul="Tidak Terkait")

    hasil = _daftar(klien_admin, q=p.upper()[2:9])  # potongan tengah, huruf besar
    assert {j["id"] for j in hasil["data"]} == {j_judul.id, j_penulis.id, j_kategori.id}
    assert hasil["total"] == 3


def test_OQ_45_OQ_13_isbn_dengan_dan_tanpa_tanda_hubung(klien_admin, db: Session):
    angka = f"{uuid.uuid4().int % 10**9:09d}"
    j = pabrik.judul(db, isbn=f"978-6{angka[:2]}-{angka[2:5]}-{angka[5:]}-1")
    pabrik.judul(db, judul="Pembanding", isbn="9790000000001")  # tidak boleh ikut
    for q in [f"9786{angka}1", f"978-6{angka[:2]}-{angka[2:5]}", f"6{angka[:2]} {angka[2:5]}"]:
        assert [x["id"] for x in _daftar(klien_admin, q=q)["data"]] == [j.id], q


def test_OQ_45_OQ_24_q_hanya_tanda_hubung_tidak_mencocokkan_semua_isbn(klien_admin, db: Session):
    p = _penanda()
    pabrik.judul(db, judul=f"Tanpa Strip {p}", isbn="9780000000017")
    dengan_strip = pabrik.judul(db, judul=f"Pakai-Strip {p}")
    hasil = _daftar(klien_admin, q="-", per_halaman=100)
    assert dengan_strip.id in {j["id"] for j in hasil["data"]}
    assert f"Tanpa Strip {p}" not in _juduls(hasil)


def test_OQ_45_wildcard_di_escape(klien_admin, db: Session):
    p = _penanda()
    persen = pabrik.judul(db, judul=f"100% Sehat {p}")
    garis = pabrik.judul(db, judul=f"a_b {p}")
    miring = pabrik.judul(db, judul=f"C:\\Data {p}")
    pabrik.judul(db, judul=f"1000 Sehat {p}")
    pabrik.judul(db, judul=f"axb {p}")

    def ids(q: str) -> set[int]:
        return {j["id"] for j in _daftar(klien_admin, q=q, per_halaman=100)["data"]}

    assert ids(f"100% Sehat {p}") == {persen.id}
    assert ids(f"a_b {p}") == {garis.id}
    assert ids(f"C:\\Data {p}") == {miring.id}


def test_OQ_45_paginasi_dan_total_sesuai_q(klien_admin, db: Session):
    p = _penanda()
    for i in range(25):
        pabrik.judul(db, judul=f"Cocok {i:02d} {p}")
    pabrik.judul(db, judul="Lain Sama Sekali")

    h1 = _daftar(klien_admin, q=p, halaman=1, per_halaman=10)
    h3 = _daftar(klien_admin, q=p, halaman=3, per_halaman=10)
    h4 = _daftar(klien_admin, q=p, halaman=4, per_halaman=10)
    assert (h1["total"], h3["total"], h4["total"]) == (25, 25, 25)
    assert _juduls(h1) == [f"Cocok {i:02d} {p}" for i in range(10)]
    assert _juduls(h3) == [f"Cocok {i:02d} {p}" for i in range(20, 25)]
    assert h4["data"] == []
    assert (h1["halaman"], h1["per_halaman"]) == (1, 10)


def test_OQ_45_hasil_sama_dengan_katalog_publik(klien_admin, db: Session):
    """Satu sumber aturan: himpunan judul admin = katalog publik untuk `q` yang sama."""
    p = _penanda()
    kat = pabrik.kategori(db, nama=f"Fiksi {p}")
    pabrik.judul(db, judul=f"Laskar {p}", isbn="978-602-8519-93-9")
    pabrik.judul(db, judul="Lain", penulis=f"Andrea {p}")
    pabrik.judul(db, judul="Kat", kategori_id=kat.id)
    pabrik.judul(db, judul=f"50% {p}")
    for q in [p, p.upper(), "978602851993", "602-8519", "-", f"50% {p}", "zzz-tidak-ada"]:
        admin = {j["id"] for j in _daftar(klien_admin, q=q, per_halaman=100)["data"]}
        r = klien_admin.get(API_KATALOG, params={"q": q, "per_halaman": 100})
        assert r.status_code == 200
        assert admin == {j["id"] for j in r.json()["data"]}, q


def test_OQ_45_NFR_PRF_01_cari_judul_admin_10000_eksemplar_maks_2_detik(
    klien_admin, db: Session, capsys
):
    """Acuan NFR-PRF-01 (SRS hanya mewajibkannya untuk katalog); pola sama dengan test_katalog."""
    seed_performa(db, app_env="staging")
    klien_admin.get(API, params={"q": "a"})  # pemanasan koneksi/rencana query

    durasi = {}
    for q in ["sejarah", "Pratama", "978-6021-0001", "zzz-tidak-ada", ""]:
        mulai = time.perf_counter()
        r = klien_admin.get(API, params={"q": q})
        durasi[q] = time.perf_counter() - mulai
        assert r.status_code == 200

    with capsys.disabled():
        print(
            "\nOQ-45 (acuan NFR-PRF-01) durasi (detik):",
            {k: round(v, 3) for k, v in durasi.items()},
        )
    assert max(durasi.values()) <= 2.0

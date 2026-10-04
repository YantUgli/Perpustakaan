"""WP 5.3.5 — kategori, rak, judul buku: FR-BKU-01..03, DR-03..05, OQ-09/10/12/13/18."""

import pytest
from sqlalchemy import func, inspect, select
from sqlalchemy.orm import Session

from app.core.keamanan import hash_password
from app.models import Eksemplar, JudulBuku, Kategori, Rak, Tagihan
from app.services import koleksi
from tests import pabrik
from tests.pabrik import TGL, harus_gagal

API = "/api/v1/admin"


def _judul_json(db: Session, **kw) -> dict:
    data = {
        "isbn": "978-602-03-1234-5",
        "judul": "Laskar Pelangi",
        "penulis": "Andrea Hirata",
        "penerbit": "Bentang",
        "tahun": 2005,
        "kategori_id": kw.pop("kategori_id", None) or pabrik.kategori(db).id,
        "harga": 89_000,
    }
    return data | kw


def _galat(r, status: int, kode: str) -> dict:
    assert r.status_code == status, r.text
    detail = r.json()["detail"]
    assert detail["kode"] == kode
    return detail


# ----------------------------------------------------------------------------- kategori (FR-BKU-01)


def test_FR_BKU_01_kategori_tambah_ubah_hapus(klien_admin, db):
    r = klien_admin.post(f"{API}/kategori", json={"nama": "  Novel  "})
    assert r.status_code == 201
    kid = r.json()["id"]
    assert r.json() == {"id": kid, "nama": "Novel"}  # di-trim
    assert (
        klien_admin.put(f"{API}/kategori/{kid}", json={"nama": "Fiksi"}).json()["nama"] == "Fiksi"
    )
    assert {"id": kid, "nama": "Fiksi"} in klien_admin.get(f"{API}/kategori").json()
    assert klien_admin.delete(f"{API}/kategori/{kid}").status_code == 204
    assert db.get(Kategori, kid) is None


def test_FR_BKU_01_hapus_kategori_yang_dipakai_ditolak_pesan_spesifik(klien_admin, db):
    k = pabrik.kategori(db, nama="Novel")
    pabrik.judul(db, kategori_id=k.id)
    pabrik.judul(db, kategori_id=k.id)
    d = _galat(klien_admin.delete(f"{API}/kategori/{k.id}"), 409, "BKU_KATEGORI_DIPAKAI")
    assert d["pesan"] == "Kategori 'Novel' masih dipakai oleh 2 judul buku."
    assert d["rujukan"] == "FR-BKU-01"
    assert db.get(Kategori, k.id) is not None


def test_OQ_09_kategori_duplikat_tak_peka_huruf_409(klien_admin, db):
    pabrik.kategori(db, nama="Novel")
    d = _galat(
        klien_admin.post(f"{API}/kategori", json={"nama": " NOVEL "}), 409, "BKU_KATEGORI_DUPLIKAT"
    )
    assert d["pesan"] == "Kategori 'NOVEL' sudah ada."


def test_FR_BKU_01_ubah_nama_kategori_ke_nama_yang_ada_409(klien_admin, db):
    pabrik.kategori(db, nama="Novel")
    k = pabrik.kategori(db, nama="Sains")
    _galat(
        klien_admin.put(f"{API}/kategori/{k.id}", json={"nama": "novel"}),
        409,
        "BKU_KATEGORI_DUPLIKAT",
    )
    # mengubah ke nama sendiri (beda huruf) tetap boleh
    assert klien_admin.put(f"{API}/kategori/{k.id}", json={"nama": "SAINS"}).status_code == 200


def test_OQ_10_nama_kategori_kosong_ditolak(klien_admin):
    d = _galat(klien_admin.post(f"{API}/kategori", json={"nama": "   "}), 422, "BKU_ISIAN_KOSONG")
    assert "nama" in d["pesan"]


# ----------------------------------------------------------------------------- rak (FR-BKU-01)


def test_FR_BKU_01_rak_tambah_ubah_hapus(klien_admin, db):
    r = klien_admin.post(f"{API}/rak", json={"kode": " A-01 ", "lokasi": " Lantai 1 "})
    assert r.status_code == 201
    rid = r.json()["id"]
    assert r.json() == {"id": rid, "kode": "A-01", "lokasi": "Lantai 1"}
    r = klien_admin.put(f"{API}/rak/{rid}", json={"kode": "A-02", "lokasi": "  "})
    assert r.json() == {"id": rid, "kode": "A-02", "lokasi": None}  # ASUMSI(OQ-08): lokasi opsional
    assert {"id": rid, "kode": "A-02", "lokasi": None} in klien_admin.get(f"{API}/rak").json()
    assert klien_admin.delete(f"{API}/rak/{rid}").status_code == 204
    assert db.get(Rak, rid) is None


def test_FR_BKU_01_hapus_rak_yang_dipakai_ditolak_pesan_spesifik(klien_admin, db):
    rak = pabrik.rak(db, kode="A-01")
    for _ in range(3):
        pabrik.eksemplar(db, rak_id=rak.id)
    d = _galat(klien_admin.delete(f"{API}/rak/{rak.id}"), 409, "BKU_RAK_DIPAKAI")
    assert d["pesan"] == "Rak A-01 masih dipakai oleh 3 eksemplar."


def test_OQ_09_kode_rak_duplikat_409(klien_admin, db):
    pabrik.rak(db, kode="A-01")
    d = _galat(klien_admin.post(f"{API}/rak", json={"kode": "a-01"}), 409, "BKU_RAK_DUPLIKAT")
    assert d["pesan"] == "Kode rak 'a-01' sudah ada."


# ----------------------------------------------------------------------------- judul (FR-BKU-02)


def test_FR_BKU_02_judul_tambah_ubah_detail(klien_admin, db):
    k = pabrik.kategori(db, nama="Novel")
    r = klien_admin.post(f"{API}/judul", json=_judul_json(db, kategori_id=k.id, judul="  Laskar  "))
    assert r.status_code == 201
    j = r.json()
    assert j["judul"] == "Laskar" and j["kategori"] == {"id": k.id, "nama": "Novel"}
    assert j["harga"] == 89_000 and j["cover_path"] is None
    baru = _judul_json(db, judul="Sang Pemimpi", harga=95_000, tahun=2006)
    r = klien_admin.put(f"{API}/judul/{j['id']}", json=baru)
    assert r.status_code == 200
    detail = klien_admin.get(f"{API}/judul/{j['id']}").json()
    assert (detail["judul"], detail["harga"], detail["tahun"]) == ("Sang Pemimpi", 95_000, 2006)
    assert detail["kategori"]["id"] == baru["kategori_id"]


def test_FR_BKU_02_daftar_judul_pagination(klien_admin, db):
    for nama in ["Cempaka", "anggrek", "Bakung"]:
        pabrik.judul(db, judul=nama)
    r = klien_admin.get(f"{API}/judul", params={"halaman": 1, "per_halaman": 2})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 3 and body["halaman"] == 1 and body["per_halaman"] == 2
    assert [j["judul"] for j in body["data"]] == ["anggrek", "Bakung"]  # urut tak peka huruf
    hal2 = klien_admin.get(f"{API}/judul", params={"halaman": 2, "per_halaman": 2}).json()
    assert [j["judul"] for j in hal2["data"]] == ["Cempaka"]


def test_OQ_12_hapus_judul_belum_pernah_dipinjam_eksemplar_ikut_terhapus(klien_admin, db):
    j = pabrik.judul(db)
    jid = j.id
    eid = [pabrik.eksemplar(db, judul_buku_id=jid).id for _ in range(2)]
    assert klien_admin.delete(f"{API}/judul/{jid}").status_code == 204
    db.expire_all()
    assert db.get(JudulBuku, jid) is None
    assert db.scalar(select(func.count()).where(Eksemplar.id.in_(eid))) == 0


def test_FR_BKU_02_hapus_judul_pernah_dipinjam_ditolak(klien_admin, db):
    j = pabrik.judul(db, judul="Bumi Manusia")
    pabrik.item(db, eksemplar_id=pabrik.eksemplar(db, judul_buku_id=j.id).id)
    d = _galat(klien_admin.delete(f"{API}/judul/{j.id}"), 409, "BKU_JUDUL_PERNAH_DIPINJAM")
    assert d["pesan"] == "Judul 'Bumi Manusia' tidak dapat dihapus karena pernah dipinjam."
    assert d["rujukan"] == "FR-BKU-02"


def test_FR_BKU_02_hapus_judul_pernah_dipinjam_sudah_dikembalikan_tetap_ditolak(klien_admin, db):
    j = pabrik.judul(db)
    it = pabrik.item(db, eksemplar_id=pabrik.eksemplar(db, judul_buku_id=j.id).id)
    it.status = "DIKEMBALIKAN"
    it.tanggal_kembali = TGL
    db.flush()
    _galat(klien_admin.delete(f"{API}/judul/{j.id}"), 409, "BKU_JUDUL_PERNAH_DIPINJAM")
    assert db.get(JudulBuku, j.id) is not None


def test_FR_BKU_02_kategori_tidak_ada_ditolak(klien_admin, db):
    r = klien_admin.post(f"{API}/judul", json=_judul_json(db, kategori_id=999_999_999))
    _galat(r, 422, "BKU_KATEGORI_TIDAK_ADA")


@pytest.mark.parametrize("harga", [0, -1, -100_000])
def test_DR_05_harga_nol_dan_negatif_ditolak(klien_admin, db, harga):
    d = _galat(
        klien_admin.post(f"{API}/judul", json=_judul_json(db, harga=harga)),
        422,
        "BKU_HARGA_TIDAK_VALID",
    )
    assert d["pesan"] == "Harga harus lebih dari Rp0."
    assert db.scalar(select(func.count()).select_from(JudulBuku)) == 0


@pytest.mark.parametrize("harga", [15_000.5, "15000", True])
def test_DR_05_harga_bukan_bilangan_bulat_ditolak(klien_admin, db, harga):
    assert klien_admin.post(f"{API}/judul", json=_judul_json(db, harga=harga)).status_code == 422


def test_OQ_10_tahun_nol_ditolak(klien_admin, db):
    _galat(
        klien_admin.post(f"{API}/judul", json=_judul_json(db, tahun=0)),
        422,
        "BKU_TAHUN_TIDAK_VALID",
    )


def test_OQ_10_isian_wajib_kosong_atau_spasi_ditolak(klien_admin, db):
    r = klien_admin.post(f"{API}/judul", json=_judul_json(db, penulis="  ", penerbit=""))
    d = _galat(r, 422, "BKU_ISIAN_KOSONG")
    assert d["pesan"] == "Isian wajib belum diisi: penulis, penerbit."


# ----------------------------------------------------------------------------- harga (FR-BKU-03)


def test_FR_BKU_03_harga_hanya_di_judul():
    assert "harga" in {c.name for c in JudulBuku.__table__.columns}
    assert "harga" not in {c.name for c in Eksemplar.__table__.columns}


def test_FR_BKU_03_ubah_harga_tidak_mengubah_tagihan_yang_sudah_ada(klien_admin, db):
    j = pabrik.judul(db, harga=100_000)
    it = pabrik.item(db, eksemplar_id=pabrik.eksemplar(db, judul_buku_id=j.id).id)
    t = pabrik.simpan(db, pabrik.tagihan_baru(db, item_transaksi_id=it.id, nominal=10_000))
    data = _judul_json(db, isbn=j.isbn, harga=250_000)
    assert klien_admin.put(f"{API}/judul/{j.id}", json=data).status_code == 200
    db.expire_all()
    assert db.get(Tagihan, t.id).nominal == 10_000
    assert db.get(JudulBuku, j.id).harga == 250_000


# ----------------------------------------------------------------------------- ISBN (OQ-13, OQ-18)


@pytest.mark.parametrize(
    ("ada", "baru"),
    [
        ("978-602-03-1234-5", "9786020312345"),
        ("9786020312345", "978 602 03 1234 5"),
        ("0-306-40615-X", "030640615x"),  # OQ-13: x → X
    ],
)
def test_OQ_13_isbn_sama_setelah_normalisasi_409(klien_admin, db, ada, baru):
    pabrik.judul(db, isbn=ada, judul="Sudah Ada")
    d = _galat(
        klien_admin.post(f"{API}/judul", json=_judul_json(db, isbn=baru)), 409, "BKU_ISBN_DUPLIKAT"
    )
    assert d["pesan"] == f"ISBN {baru} sudah dipakai oleh judul 'Sudah Ada'."


def test_OQ_13_isbn_disimpan_seperti_diketik(klien_admin, db):
    r = klien_admin.post(f"{API}/judul", json=_judul_json(db, isbn=" 978-602-03-1234-5 "))
    assert r.json()["isbn"] == "978-602-03-1234-5"  # hanya spasi tepi dibuang
    j = db.get(JudulBuku, r.json()["id"])
    db.refresh(j)
    assert j.isbn_normal == "9786020312345"


def test_OQ_13_ubah_judul_dengan_isbn_sendiri_boleh(klien_admin, db):
    j = pabrik.judul(db, isbn="9786020312345")
    data = _judul_json(db, isbn="978-602-03-1234-5")
    assert klien_admin.put(f"{API}/judul/{j.id}", json=data).status_code == 200


def test_OQ_13_unik_isbn_normal_ditegakkan_di_db(db):
    pabrik.judul(db, isbn="978-602-03-1234-5")
    k = pabrik.kategori(db)
    duplikat = JudulBuku(
        isbn="9786020312345",
        judul="x",
        penulis="x",
        penerbit="x",
        tahun=1,
        kategori_id=k.id,
        harga=1,
    )
    harus_gagal(db, duplikat, "uq_judul_buku_isbn_normal")


def test_OQ_13_normalisasi_python_sama_dengan_kolom_db(db):
    from app.core.validasi import normalisasi_isbn

    for mentah in ["978-602-03-1234-5", " 0 306 40615 x ", "979\t602-0312345"]:
        j = pabrik.judul(db, isbn=mentah)
        db.refresh(j)
        assert j.isbn_normal == normalisasi_isbn(mentah)


@pytest.mark.parametrize(
    "isbn",
    [
        "978602031234",
        "97860203123456",
        "97860X0312345",
        "X306406152",
        "030640615",
        "ISBN-978602",
        "-- --",
    ],
)
def test_OQ_18_isbn_bentuk_salah_ditolak(klien_admin, db, isbn):
    d = _galat(
        klien_admin.post(f"{API}/judul", json=_judul_json(db, isbn=isbn)), 422, "BKU_ISBN_BENTUK"
    )
    assert "10 karakter" in d["pesan"] and "13 angka" in d["pesan"]


@pytest.mark.parametrize(
    "isbn", ["0-306-40615-2", "030640615X", "978-602-03-1234-5", "9786020312340"]
)
def test_OQ_18_isbn_10_dan_13_diterima_tanpa_cek_digit_kontrol(klien_admin, db, isbn):
    assert klien_admin.post(f"{API}/judul", json=_judul_json(db, isbn=isbn)).status_code == 201


# ----------------------------------------------------------------------------- balapan (syarat 4)


def test_balapan_duplikat_kategori_rak_isbn_diterjemahkan_ke_409(klien_admin, db, monkeypatch):
    """Pemeriksaan service dilewati (meniru balapan): constraint DB menolak, pesan tetap sama."""
    monkeypatch.setattr(koleksi, "_kategori_bernama", lambda *a, **k: None)
    monkeypatch.setattr(koleksi, "_rak_berkode", lambda *a, **k: None)
    monkeypatch.setattr(koleksi, "_judul_ber_isbn", lambda *a, **k: None)
    pabrik.kategori(db, nama="Novel")
    pabrik.rak(db, kode="A-01")
    pabrik.judul(db, isbn="9786020312345", judul="Sudah Ada")

    d = _galat(
        klien_admin.post(f"{API}/kategori", json={"nama": "novel"}), 409, "BKU_KATEGORI_DUPLIKAT"
    )
    assert d["pesan"] == "Kategori 'novel' sudah ada."
    d = _galat(klien_admin.post(f"{API}/rak", json={"kode": "a-01"}), 409, "BKU_RAK_DUPLIKAT")
    assert d["pesan"] == "Kode rak 'a-01' sudah ada."
    r = klien_admin.post(f"{API}/judul", json=_judul_json(db, isbn="978-602-03-1234-5"))
    d = _galat(r, 409, "BKU_ISBN_DUPLIKAT")
    assert d["pesan"] == "ISBN 978-602-03-1234-5 sudah dipakai oleh judul 'Sudah Ada'."
    for teks in (r.text,):
        assert "duplicate key" not in teks and "uq_" not in teks


# ----------------------------------------------------------------------------- rujukan galat


def test_FR_BKU_01_rujukan_kategori_kosong(klien_admin):
    d = _galat(klien_admin.post(f"{API}/kategori", json={"nama": " "}), 422, "BKU_ISIAN_KOSONG")
    assert d["rujukan"] == "FR-BKU-01"


def test_FR_BKU_01_rujukan_rak_kosong(klien_admin):
    d = _galat(klien_admin.post(f"{API}/rak", json={"kode": " "}), 422, "BKU_ISIAN_KOSONG")
    assert d["rujukan"] == "FR-BKU-01"


def test_FR_BKU_02_rujukan_judul_kosong(klien_admin, db):
    r = klien_admin.post(f"{API}/judul", json=_judul_json(db, judul=" "))
    assert _galat(r, 422, "BKU_ISIAN_KOSONG")["rujukan"] == "FR-BKU-02"


def test_FR_BKU_02_rujukan_isbn_duplikat(klien_admin, db):
    pabrik.judul(db, isbn="9786020312345")
    r = klien_admin.post(f"{API}/judul", json=_judul_json(db, isbn="978-602-03-1234-5"))
    assert _galat(r, 409, "BKU_ISBN_DUPLIKAT")["rujukan"] == "FR-BKU-02"


def test_FR_BKU_02_rujukan_isbn_bentuk(klien_admin, db):
    r = klien_admin.post(f"{API}/judul", json=_judul_json(db, isbn="12345"))
    assert _galat(r, 422, "BKU_ISBN_BENTUK")["rujukan"] == "FR-BKU-02"


def test_balapan_hapus_yang_dipakai_diterjemahkan_ke_409(klien_admin, db, monkeypatch):
    monkeypatch.setattr(koleksi, "_jumlah_judul_kategori", lambda *a, **k: 0)
    monkeypatch.setattr(koleksi, "_jumlah_eksemplar_rak", lambda *a, **k: 0)
    monkeypatch.setattr(koleksi, "_pernah_dipinjam", lambda *a, **k: False)
    k = pabrik.kategori(db, nama="Novel")
    j = pabrik.judul(db, kategori_id=k.id, judul="Bumi Manusia")
    rak = pabrik.rak(db, kode="A-01")
    pabrik.item(db, eksemplar_id=pabrik.eksemplar(db, judul_buku_id=j.id, rak_id=rak.id).id)

    r = klien_admin.delete(f"{API}/kategori/{k.id}")
    _galat(r, 409, "BKU_KATEGORI_DIPAKAI")
    assert "foreign key" not in r.text.lower()
    _galat(klien_admin.delete(f"{API}/rak/{rak.id}"), 409, "BKU_RAK_DIPAKAI")
    d = _galat(klien_admin.delete(f"{API}/judul/{j.id}"), 409, "BKU_JUDUL_PERNAH_DIPINJAM")
    assert d["pesan"] == "Judul 'Bumi Manusia' tidak dapat dihapus karena pernah dipinjam."
    db.expire_all()
    assert db.get(JudulBuku, j.id) is not None


# ----------------------------------------------------------------------------- akses & 404


def test_NFR_SEC_03_anggota_ke_endpoint_koleksi_403(client, db):
    akun = pabrik.anggota(db, password_hash=hash_password("rahasia-123"))
    client.post("/api/v1/auth/login", json={"email": akun.email, "password": "rahasia-123"})
    for method, path in [
        ("GET", "kategori"),
        ("POST", "rak"),
        ("GET", "judul"),
        ("DELETE", "judul/1"),
    ]:
        assert client.request(method, f"{API}/{path}", json={}).status_code == 403


def test_404_judul_kategori_rak_tidak_ada(klien_admin):
    for path, kode in [
        ("judul/999999999", "BKU_JUDUL_TIDAK_ADA"),
        ("kategori/999999999", "BKU_KATEGORI_TIDAK_ADA"),
        ("rak/999999999", "BKU_RAK_TIDAK_ADA"),
    ]:
        _galat(klien_admin.delete(f"{API}/{path}"), 404, kode)
    _galat(klien_admin.get(f"{API}/judul/999999999"), 404, "BKU_JUDUL_TIDAK_ADA")


def test_DR_05_kolom_isbn_normal_adalah_kolom_generated(engine):
    kolom = {c["name"]: c for c in inspect(engine).get_columns("judul_buku")}
    assert "computed" in kolom["isbn_normal"]

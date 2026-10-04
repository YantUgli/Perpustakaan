"""WP 5.3.6 — eksemplar: FR-BKU-04..09, K-02, OQ-03/10/20/21, NFR-REL-01."""

import re

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.keamanan import hash_password
from app.models import Eksemplar, ItemTransaksi, Tagihan
from app.services.eksemplar import judul_singkat
from tests import pabrik
from tests.test_autentikasi import _route_aplikasi_sungguhan

API = "/api/v1/admin"


def _galat(r, status: int, kode: str) -> dict:
    assert r.status_code == status, r.text
    detail = r.json()["detail"]
    assert detail["kode"] == kode
    return detail


def _jumlah(db: Session, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


def _nomor(kode: str) -> int:
    assert re.fullmatch(r"EKS-\d{6}", kode), kode
    return int(kode[4:])


# --------------------------------------------------------------------------- tambah (FR-BKU-04)


def test_FR_BKU_04_tambah_n_eksemplar_kode_unik_berurutan_status_tersedia(klien_admin, db):
    j, rak = pabrik.judul(db), pabrik.rak(db, kode="A-01")
    r = klien_admin.post(f"{API}/judul/{j.id}/eksemplar", json={"jumlah": 5, "rak_id": rak.id})
    assert r.status_code == 201, r.text
    data = r.json()
    assert len(data) == 5
    nomor = [_nomor(e["kode"]) for e in data]
    assert nomor == list(range(nomor[0], nomor[0] + 5))  # ASUMSI(OQ-03): berurutan dari sequence
    assert {e["status"] for e in data} == {"TERSEDIA"}
    assert {e["rak"]["kode"] for e in data} == {"A-01"}
    assert _jumlah(db, Eksemplar) == 5


def test_FR_BKU_04_tambah_satu_eksemplar(klien_admin, db):
    j, rak = pabrik.judul(db), pabrik.rak(db)
    r = klien_admin.post(f"{API}/judul/{j.id}/eksemplar", json={"jumlah": 1, "rak_id": rak.id})
    assert r.status_code == 201 and len(r.json()) == 1


def test_OQ_10_tambah_eksemplar_tanpa_rak_atau_rak_tidak_ada_ditolak(klien_admin, db):
    j = pabrik.judul(db)
    assert klien_admin.post(f"{API}/judul/{j.id}/eksemplar", json={"jumlah": 1}).status_code == 422
    r = klien_admin.post(f"{API}/judul/{j.id}/eksemplar", json={"jumlah": 1, "rak_id": 999_999_999})
    d = _galat(r, 422, "BKU_RAK_TIDAK_ADA")
    assert d["pesan"] == "Rak yang dipilih tidak ditemukan."
    assert _jumlah(db, Eksemplar) == 0


@pytest.mark.parametrize("jumlah", [0, -1, 101])
def test_FR_BKU_04_jumlah_nol_atau_melebihi_batas_ditolak(klien_admin, db, jumlah):
    j, rak = pabrik.judul(db), pabrik.rak(db)
    r = klien_admin.post(f"{API}/judul/{j.id}/eksemplar", json={"jumlah": jumlah, "rak_id": rak.id})
    d = _galat(r, 422, "BKU_JUMLAH_EKSEMPLAR")
    assert d["pesan"] == "Jumlah eksemplar per penambahan 1–100."
    assert _jumlah(db, Eksemplar) == 0


def test_FR_BKU_04_seratus_eksemplar_diterima(klien_admin, db):
    j, rak = pabrik.judul(db), pabrik.rak(db)
    r = klien_admin.post(f"{API}/judul/{j.id}/eksemplar", json={"jumlah": 100, "rak_id": rak.id})
    assert r.status_code == 201 and len({e["kode"] for e in r.json()}) == 100


def test_FR_BKU_04_judul_tidak_ada_404(klien_admin, db):
    rak = pabrik.rak(db)
    r = klien_admin.post(f"{API}/judul/999999999/eksemplar", json={"jumlah": 1, "rak_id": rak.id})
    _galat(r, 404, "BKU_JUDUL_TIDAK_ADA")


@pytest.fixture
def sequence_hampir_habis(engine):
    """Sisakan 2 kode EKS. Sequence tidak transaksional → selalu dipulihkan di teardown."""
    with engine.begin() as k:
        semula = k.execute(text("SELECT last_value, is_called FROM seq_kode_eksemplar")).one()
        k.execute(text("SELECT setval('seq_kode_eksemplar', 999997, true)"))
    try:
        yield
    finally:
        with engine.begin() as k:
            k.execute(
                text("SELECT setval('seq_kode_eksemplar', :v, :c)"),
                {"v": semula.last_value, "c": semula.is_called},
            )


def test_NFR_REL_01_tambah_n_eksemplar_atomik_gagal_di_tengah_tidak_ada_yang_tersimpan(
    klien_admin, db, sequence_hampir_habis
):
    j, rak = pabrik.judul(db), pabrik.rak(db)
    # Kode ke-1 dan ke-2 masih ada (EKS-999998, EKS-999999); ke-3 gagal di sequence.
    r = klien_admin.post(f"{API}/judul/{j.id}/eksemplar", json={"jumlah": 5, "rak_id": rak.id})
    d = _galat(r, 409, "BKU_KODE_EKSEMPLAR_HABIS")
    assert "EKS-999999" in d["pesan"]
    assert _jumlah(db, Eksemplar) == 0


def test_FR_BKU_04_rujukan_kode_eksemplar_habis(klien_admin, db, sequence_hampir_habis):
    j, rak = pabrik.judul(db), pabrik.rak(db)
    r = klien_admin.post(f"{API}/judul/{j.id}/eksemplar", json={"jumlah": 3, "rak_id": rak.id})
    assert _galat(r, 409, "BKU_KODE_EKSEMPLAR_HABIS")["rujukan"] == "FR-BKU-04"


# --------------------------------------------------------------------------- rak (FR-BKU-05)


def test_FR_BKU_05_ubah_rak_eksemplar(klien_admin, db):
    e, baru = pabrik.eksemplar(db), pabrik.rak(db, kode="B-02", lokasi="Lantai 2")
    r = klien_admin.put(f"{API}/eksemplar/{e.id}/rak", json={"rak_id": baru.id})
    assert r.status_code == 200
    assert r.json()["rak"] == {"id": baru.id, "kode": "B-02", "lokasi": "Lantai 2"}
    db.expire_all()
    assert db.get(Eksemplar, e.id).rak_id == baru.id


def test_FR_BKU_05_ubah_ke_rak_tidak_ada_ditolak(klien_admin, db):
    e = pabrik.eksemplar(db)
    r = klien_admin.put(f"{API}/eksemplar/{e.id}/rak", json={"rak_id": 999_999_999})
    _galat(r, 422, "BKU_RAK_TIDAK_ADA")


@pytest.mark.parametrize("status", ["DIPINJAM", "HILANG", "RUSAK"])
def test_OQ_21_ubah_rak_eksemplar_dipinjam_boleh_status_tetap(klien_admin, db, status):
    e, baru = pabrik.eksemplar(db, status=status), pabrik.rak(db)
    r = klien_admin.put(f"{API}/eksemplar/{e.id}/rak", json={"rak_id": baru.id})
    assert r.status_code == 200
    assert r.json()["status"] == status
    db.expire_all()
    e = db.get(Eksemplar, e.id)
    assert (e.rak_id, e.status) == (baru.id, status)


def test_eksemplar_tidak_ada_404(klien_admin, db):
    rak = pabrik.rak(db)
    _galat(
        klien_admin.put(f"{API}/eksemplar/999999999/rak", json={"rak_id": rak.id}),
        404,
        "BKU_EKSEMPLAR_TIDAK_ADA",
    )
    _galat(klien_admin.post(f"{API}/eksemplar/999999999/rusak"), 404, "BKU_EKSEMPLAR_TIDAK_ADA")


# --------------------------------------------------------------------- rusak manual (FR-BKU-07/08)


def test_FR_BKU_07_tersedia_ke_rusak_tanpa_tagihan(klien_admin, db):
    e = pabrik.eksemplar(db)
    tagihan_awal, item_awal = _jumlah(db, Tagihan), _jumlah(db, ItemTransaksi)
    r = klien_admin.post(f"{API}/eksemplar/{e.id}/rusak")
    assert r.status_code == 200
    assert r.json()["status"] == "RUSAK"
    db.expire_all()
    assert db.get(Eksemplar, e.id).status == "RUSAK"
    assert _jumlah(db, Tagihan) == tagihan_awal  # K-02: tanpa tagihan
    assert _jumlah(db, ItemTransaksi) == item_awal  # tidak menyentuh sirkulasi


def test_FR_BKU_08_ubah_manual_eksemplar_dipinjam_ditolak(klien_admin, db):
    e = pabrik.eksemplar(db, status="DIPINJAM")
    d = _galat(klien_admin.post(f"{API}/eksemplar/{e.id}/rusak"), 409, "BKU_EKSEMPLAR_DIPINJAM")
    assert d["pesan"] == (
        f"Eksemplar {e.kode} sedang Dipinjam; statusnya hanya dapat berubah melalui "
        "pengembalian atau pencatatan hilang/rusak."
    )
    assert d["rujukan"] == "FR-BKU-08"
    db.expire_all()
    assert db.get(Eksemplar, e.id).status == "DIPINJAM"


@pytest.mark.parametrize(("status", "label"), [("RUSAK", "Rusak"), ("HILANG", "Hilang")])
def test_FR_BKU_07_rusak_atau_hilang_tidak_bisa_dirusak_lagi_409(klien_admin, db, status, label):
    e = pabrik.eksemplar(db, status=status)
    d = _galat(klien_admin.post(f"{API}/eksemplar/{e.id}/rusak"), 409, "BKU_STATUS_TIDAK_SESUAI")
    assert d["pesan"] == (
        f"Eksemplar {e.kode} berstatus {label}; ubah status manual hanya dari Tersedia ke Rusak."
    )


def test_domain_tidak_ada_endpoint_pulihkan_eksemplar_rusak():
    """§3/§13: Rusak → Tersedia hanya lewat tagihan Buku Pengganti (WP 5.3.11), bukan di sini."""
    path_eksemplar = {
        (m, r.path)
        for r in _route_aplikasi_sungguhan()
        for m in r.methods
        if "/eksemplar" in r.path
    }
    assert path_eksemplar == {
        ("POST", "/api/v1/admin/judul/{judul_id}/eksemplar"),
        ("GET", "/api/v1/admin/judul/{judul_id}/eksemplar"),
        ("PUT", "/api/v1/admin/eksemplar/{eksemplar_id}/rak"),
        ("POST", "/api/v1/admin/eksemplar/{eksemplar_id}/rusak"),
        ("GET", "/api/v1/admin/eksemplar/label"),
    }
    terlarang = re.compile(r"pulih|restore|tersedia|/status", re.IGNORECASE)
    assert [p for _, p in path_eksemplar if terlarang.search(p)] == []


def test_OQ_20_tidak_ada_endpoint_hapus_eksemplar():
    metode = {(m, r.path) for r in _route_aplikasi_sungguhan() for m in r.methods}
    assert not any(m == "DELETE" and "eksemplar" in p for m, p in metode)


# --------------------------------------------------------------------------- rekap (FR-BKU-09)


def test_FR_BKU_09_rekap_stok_per_judul_total_dan_per_status(klien_admin, db):
    j = pabrik.judul(db)
    for status in ["TERSEDIA", "TERSEDIA", "DIPINJAM", "HILANG", "RUSAK"]:
        pabrik.eksemplar(db, judul_buku_id=j.id, status=status)
    pabrik.eksemplar(db)  # judul lain tidak ikut
    r = klien_admin.get(f"{API}/judul/{j.id}/eksemplar")
    assert r.status_code == 200
    body = r.json()
    assert body["judul_id"] == j.id
    # total = SEMUA eksemplar (FR-BKU-09), berbeda dengan Y katalog (FR-KTL-03)
    assert body["rekap"] == {"total": 5, "tersedia": 2, "dipinjam": 1, "hilang": 1, "rusak": 1}
    kode = [e["kode"] for e in body["data"]]
    assert len(kode) == 5 and kode == sorted(kode)


def test_FR_BKU_09_judul_tanpa_eksemplar_rekap_nol(klien_admin, db):
    j = pabrik.judul(db)
    body = klien_admin.get(f"{API}/judul/{j.id}/eksemplar").json()
    assert body["rekap"] == {"total": 0, "tersedia": 0, "dipinjam": 0, "hilang": 0, "rusak": 0}
    assert body["data"] == []


def test_FR_BKU_09_judul_tidak_ada_404(klien_admin):
    _galat(klien_admin.get(f"{API}/judul/999999999/eksemplar"), 404, "BKU_JUDUL_TIDAK_ADA")


# --------------------------------------------------------------------------- data label (FR-BKU-06)


def test_FR_BKU_06_data_label_beberapa_eksemplar_kode_judul_singkat_isi_qr(klien_admin, db):
    j1 = pabrik.judul(db, judul="Laskar Pelangi")
    j2 = pabrik.judul(db, judul="Bumi Manusia")
    e1, e2 = pabrik.eksemplar(db, judul_buku_id=j1.id), pabrik.eksemplar(db, judul_buku_id=j2.id)
    r = klien_admin.get(f"{API}/eksemplar/label", params=[("id", e2.id), ("id", e1.id)])
    assert r.status_code == 200
    assert r.json() == [  # urutan sesuai permintaan; isi QR = kode teks polos (IR-SW-02)
        {"kode": e2.kode, "judul_singkat": "Bumi Manusia", "isi_qr": e2.kode},
        {"kode": e1.kode, "judul_singkat": "Laskar Pelangi", "isi_qr": e1.kode},
    ]


def test_FR_BKU_06_label_judul_panjang_dipendekkan(klien_admin, db):
    j = pabrik.judul(db, judul="Sejarah Peradaban Manusia dari Zaman Batu hingga Modern")
    e = pabrik.eksemplar(db, judul_buku_id=j.id)
    label = klien_admin.get(f"{API}/eksemplar/label", params={"id": e.id}).json()[0]
    assert label["judul_singkat"] == "Sejarah Peradaban Manusia…"


@pytest.mark.parametrize(
    ("judul", "hasil"),
    [
        ("Pendek", "Pendek"),
        ("x" * 30, "x" * 30),  # tepat 30: utuh
        ("Sejarah Peradaban Manusia dari Zaman Batu", "Sejarah Peradaban Manusia…"),
        ("y" * 45, "y" * 29 + "…"),  # tanpa spasi: potong keras
        ("  Judul   dengan  spasi  ", "Judul dengan spasi"),
    ],
)
def test_FR_BKU_06_aturan_judul_singkat_maks_30_karakter(judul, hasil):
    assert judul_singkat(judul) == hasil
    assert len(judul_singkat(judul)) <= 30


def test_FR_BKU_06_id_tidak_ada_404_menyebut_id(klien_admin, db):
    e = pabrik.eksemplar(db)
    r = klien_admin.get(
        f"{API}/eksemplar/label", params=[("id", e.id), ("id", 999999998), ("id", 999999999)]
    )
    d = _galat(r, 404, "BKU_EKSEMPLAR_TIDAK_ADA")
    assert d["pesan"] == "Eksemplar tidak ditemukan: id 999999998, 999999999."


@pytest.mark.parametrize("jumlah", [0, 201])
def test_FR_BKU_06_label_kosong_atau_lebih_200_ditolak(klien_admin, jumlah):
    r = klien_admin.get(f"{API}/eksemplar/label", params=[("id", i + 1) for i in range(jumlah)])
    d = _galat(r, 422, "BKU_JUMLAH_LABEL")
    assert d["pesan"] == "Data label 1–200 eksemplar per permintaan."


# --------------------------------------------------------------------------- akses


def test_NFR_SEC_03_anggota_ke_endpoint_eksemplar_403(client, db):
    akun = pabrik.anggota(db, password_hash=hash_password("rahasia-123"))
    client.post("/api/v1/auth/login", json={"email": akun.email, "password": "rahasia-123"})
    for method, path in [
        ("POST", "judul/1/eksemplar"),
        ("GET", "judul/1/eksemplar"),
        ("PUT", "eksemplar/1/rak"),
        ("POST", "eksemplar/1/rusak"),
        ("GET", "eksemplar/label?id=1"),
    ]:
        assert client.request(method, f"{API}/{path}", json={}).status_code == 403

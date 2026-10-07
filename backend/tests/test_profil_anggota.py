"""WP 5.3.4 — profil anggota: FR-AKN-07/08/09, K-05, K-06, NFR-SEC-02/03, OQ-02/09/32.

Email test memakai domain `.example` (`.test` ditolak validasi email, decisions.md §B).
"""

import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.core.keamanan import hash_password, verifikasi_password
from app.models import Anggota, Sesi
from app.services import anggota as layanan
from app.services import autentikasi, pendaftaran
from tests import pabrik

API = "/api/v1/anggota/profil"
PASSWORD = "rahasia-123"
RAHASIA = "RahasiaSangatPenting-9"
PESAN_TIDAK_BOLEH = "Isian ini tidak dikenal atau tidak dapat diubah."


def _email() -> str:
    return f"agt{uuid.uuid4().hex[:10]}@perpus.example"


def _anggota(db: Session, **kw) -> Anggota:
    data = {"email": _email(), "password_hash": hash_password(PASSWORD)}
    return pabrik.anggota(db, **(data | kw))


@pytest.fixture
def saya(client, db: Session) -> Anggota:
    """Anggota yang login lewat `client` (sesi perangkat ini)."""
    a = _anggota(db, nama="Rina Saya")
    r = client.post("/api/v1/auth/login", json={"email": a.email, "password": PASSWORD})
    assert r.status_code == 200
    return a


def _body(a: Anggota, **ubah) -> dict:
    return {"nama": a.nama, "alamat": a.alamat, "email": a.email, "telepon": a.telepon} | ubah


def _segar(db: Session, a: Anggota) -> Anggota:
    db.expire_all()
    return db.get(Anggota, a.id)


def _jumlah_sesi(db: Session, a: Anggota) -> int:
    db.expire_all()
    return db.scalar(select(func.count()).where(Sesi.anggota_id == a.id))


def _galat(r, status: int, kode: str) -> dict:
    assert r.status_code == status, r.text
    d = r.json()["detail"]
    assert d["kode"] == kode
    return d


# ---------------------------------------------------------------------- lihat & ubah (FR-AKN-07)


def test_FR_AKN_07_lihat_profil_sendiri(client, saya):
    r = client.get(API)
    assert r.status_code == 200
    assert r.json() == {
        "kode": saya.kode,
        "nama": "Rina Saya",
        "alamat": saya.alamat,
        "email": saya.email,
        "telepon": saya.telepon,
        "nik": saya.nik,  # data sendiri, hanya informasi
        "tanggal_daftar": saya.tanggal_daftar.isoformat(),
        "ada_foto": False,  # OQ-42: penanda saja
    }  # tanpa password_hash / foto_path


def test_FR_AKN_07_anggota_ubah_nama_alamat_email_telepon(client, db: Session, saya):
    autentikasi.login(db, email=saya.email, password=PASSWORD)  # perangkat lain
    sesi_awal = _jumlah_sesi(db, saya)
    nik_awal = saya.nik
    baru = _email()
    r = client.put(
        API,
        json={
            "nama": "  Rina Baru ",
            "alamat": "Jl. Baru 2",
            "email": f" {baru} ",
            "telepon": "0899",
        },
    )
    assert r.status_code == 200, r.text
    assert (r.json()["nama"], r.json()["email"], r.json()["nik"]) == ("Rina Baru", baru, nik_awal)
    a = _segar(db, saya)
    assert (a.nama, a.alamat, a.email, a.telepon, a.nik) == (
        "Rina Baru",
        "Jl. Baru 2",
        baru,
        "0899",
        nik_awal,
    )
    assert _jumlah_sesi(db, saya) == sesi_awal  # OQ-32: ubah data diri tidak mencabut sesi


@pytest.mark.parametrize("isian", ["nik", "foto", "kode", "id", "anggota_id", "password_hash"])
def test_FR_AKN_07_K_05_NFR_SEC_03_isian_asing_ditolak(client, db: Session, saya, isian):
    lain = _anggota(db)
    nilai = {"nik": "9" * 16, "kode": lain.kode, "id": lain.id, "anggota_id": lain.id}
    d = _galat(
        client.put(API, json=_body(saya, nama="Diubah") | {isian: nilai.get(isian, "x")}),
        422,
        "VALIDASI_ISIAN",
    )
    assert d["isian"] == {isian: PESAN_TIDAK_BOLEH}
    assert (_segar(db, saya).nama, _segar(db, saya).nik) == ("Rina Saya", saya.nik)
    assert _segar(db, lain).nama == lain.nama


def test_FR_AKN_07_isian_wajib_dan_email_tidak_valid_per_isian(client, db: Session, saya):
    d = _galat(
        client.put(API, json=_body(saya, nama="  ", email="bukan-email", telepon="")),
        422,
        "AKN_ISIAN_TIDAK_VALID",
    )
    assert d["isian"] == {
        "nama": "Nama wajib diisi.",
        "email": "Format email tidak valid.",
        "telepon": "Telepon wajib diisi.",
    }
    assert "FR-AKN-07" in d["rujukan"] and "FR-AKN-08" in d["rujukan"]
    assert _segar(db, saya).nama == "Rina Saya"


# ---------------------------------------------------------------------- email (FR-AKN-08, K-06)


def test_FR_AKN_08_K_06_email_terpakai_anggota_lain_ditolak(client, db: Session, saya):
    lain = _anggota(db)
    d = _galat(client.put(API, json=_body(saya, email=lain.email)), 409, "AKN_DATA_DUPLIKAT")
    assert d["isian"] == {"email": "Email sudah terdaftar."}
    assert d["rujukan"] == "FR-AKN-08"
    assert _segar(db, saya).email == saya.email


def test_FR_AKN_08_OQ_02_email_admin_beda_huruf_ditolak_pesan_identik(client, db: Session, saya):
    admin = pabrik.admin(db, email=f"Admin{uuid.uuid4().hex[:8]}@Perpus.Example")
    lain = _anggota(db)
    d_admin = _galat(
        client.put(API, json=_body(saya, email=f" {admin.email.swapcase()} ")),
        409,
        "AKN_DATA_DUPLIKAT",
    )
    d_agt = _galat(client.put(API, json=_body(saya, email=lain.email)), 409, "AKN_DATA_DUPLIKAT")
    assert d_admin == d_agt  # tidak membedakan admin/anggota
    assert "admin" not in str(d_admin).lower()


def test_FR_AKN_08_email_sendiri_beda_huruf_boleh(client, db: Session, saya):
    r = client.put(API, json=_body(saya, email=saya.email.upper()))
    assert r.status_code == 200, r.text
    assert _segar(db, saya).email == saya.email.upper()


def test_FR_AKN_08_balapan_integrity_error_diterjemahkan(db: Session, monkeypatch):
    a, lain = _anggota(db), _anggota(db)
    db.commit()  # setup ter-commit: rollback service tidak membuangnya
    monkeypatch.setattr(pendaftaran, "email_terpakai", lambda *args, **kw: False)  # cek awal lolos
    with pytest.raises(GalatBisnis) as info:
        layanan.ubah_profil(
            db, a.id, nama=a.nama, alamat=a.alamat, email=lain.email.upper(), telepon=a.telepon
        )
    g = info.value
    assert (g.kode, g.status_code, g.isian) == (
        "AKN_DATA_DUPLIKAT",
        409,
        {"email": "Email sudah terdaftar."},
    )
    assert "uq_anggota" not in g.pesan
    assert _segar(db, a).email == a.email


# --------------------------------------------------------------------------- password (FR-AKN-09)


def test_FR_AKN_09_ganti_password_lalu_login_dengan_yang_baru(client, db: Session, saya):
    r = client.put(
        f"{API}/password", json={"password_lama": PASSWORD, "password_baru": "baru-12345"}
    )
    assert r.status_code == 204, r.text
    h = _segar(db, saya).password_hash
    assert h.startswith("$argon2id$") and verifikasi_password("baru-12345", h)
    assert not verifikasi_password(PASSWORD, h)
    assert client.get(API).status_code == 200  # sesi perangkat ini tetap


@pytest.mark.parametrize(
    ("lama", "pesan"),
    [("salah-sekali", "Password lama salah."), ("", "Password lama wajib diisi.")],
)
def test_FR_AKN_09_password_lama_salah_atau_kosong_ditolak(client, db: Session, saya, lama, pesan):
    autentikasi.login(db, email=saya.email, password=PASSWORD)
    sesi_awal = _jumlah_sesi(db, saya)
    hash_awal = saya.password_hash
    d = _galat(
        client.put(f"{API}/password", json={"password_lama": lama, "password_baru": "baru-12345"}),
        422,
        "AKN_ISIAN_TIDAK_VALID",
    )
    assert d["isian"] == {"password_lama": pesan}
    assert d["rujukan"] == "FR-AKN-09"
    assert _segar(db, saya).password_hash == hash_awal
    assert _jumlah_sesi(db, saya) == sesi_awal  # tidak ada yang dicabut


def test_FR_AKN_09_password_lama_tidak_di_trim(client, db: Session):
    a = _anggota(db, password_hash=hash_password("  spasi-di-tepi  "))
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": a.email, "password": "  spasi-di-tepi  "}
        ).status_code
        == 200
    )
    salah = client.put(
        f"{API}/password", json={"password_lama": "spasi-di-tepi", "password_baru": "baru-12345"}
    )
    _galat(salah, 422, "AKN_ISIAN_TIDAK_VALID")
    benar = client.put(
        f"{API}/password",
        json={"password_lama": "  spasi-di-tepi  ", "password_baru": "baru-12345"},
    )
    assert benar.status_code == 204


def test_FR_AKN_09_NFR_SEC_02_password_baru_pendek_ditolak(client, db: Session, saya):
    d = _galat(
        client.put(f"{API}/password", json={"password_lama": PASSWORD, "password_baru": "1234567"}),
        422,
        "AKN_ISIAN_TIDAK_VALID",
    )
    assert d["isian"] == {"password_baru": "Password baru minimal 8 karakter."}
    assert d["rujukan"] == "NFR-SEC-02"
    ok = client.put(
        f"{API}/password", json={"password_lama": PASSWORD, "password_baru": "12345678"}
    )
    assert ok.status_code == 204


def test_OQ_32_ganti_password_mencabut_sesi_lain_saja(client, db: Session, saya):
    lain_1, _ = autentikasi.login(db, email=saya.email, password=PASSWORD)
    lain_2, _ = autentikasi.login(db, email=saya.email, password=PASSWORD)
    orang_lain = _anggota(db)
    autentikasi.login(db, email=orang_lain.email, password=PASSWORD)
    assert _jumlah_sesi(db, saya) == 3

    r = client.put(
        f"{API}/password", json={"password_lama": PASSWORD, "password_baru": "baru-12345"}
    )
    assert r.status_code == 204
    assert _jumlah_sesi(db, saya) == 1  # hanya sesi perangkat ini
    assert client.get(API).status_code == 200
    for token in (lain_1, lain_2):
        with pytest.raises(GalatBisnis):
            autentikasi.pengguna_dari_token(db, token)
    assert _jumlah_sesi(db, orang_lain) == 1  # sesi akun lain tak tersentuh


# --------------------------------------------------------------------------- hak akses (NFR-SEC-03)


def test_NFR_SEC_03_profil_hanya_milik_sendiri(client, db: Session, saya):
    lain = _anggota(db, nama="Bukan Saya")
    assert client.get(API).json()["kode"] == saya.kode
    client.put(API, json=_body(saya, nama="Saya Diubah"))
    assert _segar(db, lain).nama == "Bukan Saya"

    from tests.test_autentikasi import _route_aplikasi_sungguhan

    profil = [r for r in _route_aplikasi_sungguhan() if r.path.startswith(API)]
    assert profil
    assert all("{" not in r.path for r in profil)  # tanpa id/kode anggota di path


def test_NFR_SEC_03_tanpa_login_401(client):
    assert client.get(API).status_code == 401
    assert (
        client.put(API, json={"nama": "a", "alamat": "b", "email": "c", "telepon": "d"}).status_code
        == 401
    )
    assert (
        client.put(f"{API}/password", json={"password_lama": "a", "password_baru": "b"}).status_code
        == 401
    )


def test_NFR_SEC_03_admin_ditolak_di_area_anggota(klien_admin):
    assert klien_admin.get(API).status_code == 403


def test_IR_UI_04_password_tidak_terpantul(client, saya):
    r = client.put(f"{API}/password", json={"password_lama": [RAHASIA], "password_baru": RAHASIA})
    assert r.status_code == 422
    assert RAHASIA not in r.text
    r = client.put(f"{API}/password", json={"password_lama": RAHASIA, "password_baru": "x"})
    assert r.status_code == 422
    assert RAHASIA not in r.text

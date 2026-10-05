"""WP 5.3.1 — autentikasi & otorisasi: FR-AKN-05/06/12, NFR-SEC-01/03/04, BR-02, OQ-04/09/16/17."""

import hashlib
import re
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import APIRouter
from fastapi.routing import APIRoute, iter_route_contexts
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import butuh_admin, butuh_anggota, butuh_login
from app.api.v1 import router_admin, router_anggota
from app.core.keamanan import hash_password
from app.models import Sesi
from app.services.autentikasi import NAMA_COOKIE
from tests import pabrik

PASSWORD = "rahasia-123"
T0 = datetime(2026, 10, 1, 1, 0, tzinfo=UTC)  # 08:00 WIB


def _admin(db: Session, **kw):
    return pabrik.admin(db, password_hash=hash_password(PASSWORD), **kw)


def _anggota(db: Session, **kw):
    return pabrik.anggota(db, password_hash=hash_password(PASSWORD), **kw)


def _login(klien: TestClient, email: str, password: str = PASSWORD):
    return klien.post("/api/v1/auth/login", json={"email": email, "password": password})


def _jumlah_sesi(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Sesi))


# --------------------------------------------------------------------------- login (FR-AKN-05)


def test_FR_AKN_05_login_admin_role_admin(client, db):
    akun = _admin(db)
    r = _login(client, akun.email)
    assert r.status_code == 200
    assert r.json() == {"role": "ADMIN", "nama": akun.nama}
    assert client.get("/api/v1/auth/saya").json()["role"] == "ADMIN"


def test_FR_AKN_05_login_anggota_role_anggota(client, db):
    akun = _anggota(db)
    r = _login(client, akun.email)
    assert r.status_code == 200
    assert r.json() == {"role": "ANGGOTA", "nama": akun.nama}
    saya = client.get("/api/v1/auth/saya").json()
    assert saya == {"role": "ANGGOTA", "nama": akun.nama, "email": akun.email}


def test_OQ_09_login_email_tak_peka_huruf_dan_spasi(client, db):
    _admin(db, email="Petugas@Perpus.example")
    assert _login(client, "  petugas@PERPUS.example ").status_code == 200


def test_OQ_16_login_gagal_respons_identik_email_tak_terdaftar_vs_password_salah(client, db):
    admin = _admin(db)
    anggota = _anggota(db)
    tak_terdaftar = _login(client, "tidak.ada@perpus.example")
    salah_admin = _login(client, admin.email, "password-salah")
    salah_anggota = _login(client, anggota.email, "password-salah")
    for r in (tak_terdaftar, salah_admin, salah_anggota):
        assert r.status_code == 401
        assert r.json() == {
            "detail": {
                "kode": "AKN_LOGIN_GAGAL",
                "pesan": "Email atau password salah.",
                "rujukan": "FR-AKN-05",
            }
        }
    assert NAMA_COOKIE not in client.cookies


def test_FR_AKN_05_login_gagal_tidak_membuat_sesi(client, db):
    akun = _admin(db)
    _login(client, akun.email, "password-salah")
    _login(client, "tidak.ada@perpus.example")
    assert _jumlah_sesi(db) == 0


def test_NFR_SEC_01_login_memverifikasi_hash_bukan_teks_asli(client, db):
    # Akun yang (keliru) menyimpan password teks asli tidak bisa login: tidak ada perbandingan teks.
    akun = pabrik.admin(db, password_hash=PASSWORD)
    assert _login(client, akun.email).status_code == 401
    akun.password_hash = hash_password(PASSWORD)
    db.flush()
    assert _login(client, akun.email).status_code == 200


# --------------------------------------------------------------------------- sesi & cookie (OQ-04)


@pytest.mark.parametrize("app_env", ["dev", "staging", "production"])
def test_OQ_04_cookie_httponly_secure_samesite_lax_di_semua_app_env(db, monkeypatch, app_env):
    from app.core.config import get_settings
    from app.db import get_db
    from app.main import create_app

    akun = _admin(db)
    monkeypatch.setenv("APP_ENV", app_env)
    get_settings.cache_clear()
    try:
        app = create_app()
        app.dependency_overrides[get_db] = lambda: db
        with TestClient(app, base_url="https://testserver") as klien:
            r = _login(klien, akun.email)
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()
    cookie = r.headers["set-cookie"]
    assert cookie.startswith(f"{NAMA_COOKIE}=")
    atribut = {a.strip().lower() for a in cookie.split(";")[1:]}
    assert {"httponly", "secure", "samesite=lax", "path=/"} <= atribut


def test_OQ_04_token_disimpan_sebagai_hash(client, db):
    akun = _admin(db)
    _login(client, akun.email)
    token = client.cookies[NAMA_COOKIE]
    sesi = db.scalar(select(Sesi))
    assert sesi.token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert token not in sesi.token_hash
    assert len(token) >= 40  # token_urlsafe(32) ≈ 43 karakter


def test_OQ_04_login_ulang_menghasilkan_token_baru(client, db):
    akun = _admin(db)
    _login(client, akun.email)
    token_lama = client.cookies[NAMA_COOKIE]
    _login(client, akun.email)  # cookie lama ikut terkirim
    token_baru = client.cookies[NAMA_COOKIE]
    assert token_baru != token_lama
    client.cookies.set(NAMA_COOKIE, token_lama)
    assert client.get("/api/v1/auth/saya").status_code == 401


def test_token_palsu_ditolak_401(client, db):
    client.cookies.set(NAMA_COOKIE, "token-karangan")
    r = client.get("/api/v1/auth/saya")
    assert r.status_code == 401
    assert r.json()["detail"]["kode"] == "AKN_BELUM_LOGIN"


def test_tanpa_cookie_ditolak_401(client):
    r = client.get("/api/v1/auth/saya")
    assert r.status_code == 401
    assert r.json()["detail"]["kode"] == "AKN_BELUM_LOGIN"


# ------------------------------------------------------------------------- kedaluwarsa (NFR-SEC-04)


def test_NFR_SEC_04_sesi_masih_aktif_pada_7j59m59d_idle(client, db, atur_waktu):
    akun = _admin(db)
    atur_waktu(T0)
    _login(client, akun.email)
    atur_waktu(T0 + timedelta(hours=8) - timedelta(seconds=1))
    assert client.get("/api/v1/auth/saya").status_code == 200


def test_OQ_17_sesi_berakhir_tepat_8_jam_idle_dan_barisnya_dihapus(client, db, atur_waktu):
    akun = _admin(db)
    atur_waktu(T0)
    _login(client, akun.email)
    atur_waktu(T0 + timedelta(hours=8))
    r = client.get("/api/v1/auth/saya")
    assert r.status_code == 401
    assert r.json()["detail"]["kode"] == "AKN_SESI_KEDALUWARSA"
    assert r.json()["detail"]["rujukan"] == "NFR-SEC-04"
    assert _jumlah_sesi(db) == 0


def test_NFR_SEC_04_aktivitas_menggeser_kedaluwarsa(client, db, atur_waktu):
    akun = _admin(db)
    atur_waktu(T0)
    _login(client, akun.email)
    atur_waktu(T0 + timedelta(hours=7))
    assert client.get("/api/v1/auth/saya").status_code == 200
    atur_waktu(T0 + timedelta(hours=14))  # 14 jam sejak login, 7 jam sejak aktivitas terakhir
    assert client.get("/api/v1/auth/saya").status_code == 200
    atur_waktu(T0 + timedelta(hours=22))
    assert client.get("/api/v1/auth/saya").status_code == 401


def test_NFR_SEC_04_login_membersihkan_sesi_kedaluwarsa(client, db, atur_waktu):
    lama = _anggota(db)
    baru = _admin(db)
    atur_waktu(T0)
    _login(client, lama.email)
    client.cookies.clear()
    _login(client, lama.email)
    client.cookies.clear()
    assert _jumlah_sesi(db) == 2
    atur_waktu(T0 + timedelta(hours=9))
    _login(client, baru.email)
    assert _jumlah_sesi(db) == 1  # hanya sesi baru; tanpa cron


# ------------------------------------------------------------------------- sesi bersamaan & logout


def test_OQ_17_satu_akun_boleh_beberapa_sesi_logout_hanya_perangkat_itu(client, db):
    akun = _admin(db)
    with TestClient(client.app, base_url="https://testserver") as desktop:
        _login(client, akun.email)
        _login(desktop, akun.email)
        assert _jumlah_sesi(db) == 2
        assert client.post("/api/v1/auth/logout").status_code == 204
        assert client.get("/api/v1/auth/saya").status_code == 401
        assert desktop.get("/api/v1/auth/saya").status_code == 200


def test_FR_AKN_06_logout_menghapus_sesi_di_server_dan_token_lama_401(client, db):
    akun = _anggota(db)
    _login(client, akun.email)
    token = client.cookies[NAMA_COOKIE]
    r = client.post("/api/v1/auth/logout")
    assert r.status_code == 204
    assert _jumlah_sesi(db) == 0
    assert NAMA_COOKIE not in client.cookies  # cookie dikosongkan
    client.cookies.set(NAMA_COOKIE, token)  # token dicuri/dipakai ulang
    assert client.get("/api/v1/auth/saya").status_code == 401


def test_FR_AKN_06_logout_tanpa_sesi_204(client):
    assert client.post("/api/v1/auth/logout").status_code == 204


# --------------------------------------------------------------------------- hak akses (NFR-SEC-03)


@pytest.fixture
def klien_rute_uji(db: Session) -> Iterator[TestClient]:
    """Aplikasi + route uji, khusus test. Route ini tidak pernah terdaftar di app.main."""
    from app.db import get_db
    from app.main import create_app

    app = create_app()
    uji = APIRouter()

    @uji.get("/_uji")
    def _rute_uji() -> dict:
        return {"ok": True}

    app.include_router(
        uji, prefix=f"/api/v1{router_admin.prefix}", dependencies=router_admin.dependencies
    )
    app.include_router(
        uji, prefix=f"/api/v1{router_anggota.prefix}", dependencies=router_anggota.dependencies
    )
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app, base_url="https://testserver") as klien:
        yield klien


def test_NFR_SEC_03_endpoint_admin_tanpa_login_401(klien_rute_uji):
    for path in ("/api/v1/admin/_uji", "/api/v1/anggota/_uji"):
        r = klien_rute_uji.get(path)
        assert r.status_code == 401
        assert r.json()["detail"]["kode"] == "AKN_BELUM_LOGIN"


def test_NFR_SEC_03_anggota_ke_endpoint_admin_403(klien_rute_uji, db):
    _login(klien_rute_uji, _anggota(db).email)
    r = klien_rute_uji.get("/api/v1/admin/_uji")
    assert r.status_code == 403
    assert r.json()["detail"] == {
        "kode": "AKN_KHUSUS_ADMIN",
        "pesan": "Halaman ini hanya untuk admin.",
        "rujukan": "NFR-SEC-03",
    }


def test_NFR_SEC_03_admin_ke_endpoint_anggota_403(klien_rute_uji, db):
    _login(klien_rute_uji, _admin(db).email)
    r = klien_rute_uji.get("/api/v1/anggota/_uji")
    assert r.status_code == 403
    assert r.json()["detail"]["kode"] == "AKN_KHUSUS_ANGGOTA"


def test_NFR_SEC_03_role_yang_benar_diterima_200(klien_rute_uji, db):
    _login(klien_rute_uji, _admin(db).email)
    assert klien_rute_uji.get("/api/v1/admin/_uji").status_code == 200
    klien_rute_uji.cookies.clear()
    _login(klien_rute_uji, _anggota(db).email)
    assert klien_rute_uji.get("/api/v1/anggota/_uji").status_code == 200


# Endpoint publik yang sah. Menambah endpoint publik = tambah di sini dengan rujukan SRS.
ROUTE_PUBLIK = {
    ("GET", "/api/v1/health"),
    ("POST", "/api/v1/auth/daftar"),  # FR-AKN-01..04 (UC-05 Pengunjung)
    ("POST", "/api/v1/auth/login"),  # FR-AKN-05
    ("POST", "/api/v1/auth/logout"),  # FR-AKN-06; idempoten
    ("GET", "/api/v1/katalog/judul"),  # BR-01, FR-KTL-01/02/04
    ("GET", "/api/v1/katalog/judul/{judul_id}"),  # BR-01, FR-KTL-03
    ("GET", "/api/v1/katalog/judul/{judul_id}/cover"),  # BR-01, FR-KTL-01 (cover)
    ("GET", "/api/v1/katalog/kategori"),  # BR-01, OQ-43 (daftar kategori beranda)
}


def _dependensi(dependant) -> Iterator:
    for d in dependant.dependencies:
        yield d.call
        yield from _dependensi(d)


def _route_aplikasi_sungguhan() -> list:
    """Semua route API efektif (termasuk dari router yang di-include dan dependency tingkat router).

    `app.routes` tidak bisa dipakai: FastAPI 0.142 menyimpan router yang di-include secara lazy.
    """
    from app.main import create_app

    route = [
        c
        for c in iter_route_contexts(create_app().routes)
        if isinstance(c.original_route, APIRoute)
    ]
    # Penjaga agar audit tidak lolos kosong bila cara enumerasi berubah lagi.
    assert {"/api/v1/auth/login", "/api/v1/auth/saya"} <= {c.path for c in route}
    return route


def test_NFR_SEC_03_semua_route_non_publik_punya_pemeriksaan_auth():
    """Diuji pada aplikasi sungguhan (tanpa route uji): WP berikut yang lupa auth gagal di sini."""
    penjaga = {butuh_login, butuh_admin, butuh_anggota}
    tanpa_auth = []
    for route in _route_aplikasi_sungguhan():
        deps = set(_dependensi(route.dependant))
        for method in route.methods:
            if (method, route.path) in ROUTE_PUBLIK:
                continue
            if not deps & penjaga:
                tanpa_auth.append(f"{method} {route.path}")
            if route.path.startswith("/api/v1/admin/"):
                assert butuh_admin in deps, f"{method} {route.path} tanpa butuh_admin"
            if route.path.startswith("/api/v1/anggota/"):
                assert butuh_anggota in deps, f"{method} {route.path} tanpa butuh_anggota"
    assert tanpa_auth == []
    assert ("GET", "/api/v1/auth/saya") not in ROUTE_PUBLIK


def test_NFR_SEC_03_router_admin_dan_anggota_memasang_penjaga_role():
    assert [d.dependency for d in router_admin.dependencies] == [butuh_admin]
    assert [d.dependency for d in router_anggota.dependencies] == [butuh_anggota]


def test_NFR_SEC_03_tidak_ada_get_yang_mengubah_state_di_auth():
    # SameSite=Lax hanya memblokir POST lintas situs; login/logout wajib POST.
    metode = {(m, r.path) for r in _route_aplikasi_sungguhan() for m in r.methods}
    assert ("GET", "/api/v1/auth/logout") not in metode
    assert ("GET", "/api/v1/auth/login") not in metode


def test_FR_AKN_12_tidak_ada_endpoint_lupa_password_reset_atau_kelola_admin():
    terlarang = re.compile(r"lupa|reset|forgot|recover|/admin/(akun|admin)", re.IGNORECASE)
    path = [r.path for r in _route_aplikasi_sungguhan()]
    assert [p for p in path if terlarang.search(p)] == []

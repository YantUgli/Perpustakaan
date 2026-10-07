"""WP 5.3.4 — anggota oleh admin: FR-AKN-10, FR-AKN-11, K-03, K-05, K-06, OQ-32, OQ-33.

Menutup FR-PJM-01 & FR-HLR-01: cari → `kode` → identifikasi peminjaman / hilang-rusak.
"""

import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.core.keamanan import hash_password, verifikasi_password
from app.models import Anggota, Sesi
from app.services import autentikasi
from tests import pabrik

API = "/api/v1/admin/anggota"
PASSWORD = "rahasia-123"
PESAN_TIDAK_BOLEH = "Isian ini tidak dikenal atau tidak dapat diubah."
_nik = iter(range(8_200_000_000_000_000, 8_300_000_000_000_000))


def _anggota(db: Session, **kw) -> Anggota:
    data = {
        "email": f"agt{uuid.uuid4().hex[:10]}@perpus.example",
        "nik": str(next(_nik)),
        "password_hash": hash_password(PASSWORD),
    }
    return pabrik.anggota(db, **(data | kw))


def _token() -> str:
    return f"Tk{uuid.uuid4().hex[:8]}"


def _cari(klien, q: str | None = None, **params) -> dict:
    r = klien.get(API, params=({"q": q} if q is not None else {}) | params)
    assert r.status_code == 200, r.text
    return r.json()


def _kode(hasil: dict) -> list[str]:
    return [x["kode"] for x in hasil["data"]]


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


# --------------------------------------------------------------------------- cari (FR-AKN-10)


def test_FR_AKN_10_OQ_33_cari_berdasarkan_id_nik_nama(klien_admin, db: Session):
    t = _token()
    x = _anggota(db, nama=f"Siti Aminah {t} Rahmawati")
    _anggota(db, nama=f"Budi {t}")

    assert _kode(_cari(klien_admin, f"  {x.kode.lower()} ")) == [x.kode]  # ID persis (normalisasi)
    assert _kode(_cari(klien_admin, f" {x.nik} ")) == [x.kode]  # NIK persis
    assert _kode(_cari(klien_admin, f"AMINAH {t.upper()}")) == [
        x.kode
    ]  # nama sebagian, tak peka huruf


def test_FR_AKN_10_OQ_33_id_dan_nik_sebagian_tidak_cocok(klien_admin, db: Session):
    x = _anggota(db, nama=f"Nama {_token()}")
    assert x.kode not in _kode(_cari(klien_admin, x.nik[:10], per_halaman=100))
    assert x.kode not in _kode(_cari(klien_admin, x.kode[:7], per_halaman=100))


def test_FR_AKN_10_hasil_memuat_data_tanpa_rahasia(klien_admin, db: Session):
    x = _anggota(db, nama=f"Lengkap {_token()}")
    (item,) = _cari(klien_admin, x.kode)["data"]
    assert item == {
        "kode": x.kode,
        "nama": x.nama,
        "alamat": x.alamat,
        "email": x.email,
        "telepon": x.telepon,
        "nik": x.nik,
        "tanggal_daftar": x.tanggal_daftar.isoformat(),
        "ada_foto": False,  # OQ-42: penanda saja
    }  # tanpa password_hash / foto_path


def test_FR_AKN_10_urut_nama_dan_pagination(klien_admin, db: Session):
    t = _token()
    for nama in ("delta", "Alfa", "charlie", "Bravo"):
        _anggota(db, nama=f"{nama} {t}")
    h1 = _cari(klien_admin, t, halaman=1, per_halaman=3)
    h2 = _cari(klien_admin, t, halaman=2, per_halaman=3)
    assert (h1["total"], h1["halaman"], h1["per_halaman"]) == (4, 1, 3)
    assert [x["nama"].split()[0] for x in h1["data"] + h2["data"]] == [
        "Alfa",
        "Bravo",
        "charlie",
        "delta",
    ]


def test_FR_AKN_10_tanpa_q_semua_anggota(klien_admin, db: Session):
    _anggota(db)
    total = db.scalar(select(func.count()).select_from(Anggota))
    assert _cari(klien_admin)["total"] == total
    assert _cari(klien_admin, "   ")["total"] == total


def test_FR_AKN_10_wildcard_literal(klien_admin, db: Session):
    t = _token()
    cocok = _anggota(db, nama=f"Persen%Aneh {t}")
    _anggota(db, nama=f"PersenXAneh {t}")
    assert _kode(_cari(klien_admin, f"persen%aneh {t}")) == [cocok.kode]


def test_FR_AKN_10_FR_PJM_01_FR_HLR_01_cari_lalu_identifikasi(klien_admin, db: Session):
    """Penutup FR-PJM-01 & FR-HLR-01: pencarian manual (nama) → kode → identifikasi."""
    t = _token()
    x = _anggota(db, nama=f"Peminjam {t}")
    (kode,) = _kode(_cari(klien_admin, f"peminjam {t}"))

    r = klien_admin.get(f"/api/v1/admin/peminjaman/anggota/{kode}")
    assert r.status_code == 200, r.text
    assert (r.json()["kode"], r.json()["nama"]) == (x.kode, x.nama)

    r = klien_admin.get(f"/api/v1/admin/hilang-rusak/anggota/{kode}")
    assert r.status_code == 200, r.text
    assert r.json()["anggota"] == {"kode": x.kode, "nama": x.nama}


def test_FR_AKN_10_detail_dan_404(klien_admin, db: Session):
    x = _anggota(db)
    r = klien_admin.get(f"{API}/{x.kode.lower()}")
    assert r.status_code == 200 and r.json()["kode"] == x.kode
    d = _galat(klien_admin.get(f"{API}/AGT-999999"), 404, "AKN_ANGGOTA_TIDAK_ADA")
    assert d["rujukan"] == "FR-AKN-10"
    assert "AGT-999999" in d["pesan"]


# --------------------------------------------------------------------------- ubah (FR-AKN-11)


def test_FR_AKN_11_admin_ubah_data(klien_admin, db: Session):
    x = _anggota(db)
    autentikasi.login(db, email=x.email, password=PASSWORD)
    baru = f"baru{uuid.uuid4().hex[:8]}@perpus.example"
    r = klien_admin.put(
        f"{API}/{x.kode}",
        json={"nama": " Nama Baru ", "alamat": "Alamat Baru", "email": baru, "telepon": "0812"},
    )
    assert r.status_code == 200, r.text
    a = _segar(db, x)
    assert (a.nama, a.alamat, a.email, a.telepon, a.nik) == (
        "Nama Baru",
        "Alamat Baru",
        baru,
        "0812",
        x.nik,
    )
    assert verifikasi_password(PASSWORD, a.password_hash)  # tanpa password_baru → tetap
    assert _jumlah_sesi(db, x) == 1  # OQ-32: tanpa password_baru tidak mencabut sesi


@pytest.mark.parametrize("isian", ["nik", "foto", "kode", "password_lama"])
def test_FR_AKN_11_K_05_nik_foto_tidak_bisa_diubah(klien_admin, db: Session, isian):
    x = _anggota(db)
    nilai = {"nik": "1" * 16}
    d = _galat(
        klien_admin.put(
            f"{API}/{x.kode}", json=_body(x, nama="Diubah") | {isian: nilai.get(isian, "x")}
        ),
        422,
        "VALIDASI_ISIAN",
    )
    assert d["isian"] == {isian: PESAN_TIDAK_BOLEH}
    assert (_segar(db, x).nama, _segar(db, x).nik) == (x.nama, x.nik)


def test_FR_AKN_11_K_06_email_duplikat_ditolak(klien_admin, db: Session):
    x, lain = _anggota(db), _anggota(db)
    admin_lain = pabrik.admin(db, email=f"adm{uuid.uuid4().hex[:8]}@perpus.example")
    d1 = _galat(
        klien_admin.put(f"{API}/{x.kode}", json=_body(x, email=lain.email.upper())),
        409,
        "AKN_DATA_DUPLIKAT",
    )
    d2 = _galat(
        klien_admin.put(f"{API}/{x.kode}", json=_body(x, email=admin_lain.email)),
        409,
        "AKN_DATA_DUPLIKAT",
    )
    assert d1 == d2 and d1["isian"] == {"email": "Email sudah terdaftar."}
    assert d1["rujukan"] == "FR-AKN-08"
    assert (
        klien_admin.put(f"{API}/{x.kode}", json=_body(x, email=x.email.upper())).status_code == 200
    )


def test_FR_AKN_11_isian_wajib_ditolak(klien_admin, db: Session):
    x = _anggota(db)
    d = _galat(
        klien_admin.put(f"{API}/{x.kode}", json=_body(x, alamat="")), 422, "AKN_ISIAN_TIDAK_VALID"
    )
    assert d["isian"] == {"alamat": "Alamat wajib diisi."}
    assert "FR-AKN-11" in d["rujukan"]


def test_FR_AKN_11_K_03_OQ_32_set_password_baru_mencabut_semua_sesi(
    client, klien_admin, db: Session
):
    x = _anggota(db)
    token_x, _ = autentikasi.login(db, email=x.email, password=PASSWORD)
    autentikasi.login(db, email=x.email, password=PASSWORD)
    assert _jumlah_sesi(db, x) == 2

    r = klien_admin.put(f"{API}/{x.kode}", json=_body(x) | {"password_baru": "lupa-baru-123"})
    assert r.status_code == 200, r.text
    assert _jumlah_sesi(db, x) == 0  # semua sesi anggota dicabut
    with pytest.raises(GalatBisnis):
        autentikasi.pengguna_dari_token(db, token_x)
    assert klien_admin.get(API).status_code == 200  # sesi admin tak tersentuh

    h = _segar(db, x).password_hash
    assert h.startswith("$argon2id$") and verifikasi_password("lupa-baru-123", h)
    assert not verifikasi_password(PASSWORD, h)


def test_FR_AKN_11_NFR_SEC_02_password_baru_pendek_ditolak_tanpa_perubahan(
    klien_admin, db: Session
):
    x = _anggota(db)
    autentikasi.login(db, email=x.email, password=PASSWORD)
    d = _galat(
        klien_admin.put(f"{API}/{x.kode}", json=_body(x) | {"password_baru": "1234567"}),
        422,
        "AKN_ISIAN_TIDAK_VALID",
    )
    assert d["isian"] == {"password_baru": "Password baru minimal 8 karakter."}
    assert "NFR-SEC-02" in d["rujukan"]
    assert verifikasi_password(PASSWORD, _segar(db, x).password_hash)
    assert _jumlah_sesi(db, x) == 1


def test_FR_AKN_11_kode_tidak_ada_404(klien_admin, db: Session):
    x = _anggota(db)
    d = _galat(klien_admin.put(f"{API}/AGT-999999", json=_body(x)), 404, "AKN_ANGGOTA_TIDAK_ADA")
    assert d["rujukan"] == "FR-AKN-11"


def test_BR_02_NFR_SEC_03_endpoint_admin_anggota_hanya_admin(client, db: Session):
    x = _anggota(db)
    assert client.get(API).status_code == 401
    r = client.post("/api/v1/auth/login", json={"email": x.email, "password": PASSWORD})
    assert r.status_code == 200
    assert client.get(API).status_code == 403
    assert client.get(f"{API}/{x.kode}").status_code == 403
    assert client.put(f"{API}/{x.kode}", json=_body(x)).status_code == 403

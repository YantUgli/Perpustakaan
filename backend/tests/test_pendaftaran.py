"""WP 5.3.3 — pendaftaran anggota: FR-AKN-01..04, BR-03, BR-04, NFR-SEC-01/02/06, OQ-02/03/09/30/31.

Email test memakai domain `.example` (domain special-use seperti `.test` ditolak, decisions.md §B).
"""

import io
import itertools
import re
import uuid
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from PIL import Image
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.core.keamanan import verifikasi_password
from app.models import Anggota
from app.services import pendaftaran
from app.services.berkas import UKURAN_MAKS_GAMBAR
from tests import pabrik

API = "/api/v1/auth/daftar"
ISIAN_TEKS = ("nama", "alamat", "email", "telepon", "nik")
_nik = itertools.count(7_100_000_000_000_000)


def _data(**ubah) -> dict[str, str]:
    data = {
        "nama": "Dewi Lestari",
        "alamat": "Jl. Merdeka No. 1, Bandung",
        "email": f"agt{uuid.uuid4().hex[:10]}@perpus.example",
        "telepon": "081234567890",
        "nik": str(next(_nik)),
        "password": "rahasia-123",
    }
    return data | ubah


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (10, 20, 30)).save(buf, format="PNG")
    return buf.getvalue()


def _daftar(client, data: dict | None = None, foto: bytes | None = None):
    files = {"foto": ("foto.png", foto, "image/png")} if foto is not None else None
    return client.post(API, data=data if data is not None else _data(), files=files)


def _galat(r, status: int, kode: str) -> dict:
    assert r.status_code == status, r.text
    d = r.json()["detail"]
    assert d["kode"] == kode
    return d


def _berkas(folder: Path) -> list[Path]:
    return sorted(p for p in folder.rglob("*") if p.is_file())


def _ada_akun(db: Session, email: str) -> bool:
    db.expire_all()
    return bool(db.scalar(select(func.count()).where(func.lower(Anggota.email) == email.lower())))


# --------------------------------------------------------------------------- berhasil


def test_FR_AKN_04_BR_03_daftar_sukses_langsung_aktif_bisa_login(client, db: Session, atur_waktu):
    atur_waktu(datetime(2026, 11, 15, 17, 30, tzinfo=UTC))  # 16/11 00:30 WIB
    data = _data(nama="  Sri Wulandari  ")
    r = _daftar(client, data)
    assert r.status_code == 201, r.text
    body = r.json()
    assert set(body) == {"kode", "nama", "email", "isi_qr"}  # tanpa NIK, foto, hash
    assert re.fullmatch(r"AGT-\d{6}", body["kode"])
    assert body["isi_qr"] == body["kode"]  # FR-AKN-04: QR memuat ID
    assert (body["nama"], body["email"]) == ("Sri Wulandari", data["email"])

    a = db.scalar(select(Anggota).where(Anggota.kode == body["kode"]))
    assert (a.nik, a.tanggal_daftar, a.foto_path) == (data["nik"], date(2026, 11, 16), None)
    assert a.password_hash != data["password"]
    assert a.password_hash.startswith("$argon2id$")  # NFR-SEC-01
    assert verifikasi_password(data["password"], a.password_hash)

    # BR-03: langsung aktif → bisa login tanpa tindakan admin; OQ-30: daftar tidak membuat sesi
    assert "sesi_perpus" not in r.cookies
    masuk = client.post(
        "/api/v1/auth/login", json={"email": data["email"], "password": data["password"]}
    )
    assert masuk.status_code == 200
    assert masuk.json()["role"] == "ANGGOTA"


def test_FR_AKN_04_BR_04_dua_pendaftar_kode_unik_berurutan(client):
    k1 = _daftar(client).json()["kode"]
    k2 = _daftar(client).json()["kode"]
    assert int(k2[4:]) == int(k1[4:]) + 1


def test_FR_AKN_01_NFR_SEC_06_foto_opsional_tersimpan(client, db: Session, penyimpanan_sementara):
    r = _daftar(client, foto=_png())
    assert r.status_code == 201, r.text
    a = db.scalar(select(Anggota).where(Anggota.kode == r.json()["kode"]))
    assert a.foto_path.startswith("foto/") and a.foto_path.endswith(".png")
    assert (penyimpanan_sementara / a.foto_path).read_bytes() == _png()


def test_FR_AKN_03_nik_dan_teks_di_trim_password_tidak(client, db: Session):
    data = _data(password="  ada spasi  ")
    data["nik"] = f"  {data['nik']}  "
    r = _daftar(client, data)
    assert r.status_code == 201, r.text
    a = db.scalar(select(Anggota).where(Anggota.kode == r.json()["kode"]))
    assert a.nik == data["nik"].strip()
    assert verifikasi_password("  ada spasi  ", a.password_hash)
    assert not verifikasi_password("ada spasi", a.password_hash)


def test_OQ_31_telepon_tanpa_validasi_format(client):
    assert _daftar(client, _data(telepon="(022) 123-456 ext. 7")).status_code == 201


# --------------------------------------------------------------------------- validasi isian


@pytest.mark.parametrize(
    ("isian", "nilai"),
    [*((i, v) for i in ISIAN_TEKS for v in ("", "   ")), ("password", "")],
)
def test_FR_AKN_01_isian_wajib_kosong_disebut_per_isian(client, db: Session, isian, nilai):
    data = _data(**{isian: nilai})
    d = _galat(_daftar(client, data), 422, "AKN_ISIAN_TIDAK_VALID")
    assert set(d["isian"]) == {isian}
    assert "wajib diisi" in d["isian"][isian]
    assert "FR-AKN-01" in d["rujukan"]


def test_FR_AKN_01_semua_isian_hilang_semua_disebut(client):
    d = _galat(client.post(API, data={}), 422, "AKN_ISIAN_TIDAK_VALID")
    assert set(d["isian"]) == {*ISIAN_TEKS, "password"}
    for nama in ("Nama", "Alamat", "Email", "Telepon", "NIK", "Password"):
        assert nama in d["pesan"]


@pytest.mark.parametrize(
    "nik",
    [
        "123456789012345",  # 15 digit
        "12345678901234567",  # 17 digit
        "12345678901234ab",  # huruf
        "1234 5678 9012 3456",  # spasi di tengah
        "１２３４５６７８９０１２３４５６",  # angka lebar penuh (bukan 0-9 ASCII)
    ],
)
def test_FR_AKN_03_nik_bukan_16_digit_ditolak(client, db: Session, nik):
    data = _data(nik=nik)
    d = _galat(_daftar(client, data), 422, "AKN_ISIAN_TIDAK_VALID")
    assert d["isian"] == {"nik": "NIK harus tepat 16 digit angka."}
    assert "FR-AKN-03" in d["rujukan"]
    assert not _ada_akun(db, data["email"])


@pytest.mark.parametrize("email", ["bukan-email", "a@b", "nama@perpus.test", "dua@@x.example"])
def test_FR_AKN_03_email_format_tidak_valid_ditolak(client, email):
    d = _galat(_daftar(client, _data(email=email)), 422, "AKN_ISIAN_TIDAK_VALID")
    assert d["isian"] == {"email": "Format email tidak valid."}
    assert "FR-AKN-03" in d["rujukan"]


def test_NFR_SEC_02_password_kurang_dari_8_ditolak_8_diterima(client):
    d = _galat(_daftar(client, _data(password="1234567")), 422, "AKN_ISIAN_TIDAK_VALID")
    assert d["isian"] == {"password": "Password minimal 8 karakter."}
    assert "NFR-SEC-02" in d["rujukan"]
    assert _daftar(client, _data(password="12345678")).status_code == 201


def test_IR_UI_04_beberapa_galat_dikumpulkan_sekaligus(client):
    data = _data(nik="123", email="x", password="pendek", nama="")
    d = _galat(_daftar(client, data), 422, "AKN_ISIAN_TIDAK_VALID")
    assert set(d["isian"]) == {"nik", "email", "password", "nama"}


# --------------------------------------------------------------------------- duplikat (FR-AKN-02)


def test_FR_AKN_02_nik_duplikat_menyebut_nik(client):
    pertama = _data()
    assert _daftar(client, pertama).status_code == 201
    d = _galat(_daftar(client, _data(nik=pertama["nik"])), 409, "AKN_DATA_DUPLIKAT")
    assert d["isian"] == {"nik": "NIK sudah terdaftar."}
    assert d["rujukan"] == "FR-AKN-02"
    assert "NIK" in d["pesan"]


def test_FR_AKN_02_OQ_09_email_duplikat_tak_peka_huruf_menyebut_email(client):
    pertama = _data()
    assert _daftar(client, pertama).status_code == 201
    variasi = f"  {pertama['email'].upper()}  "
    d = _galat(_daftar(client, _data(email=variasi)), 409, "AKN_DATA_DUPLIKAT")
    assert d["isian"] == {"email": "Email sudah terdaftar."}
    assert "email" in d["pesan"].lower()


def test_FR_AKN_02_OQ_02_email_admin_ditolak_dengan_pesan_identik(client, db: Session):
    admin = pabrik.admin(db, email=f"admin{uuid.uuid4().hex[:8]}@perpus.example")
    pertama = _data()
    assert _daftar(client, pertama).status_code == 201

    d_admin = _galat(_daftar(client, _data(email=admin.email)), 409, "AKN_DATA_DUPLIKAT")
    d_agt = _galat(_daftar(client, _data(email=pertama["email"])), 409, "AKN_DATA_DUPLIKAT")
    assert d_admin == d_agt  # tidak membocorkan bahwa email milik admin (sejalan OQ-16)
    assert "admin" not in str(d_admin).lower()


def test_FR_AKN_02_OQ_02_OQ_09_email_admin_beda_huruf_ditolak(client, db: Session):
    """Lintas tabel hanya dijaga service (tak ada constraint DB admin↔anggota), jadi normalisasi
    huruf di service wajib — tidak bisa mengandalkan unique index."""
    admin = pabrik.admin(db, email=f"Admin{uuid.uuid4().hex[:8]}@Perpus.Example")
    data = _data(email=f"  {admin.email.swapcase()}  ")
    d = _galat(_daftar(client, data), 409, "AKN_DATA_DUPLIKAT")
    assert d["isian"] == {"email": "Email sudah terdaftar."}
    assert not _ada_akun(db, admin.email)


def test_FR_AKN_02_nik_dan_email_duplikat_keduanya_disebut(client):
    pertama = _data()
    assert _daftar(client, pertama).status_code == 201
    d = _galat(
        _daftar(client, _data(nik=pertama["nik"], email=pertama["email"])),
        409,
        "AKN_DATA_DUPLIKAT",
    )
    assert d["isian"] == {"nik": "NIK sudah terdaftar.", "email": "Email sudah terdaftar."}
    assert "NIK" in d["pesan"] and "email" in d["pesan"]


def test_FR_AKN_02_galat_isian_didahulukan_dari_duplikat(client):
    pertama = _data()
    assert _daftar(client, pertama).status_code == 201
    d = _galat(
        _daftar(client, _data(nik=pertama["nik"], password="x")), 422, "AKN_ISIAN_TIDAK_VALID"
    )
    assert set(d["isian"]) == {"password"}


@pytest.mark.parametrize("isian", ["nik", "email"])
def test_FR_AKN_02_balapan_integrity_error_diterjemahkan(db: Session, monkeypatch, isian):
    lama = pabrik.anggota(db, email=f"lama{uuid.uuid4().hex[:8]}@perpus.example")
    db.commit()  # setup ter-commit: rollback service tidak membuangnya
    monkeypatch.setattr(pendaftaran, "_cari_duplikat", lambda *a, **k: {})  # cek awal "lolos"
    data = _data(**{isian: lama.nik if isian == "nik" else lama.email.upper()})
    with pytest.raises(GalatBisnis) as info:
        pendaftaran.daftar(db, foto=None, **data)
    g = info.value
    assert (g.kode, g.status_code) == ("AKN_DATA_DUPLIKAT", 409)
    assert set(g.isian) == {isian}
    assert "uq_anggota" not in g.pesan  # pesan mentah PostgreSQL tidak bocor


# --------------------------------------------------------------------------- foto (NFR-SEC-06)


_FOTO_TIDAK_SAH = {  # id pendek: byte 2 MB sebagai id test membuat path tmp terlalu panjang
    "bukan_gambar": (lambda: b"bukan gambar sama sekali", "Foto harus berupa gambar JPG atau PNG."),
    "lebih_2mb": (
        lambda: b"\x89PNG\r\n\x1a\n" + b"\0" * UKURAN_MAKS_GAMBAR,
        "Ukuran berkas melebihi batas 2 MB.",
    ),
}


@pytest.mark.parametrize("jenis", list(_FOTO_TIDAK_SAH))
def test_NFR_SEC_06_foto_tidak_sah_ditolak_tanpa_akun_dan_berkas(
    client, db: Session, penyimpanan_sementara, jenis
):
    buat, pesan = _FOTO_TIDAK_SAH[jenis]
    isi = buat()
    data = _data()
    d = _galat(_daftar(client, data, foto=isi), 422, "AKN_ISIAN_TIDAK_VALID")
    assert d["isian"] == {"foto": pesan}
    assert "NFR-SEC-06" in d["rujukan"]
    assert not _ada_akun(db, data["email"])
    assert _berkas(penyimpanan_sementara) == []


def test_NFR_SEC_06_foto_sah_tidak_disimpan_bila_isian_lain_salah_atau_duplikat(
    client, penyimpanan_sementara
):
    _galat(_daftar(client, _data(nik="1"), foto=_png()), 422, "AKN_ISIAN_TIDAK_VALID")
    pertama = _data()
    assert _daftar(client, pertama).status_code == 201
    _galat(_daftar(client, _data(nik=pertama["nik"]), foto=_png()), 409, "AKN_DATA_DUPLIKAT")
    assert _berkas(penyimpanan_sementara) == []


def test_NFR_SEC_06_OQ_42_foto_anggota_hanya_lewat_route_pemilik_dan_admin():
    """Sebelum OQ-42 foto tidak disajikan; kini hanya untuk pemilik & admin, tidak publik.
    OQ-48: hanya anggota yang dapat mengganti fotonya sendiri."""
    from tests.test_autentikasi import ROUTE_PUBLIK, _route_aplikasi_sungguhan

    route_foto = {
        (m, r.path)
        for r in _route_aplikasi_sungguhan()
        for m in r.methods
        if "foto" in r.path.lower()
    }
    assert route_foto == {
        ("GET", "/api/v1/anggota/profil/foto"),  # router_anggota, identitas dari sesi
        ("PUT", "/api/v1/anggota/profil/foto"),  # OQ-48: anggota mengganti foto sendiri
        ("GET", "/api/v1/admin/anggota/{kode}/foto"),  # router_admin, hanya baca (FR-AKN-11)
    }
    assert not route_foto & ROUTE_PUBLIK


# --------------------------------------------------------------------------- keandalan


def test_NFR_REL_01_commit_gagal_berkas_foto_dibuang(
    db: Session, monkeypatch, penyimpanan_sementara
):
    class GagalDisengaja(Exception):
        pass

    def gagal():
        raise GagalDisengaja

    monkeypatch.setattr(db, "commit", gagal)
    data = _data()
    with pytest.raises(GagalDisengaja):
        pendaftaran.daftar(db, foto=io.BytesIO(_png()), **data)
    assert _berkas(penyimpanan_sementara) == []
    monkeypatch.undo()
    assert not _ada_akun(db, data["email"])


@pytest.fixture
def sequence_anggota_habis(engine):
    """Sequence tidak transaksional → selalu dipulihkan di teardown (pola 5.3.6)."""
    with engine.begin() as k:
        semula = k.execute(text("SELECT last_value, is_called FROM seq_kode_anggota")).one()
        k.execute(text("SELECT setval('seq_kode_anggota', 999999, true)"))
    try:
        yield
    finally:
        with engine.begin() as k:
            k.execute(
                text("SELECT setval('seq_kode_anggota', :v, :c)"),
                {"v": semula.last_value, "c": semula.is_called},
            )


def test_OQ_03_kode_anggota_habis_409(
    client, db: Session, sequence_anggota_habis, penyimpanan_sementara
):
    data = _data()
    d = _galat(_daftar(client, data, foto=_png()), 409, "AKN_KODE_ANGGOTA_HABIS")
    assert d["rujukan"] == "FR-AKN-04"
    assert "AGT-999999" in d["pesan"]
    assert not _ada_akun(db, data["email"])
    assert _berkas(penyimpanan_sementara) == []

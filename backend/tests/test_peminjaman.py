"""WP 5.3.8 — peminjaman: FR-PJM-01..13, BR-07..11, BR-18, FR-DND-06, NFR-REL-01, NFR-PRF-02.

"Hari ini" dipatok 15/11/2026 WIB. Konkurensi (NFR-REL-02) ada di test_peminjaman_konkurensi.py.
"""

import re
import time
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.core.keamanan import hash_password
from app.models import Admin, Anggota, Eksemplar, ItemTransaksi, TransaksiPeminjaman
from app.services import peminjaman
from tests import pabrik

HARI_INI = date(2026, 11, 15)
API = "/api/v1/admin/peminjaman"


@pytest.fixture(autouse=True)
def _jam(atur_waktu):
    atur_waktu(datetime(2026, 11, 15, 3, 0, tzinfo=UTC))  # 10:00 WIB


# --------------------------------------------------------------------------- pembuat data


def _eksemplar(db: Session, *, judul: str = "Buku Uji", status: str = "TERSEDIA") -> Eksemplar:
    j = pabrik.judul(db, judul=judul)
    return pabrik.eksemplar(db, judul_buku_id=j.id, status=status)


_EKSEMPLAR_DARI_ITEM = {
    "DIPINJAM": "DIPINJAM",
    "DIKEMBALIKAN": "TERSEDIA",
    "HILANG": "HILANG",
    "RUSAK": "RUSAK",
}


def _pinjaman(
    db: Session,
    anggota: Anggota,
    *,
    judul: str = "Buku Pinjaman",
    terlambat: int = -10,
    status_item: str = "DIPINJAM",
) -> ItemTransaksi:
    """Item milik `anggota`; `terlambat` = hari_ini − jatuh_tempo (negatif = belum jatuh tempo)."""
    jatuh_tempo = HARI_INI - timedelta(days=terlambat)
    tanggal_pinjam = jatuh_tempo - timedelta(days=30)
    e = _eksemplar(db, judul=judul, status=_EKSEMPLAR_DARI_ITEM[status_item])
    trx = pabrik.transaksi(db, anggota_id=anggota.id, tanggal_transaksi=tanggal_pinjam)
    data = {
        "transaksi_id": trx.id,
        "eksemplar_id": e.id,
        "tanggal_pinjam": tanggal_pinjam,
        "jatuh_tempo": jatuh_tempo,
        "status": status_item,
    }
    if status_item == "DIKEMBALIKAN":
        data["tanggal_kembali"] = tanggal_pinjam + timedelta(days=1)
    if status_item in ("HILANG", "RUSAK"):
        data |= {
            "tanggal_kejadian": tanggal_pinjam + timedelta(days=1),
            "keterangan": "Laporan lisan",
            "admin_pencatat_id": pabrik.admin(db).id,
        }
    return pabrik.item(db, **data)


def _tagihan(db: Session, anggota: Anggota, nominal: int, *, lunas: bool = False) -> None:
    item = _pinjaman(db, anggota, status_item="DIKEMBALIKAN")
    data = {"item_transaksi_id": item.id, "nominal": nominal, "status": "BELUM_LUNAS"}
    if lunas:
        data |= {
            "status": "LUNAS",
            "cara_penyelesaian": "TUNAI",
            "nominal_dibayar": nominal,
            "tanggal_penyelesaian": HARI_INI,
            "admin_pengonfirmasi_id": pabrik.admin(db).id,
        }
    pabrik.simpan(db, pabrik.tagihan_baru(db, **data))


def _galat(fungsi, *args, **kwargs) -> GalatBisnis:
    with pytest.raises(GalatBisnis) as info:
        fungsi(*args, **kwargs)
    return info.value


def _konfirmasi(db: Session, anggota: Anggota, kode: list[str]) -> peminjaman.HasilPeminjaman:
    return peminjaman.konfirmasi(
        db, anggota_id=anggota.id, kode_eksemplar=kode, admin_id=pabrik.admin(db).id
    )


def _jumlah_transaksi(db: Session, anggota: Anggota) -> int:
    return db.scalar(select(func.count()).where(TransaksiPeminjaman.anggota_id == anggota.id))


def _setup_tercommit(db: Session) -> None:
    """Commit data setup (savepoint fixture; tetap di-rollback di akhir test).

    Wajib sebelum memanggil operasi yang diharapkan gagal: rollback service membuang semua yang
    belum di-commit pada sesi, termasuk data setup — di produksi data itu sudah ter-commit."""
    db.commit()


def _status(db: Session, e: Eksemplar) -> str:
    db.expire_all()
    return db.get(Eksemplar, e.id).status


# ---------------------------------------------------------------------- identifikasi & kelayakan


def test_FR_PJM_01_identifikasi_dari_kode_qr(db: Session):
    a = pabrik.anggota(db, nama="Sri Lestari")
    hasil = peminjaman.identifikasi_anggota(db, a.kode)
    assert (hasil.id, hasil.kode, hasil.nama) == (a.id, a.kode, "Sri Lestari")


def test_FR_PJM_01_kode_diketik_dinormalisasi(db: Session):
    a = pabrik.anggota(db)
    assert peminjaman.identifikasi_anggota(db, f"  {a.kode.lower()} ").id == a.id


def test_FR_PJM_01_kode_tidak_dikenal_404(db: Session):
    g = _galat(peminjaman.identifikasi_anggota, db, "AGT-999999")
    assert (g.kode, g.status_code) == ("PJM_ANGGOTA_TIDAK_ADA", 404)
    assert "AGT-999999" in g.pesan


def test_FR_PJM_02_pinjaman_aktif_menghitung_dipinjam_termasuk_terlambat(db: Session):
    a = pabrik.anggota(db)
    _pinjaman(db, a)  # belum jatuh tempo
    _pinjaman(db, a, status_item="DIKEMBALIKAN")
    _pinjaman(db, a, status_item="HILANG")
    _pinjaman(db, a, status_item="RUSAK")
    hasil = peminjaman.identifikasi_anggota(db, a.kode)
    assert hasil.pinjaman_aktif == 1
    assert hasil.kelayakan == peminjaman.Kelayakan(layak=True, alasan=[])

    _pinjaman(db, a, terlambat=3)  # terlambat tetap pinjaman aktif
    assert peminjaman.jumlah_pinjaman_aktif(db, a.id) == 2


def test_FR_PJM_03_tagihan_belum_lunas_ditolak_dengan_jumlah_dan_total(db: Session):
    a = pabrik.anggota(db)
    _tagihan(db, a, 15_555)
    _tagihan(db, a, 20_000)
    k = peminjaman.kelayakan_anggota(db, a.id)
    assert k.layak is False
    (alasan,) = k.alasan
    assert alasan.rujukan == "FR-PJM-03"
    assert alasan.pesan == "Anggota memiliki 2 tagihan Belum Lunas dengan total Rp35.555."


def test_FR_PJM_03_tagihan_lunas_tidak_memblokir(db: Session):
    a = pabrik.anggota(db)
    _tagihan(db, a, 15_555, lunas=True)
    assert peminjaman.kelayakan_anggota(db, a.id).layak is True


def test_FR_PJM_04_item_terlambat_tanpa_tagihan_ditolak_dengan_judul_dan_hari(db: Session):
    a = pabrik.anggota(db)
    _pinjaman(db, a, judul="Laskar Pelangi", terlambat=5)
    k = peminjaman.kelayakan_anggota(db, a.id)
    assert k.layak is False
    (alasan,) = k.alasan
    assert alasan.rujukan == "FR-PJM-04"
    assert "'Laskar Pelangi' terlambat 5 hari" in alasan.pesan


def test_FR_PJM_04_dua_item_terlambat_semua_disebut(db: Session):
    a = pabrik.anggota(db)
    _pinjaman(db, a, judul="Bumi Manusia", terlambat=12)
    _pinjaman(db, a, judul="Laskar Pelangi", terlambat=1)
    (alasan,) = peminjaman.kelayakan_anggota(db, a.id).alasan
    assert "'Bumi Manusia' terlambat 12 hari" in alasan.pesan
    assert "'Laskar Pelangi' terlambat 1 hari" in alasan.pesan


def test_FR_PJM_04_tepat_jatuh_tempo_masih_layak(db: Session):
    a = pabrik.anggota(db)
    _pinjaman(db, a, terlambat=0)
    assert peminjaman.kelayakan_anggota(db, a.id).layak is True


def test_FR_PJM_04_hilang_rusak_lewat_jatuh_tempo_tidak_memblokir(db: Session):
    a = pabrik.anggota(db)
    _pinjaman(db, a, terlambat=20, status_item="HILANG")
    _pinjaman(db, a, terlambat=20, status_item="RUSAK")
    assert peminjaman.kelayakan_anggota(db, a.id).layak is True


def test_FR_DND_06_terlambat_lewat_plafon_tetap_tidak_layak(db: Session):
    a = pabrik.anggota(db)
    _pinjaman(db, a, judul="Lama Sekali", terlambat=100)  # > 70 hari: denda sudah plafon
    (alasan,) = peminjaman.kelayakan_anggota(db, a.id).alasan
    assert "'Lama Sekali' terlambat 100 hari" in alasan.pesan


def test_BR_18_tagihan_dan_terlambat_kedua_alasan_disebut(db: Session):
    a = pabrik.anggota(db)
    _tagihan(db, a, 10_000)
    _pinjaman(db, a, judul="Ronggeng", terlambat=2)
    k = peminjaman.kelayakan_anggota(db, a.id)
    assert [x.rujukan for x in k.alasan] == ["FR-PJM-03", "FR-PJM-04"]
    g = _galat(_konfirmasi, db, a, [_eksemplar(db).kode])
    assert (g.kode, g.status_code) == ("PJM_TIDAK_LAYAK", 422)
    assert "Rp10.000" in g.pesan and "'Ronggeng' terlambat 2 hari" in g.pesan
    assert "FR-PJM-03" in g.rujukan and "FR-PJM-04" in g.rujukan


def test_FR_PJM_04_K_07_tengah_malam_wib_sudah_terlambat(db: Session, atur_waktu):
    a = pabrik.anggota(db)
    _pinjaman(db, a, terlambat=0)  # jatuh tempo = 15/11
    atur_waktu(datetime(2026, 11, 15, 17, 30, tzinfo=UTC))  # 16/11 00:30 WIB
    (alasan,) = peminjaman.kelayakan_anggota(db, a.id).alasan
    assert "terlambat 1 hari" in alasan.pesan


# --------------------------------------------------------------------------- pindai item


def test_FR_PJM_05_validasi_item_lewat_kode(db: Session):
    a = pabrik.anggota(db)
    e = _eksemplar(db, judul="Negeri 5 Menara")
    hasil = peminjaman.validasi_item(db, anggota_id=a.id, kode_eksemplar=e.kode, keranjang=[])
    assert hasil == peminjaman.ItemValid(eksemplar_id=e.id, kode=e.kode, judul="Negeri 5 Menara")
    assert _status(db, e) == "TERSEDIA"  # validasi tidak mengubah data


def test_FR_PJM_05_kode_eksemplar_diketik_dinormalisasi(db: Session):
    a = pabrik.anggota(db)
    e = _eksemplar(db)
    hasil = peminjaman.validasi_item(
        db, anggota_id=a.id, kode_eksemplar=f" {e.kode.lower()} ", keranjang=[]
    )
    assert hasil.kode == e.kode


def test_FR_PJM_05_kode_eksemplar_tidak_ada_404(db: Session):
    a = pabrik.anggota(db)
    g = _galat(
        peminjaman.validasi_item, db, anggota_id=a.id, kode_eksemplar="EKS-999999", keranjang=[]
    )
    assert (g.kode, g.status_code) == ("PJM_EKSEMPLAR_TIDAK_ADA", 404)
    assert "EKS-999999" in g.pesan


@pytest.mark.parametrize(
    ("status", "label"), [("DIPINJAM", "Dipinjam"), ("HILANG", "Hilang"), ("RUSAK", "Rusak")]
)
def test_FR_PJM_06_status_selain_tersedia_ditolak_menyebut_status(db: Session, status, label):
    a = pabrik.anggota(db)
    e = _eksemplar(db, status=status)
    g = _galat(peminjaman.validasi_item, db, anggota_id=a.id, kode_eksemplar=e.kode, keranjang=[])
    assert (g.kode, g.status_code, g.rujukan) == (
        "PJM_EKSEMPLAR_TIDAK_TERSEDIA",
        409,
        "FR-PJM-06",
    )
    assert f"{e.kode} berstatus {label}" in g.pesan


def test_FR_PJM_07_pindai_ganda_ditolak(db: Session):
    a = pabrik.anggota(db)
    e = _eksemplar(db)
    g = _galat(
        peminjaman.validasi_item, db, anggota_id=a.id, kode_eksemplar=e.kode, keranjang=[e.kode]
    )
    assert (g.kode, g.status_code, g.rujukan) == ("PJM_EKSEMPLAR_GANDA", 409, "FR-PJM-07")
    assert e.kode in g.pesan


def test_FR_PJM_07_ganda_terdeteksi_setelah_normalisasi(db: Session):
    a = pabrik.anggota(db)
    e = _eksemplar(db)
    g = _galat(
        peminjaman.validasi_item,
        db,
        anggota_id=a.id,
        kode_eksemplar=e.kode,
        keranjang=[f" {e.kode.lower()}"],
    )
    assert g.kode == "PJM_EKSEMPLAR_GANDA"
    g2 = _galat(_konfirmasi, db, a, [e.kode, e.kode.lower()])
    assert g2.kode == "PJM_EKSEMPLAR_GANDA"


def test_FR_PJM_08_aktif_2_tambah_ke3_boleh_ke4_ditolak(db: Session):
    a = pabrik.anggota(db)
    _pinjaman(db, a)
    _pinjaman(db, a, terlambat=-1)
    e3, e4 = _eksemplar(db), _eksemplar(db)
    # anggota harus layak agar batas yang diuji, jadi kedua pinjaman belum jatuh tempo
    peminjaman.validasi_item(db, anggota_id=a.id, kode_eksemplar=e3.kode, keranjang=[])
    g = _galat(
        peminjaman.validasi_item, db, anggota_id=a.id, kode_eksemplar=e4.kode, keranjang=[e3.kode]
    )
    assert (g.kode, g.status_code, g.rujukan) == ("PJM_ITEM_MELEBIHI_BATAS", 422, "FR-PJM-08")
    assert g.pesan == (
        "Batas pinjaman 3 eksemplar terlampaui: anggota sedang meminjam 2 eksemplar "
        "dan 2 eksemplar ada di transaksi ini."
    )  # 1 di keranjang + 1 yang dipindai


def test_FR_PJM_08_keranjang_3_item_keempat_ditolak(db: Session):
    a = pabrik.anggota(db)
    keranjang = [_eksemplar(db).kode for _ in range(3)]
    g = _galat(
        peminjaman.validasi_item,
        db,
        anggota_id=a.id,
        kode_eksemplar=_eksemplar(db).kode,
        keranjang=keranjang,
    )
    assert g.kode == "PJM_ITEM_MELEBIHI_BATAS"


def test_FR_PJM_08_hilang_rusak_dikembalikan_tidak_dihitung(db: Session):
    a = pabrik.anggota(db)
    for s in ("HILANG", "RUSAK", "DIKEMBALIKAN"):
        _pinjaman(db, a, status_item=s)
    kode = [_eksemplar(db).kode for _ in range(3)]
    hasil = _konfirmasi(db, a, kode)
    assert len(hasil.item) == 3


def test_FR_PJM_03_04_validasi_item_ditolak_bila_tidak_layak(db: Session):
    a = pabrik.anggota(db)
    _tagihan(db, a, 5_000)
    g = _galat(
        peminjaman.validasi_item,
        db,
        anggota_id=a.id,
        kode_eksemplar=_eksemplar(db).kode,
        keranjang=[],
    )
    assert (g.kode, g.status_code, g.rujukan) == ("PJM_TIDAK_LAYAK", 422, "FR-PJM-03")


# --------------------------------------------------------------------------- konfirmasi


def test_FR_PJM_10_11_12_konfirmasi_sukses(db: Session):
    a = pabrik.anggota(db, nama="Budi Santoso")
    admin = pabrik.admin(db)
    e1, e2 = _eksemplar(db, judul="Atheis"), _eksemplar(db, judul="Burung-Burung Manyar")
    hasil = peminjaman.konfirmasi(
        db, anggota_id=a.id, kode_eksemplar=[e2.kode, e1.kode], admin_id=admin.id
    )

    assert (hasil.anggota_kode, hasil.anggota_nama) == (a.kode, "Budi Santoso")
    assert hasil.tanggal_transaksi == HARI_INI
    assert [(i.kode_eksemplar, i.judul) for i in hasil.item] == [
        (e2.kode, "Burung-Burung Manyar"),
        (e1.kode, "Atheis"),
    ]
    for i in hasil.item:
        assert (i.tanggal_pinjam, i.jatuh_tempo, i.status) == (
            HARI_INI,
            date(2026, 12, 15),
            "DIPINJAM",
        )

    db.expire_all()
    trx = db.get(TransaksiPeminjaman, hasil.id)
    assert (trx.status, trx.admin_id, trx.anggota_id) == ("AKTIF", admin.id, a.id)
    item = db.scalars(select(ItemTransaksi).where(ItemTransaksi.transaksi_id == trx.id)).all()
    assert {i.status for i in item} == {"DIPINJAM"}
    assert {_status(db, e1), _status(db, e2)} == {"DIPINJAM"}
    assert peminjaman.jumlah_pinjaman_aktif(db, a.id) == 2


def test_FR_PJM_11_tanggal_pinjam_wib_lewat_tengah_malam(db: Session, atur_waktu):
    atur_waktu(datetime(2026, 11, 30, 17, 30, tzinfo=UTC))  # 01/12 00:30 WIB
    a = pabrik.anggota(db)
    (i,) = _konfirmasi(db, a, [_eksemplar(db).kode]).item
    assert (i.tanggal_pinjam, i.jatuh_tempo) == (date(2026, 12, 1), date(2026, 12, 31))


def test_FR_PJM_09_hanya_kode_yang_dikirim_dipinjam(db: Session):
    a = pabrik.anggota(db)
    dipinjam, dihapus_dari_keranjang = _eksemplar(db), _eksemplar(db)
    peminjaman.validasi_item(db, anggota_id=a.id, kode_eksemplar=dipinjam.kode, keranjang=[])
    peminjaman.validasi_item(
        db, anggota_id=a.id, kode_eksemplar=dihapus_dari_keranjang.kode, keranjang=[dipinjam.kode]
    )
    hasil = _konfirmasi(db, a, [dipinjam.kode])
    assert [i.kode_eksemplar for i in hasil.item] == [dipinjam.kode]
    assert _status(db, dihapus_dari_keranjang) == "TERSEDIA"


def test_FR_PJM_10_periksa_ulang_status(db: Session):
    a = pabrik.anggota(db)
    baik, berubah = _eksemplar(db), _eksemplar(db)
    for kode in (baik.kode, berubah.kode):
        peminjaman.validasi_item(db, anggota_id=a.id, kode_eksemplar=kode, keranjang=[])
    berubah.status = "RUSAK"  # berubah setelah dipindai (mis. admin lain)
    _setup_tercommit(db)

    g = _galat(_konfirmasi, db, a, [baik.kode, berubah.kode])
    assert (g.kode, g.status_code) == ("PJM_EKSEMPLAR_TIDAK_TERSEDIA", 409)
    assert f"{berubah.kode} berstatus Rusak" in g.pesan
    assert _jumlah_transaksi(db, a) == 0
    assert _status(db, baik) == "TERSEDIA"


def test_FR_PJM_10_periksa_ulang_kelayakan(db: Session):
    a = pabrik.anggota(db)
    e = _eksemplar(db)
    peminjaman.validasi_item(db, anggota_id=a.id, kode_eksemplar=e.kode, keranjang=[])
    _tagihan(db, a, 7_500)  # muncul setelah validasi
    admin = pabrik.admin(db)
    _setup_tercommit(db)
    g = _galat(
        peminjaman.konfirmasi, db, anggota_id=a.id, kode_eksemplar=[e.kode], admin_id=admin.id
    )
    assert (g.kode, g.rujukan) == ("PJM_TIDAK_LAYAK", "FR-PJM-03")
    assert _jumlah_transaksi(db, a) == 1  # hanya transaksi asal tagihan
    assert _status(db, e) == "TERSEDIA"


def test_FR_PJM_08_konfirmasi_lebih_dari_batas_ditolak(db: Session):
    a = pabrik.anggota(db)
    _pinjaman(db, a)
    kode = [_eksemplar(db).kode for _ in range(3)]
    g = _galat(_konfirmasi, db, a, kode)
    assert (g.kode, g.status_code) == ("PJM_ITEM_MELEBIHI_BATAS", 422)


def test_FR_PJM_10_keranjang_kosong_422(db: Session):
    a = pabrik.anggota(db)
    g = _galat(_konfirmasi, db, a, [])
    assert (g.kode, g.status_code) == ("PJM_KERANJANG_KOSONG", 422)


def test_FR_PJM_05_konfirmasi_kode_tidak_ada_tanpa_perubahan(db: Session):
    a = pabrik.anggota(db)
    e = _eksemplar(db)
    admin = pabrik.admin(db)
    _setup_tercommit(db)
    g = _galat(
        peminjaman.konfirmasi,
        db,
        anggota_id=a.id,
        kode_eksemplar=[e.kode, "EKS-999999"],
        admin_id=admin.id,
    )
    assert (g.kode, g.status_code) == ("PJM_EKSEMPLAR_TIDAK_ADA", 404)
    assert _status(db, e) == "TERSEDIA"


def test_FR_PJM_01_konfirmasi_anggota_tidak_ada_404(db: Session):
    g = _galat(
        peminjaman.konfirmasi,
        db,
        anggota_id=999_999_999,
        kode_eksemplar=[_eksemplar(db).kode],
        admin_id=pabrik.admin(db).id,
    )
    assert (g.kode, g.status_code) == ("PJM_ANGGOTA_TIDAK_ADA", 404)


def test_NFR_REL_01_galat_di_tengah_tidak_ada_perubahan(db: Session, monkeypatch):
    a = pabrik.anggota(db)
    e1, e2 = _eksemplar(db), _eksemplar(db)
    asli = peminjaman._pinjamkan
    panggilan = []

    def gagal_di_item_kedua(*args, **kwargs):
        panggilan.append(1)
        if len(panggilan) == 2:
            raise RuntimeError("gagal disengaja")
        return asli(*args, **kwargs)

    monkeypatch.setattr(peminjaman, "_pinjamkan", gagal_di_item_kedua)
    admin = pabrik.admin(db)
    _setup_tercommit(db)
    with pytest.raises(RuntimeError):
        peminjaman.konfirmasi(
            db, anggota_id=a.id, kode_eksemplar=[e1.kode, e2.kode], admin_id=admin.id
        )
    assert len(panggilan) == 2
    assert _jumlah_transaksi(db, a) == 0
    assert {_status(db, e1), _status(db, e2)} == {"TERSEDIA"}
    assert (
        db.scalar(select(func.count()).where(ItemTransaksi.eksemplar_id.in_([e1.id, e2.id]))) == 0
    )


# --------------------------------------------------------------------------- API, akses, performa


@pytest.fixture
def admin_masuk(client, db: Session) -> Admin:
    akun = pabrik.admin(db, password_hash=hash_password("rahasia-123"))
    r = client.post("/api/v1/auth/login", json={"email": akun.email, "password": "rahasia-123"})
    assert r.status_code == 200
    return akun


def test_FR_PJM_alur_api_identifikasi_validasi_konfirmasi(client, db: Session, admin_masuk):
    a = pabrik.anggota(db, nama="Dewi")
    e = _eksemplar(db, judul="Saman")

    r = client.get(f"{API}/anggota/{a.kode.lower()}")
    assert r.status_code == 200
    assert r.json() == {
        "id": a.id,
        "kode": a.kode,
        "nama": "Dewi",
        "pinjaman_aktif": 0,
        "layak": True,
        "alasan": [],
    }  # FR-PJM-02: tanpa NIK/alamat/telepon/email/foto

    r = client.post(
        f"{API}/validasi-item", json={"anggota_id": a.id, "kode_eksemplar": e.kode, "keranjang": []}
    )
    assert r.json() == {"eksemplar_id": e.id, "kode": e.kode, "judul": "Saman"}

    r = client.post(API, json={"anggota_id": a.id, "kode_eksemplar": [e.kode]})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["anggota"] == {"kode": a.kode, "nama": "Dewi"}
    assert body["item"][0]["status"] == "DIPINJAM"
    db.expire_all()
    assert db.get(TransaksiPeminjaman, body["id"]).admin_id == admin_masuk.id


def test_FR_PJM_02_api_tidak_layak_tetap_200_dengan_alasan(client, db: Session, admin_masuk):
    a = pabrik.anggota(db)
    _tagihan(db, a, 12_000)
    body = client.get(f"{API}/anggota/{a.kode}").json()
    assert body["layak"] is False
    assert (
        body["alasan"][0]["pesan"]
        == "Anggota memiliki 1 tagihan Belum Lunas dengan total Rp12.000."
    )


def test_FR_PJM_api_galat_berformat_standar(client, db: Session, admin_masuk):
    a = pabrik.anggota(db)
    e = _eksemplar(db, status="RUSAK")
    r = client.post(
        f"{API}/validasi-item", json={"anggota_id": a.id, "kode_eksemplar": e.kode, "keranjang": []}
    )
    assert r.status_code == 409
    assert r.json()["detail"]["kode"] == "PJM_EKSEMPLAR_TIDAK_TERSEDIA"
    assert r.json()["detail"]["rujukan"] == "FR-PJM-06"


def test_BR_07_anggota_dan_tanpa_login_ditolak(client, db: Session):
    a = pabrik.anggota(db, password_hash=hash_password("rahasia-123"))
    assert client.get(f"{API}/anggota/{a.kode}").status_code == 401
    r = client.post("/api/v1/auth/login", json={"email": a.email, "password": "rahasia-123"})
    assert r.status_code == 200
    assert client.get(f"{API}/anggota/{a.kode}").status_code == 403
    assert client.post(API, json={"anggota_id": a.id, "kode_eksemplar": []}).status_code == 403


def test_FR_PJM_13_tidak_ada_endpoint_perpanjangan():
    from tests.test_autentikasi import _route_aplikasi_sungguhan

    terlarang = re.compile(r"perpanjang|renew|extend|reservasi|booking", re.IGNORECASE)
    assert [r.path for r in _route_aplikasi_sungguhan() if terlarang.search(r.path)] == []


def test_NFR_PRF_02_validasi_item_maks_1_detik(client, db: Session, admin_masuk, capsys):
    a = pabrik.anggota(db)
    _pinjaman(db, a)
    e = _eksemplar(db)
    body = {"anggota_id": a.id, "kode_eksemplar": e.kode, "keranjang": []}
    client.post(f"{API}/validasi-item", json=body)  # pemanasan

    mulai = time.perf_counter()
    r = client.post(f"{API}/validasi-item", json=body)
    durasi = time.perf_counter() - mulai
    assert r.status_code == 200
    with capsys.disabled():
        print(f"\nNFR-PRF-02 validasi-item: {durasi:.3f} dtk")
    assert durasi <= 1.0

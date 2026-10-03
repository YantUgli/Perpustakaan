"""WP 5.3.9 — pengembalian: FR-KMB-01..08, BR-12, BR-18, BR-20, NFR-REL-01, OQ-01, OQ-25.

"Hari ini" dipatok 15/11/2026 WIB. Konkurensi (NFR-REL-02) ada di test_pengembalian_konkurensi.py.
"""

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.galat import GalatBisnis
from app.core.keamanan import hash_password
from app.models import (
    Anggota,
    Eksemplar,
    ItemTransaksi,
    JudulBuku,
    Tagihan,
    TransaksiPeminjaman,
)
from app.services import peminjaman, pengembalian
from tests import pabrik

HARI_INI = date(2026, 11, 15)
API = "/api/v1/admin/pengembalian"


@pytest.fixture(autouse=True)
def _jam(atur_waktu):
    atur_waktu(datetime(2026, 11, 15, 3, 0, tzinfo=UTC))  # 10:00 WIB


# --------------------------------------------------------------------------- pembuat data


def _transaksi(db: Session, anggota: Anggota | None = None) -> TransaksiPeminjaman:
    anggota = anggota or pabrik.anggota(db)
    return pabrik.transaksi(db, anggota_id=anggota.id)


def _dipinjam(
    db: Session,
    trx: TransaksiPeminjaman,
    *,
    terlambat: int = -5,
    harga: int = 100_000,
    judul: str = "Buku Kembali",
) -> tuple[ItemTransaksi, Eksemplar]:
    """Item Dipinjam di `trx`; `terlambat` = hari_ini − jatuh_tempo (negatif = belum lewat)."""
    jatuh_tempo = HARI_INI - timedelta(days=terlambat)
    j = pabrik.judul(db, judul=judul, harga=harga)
    e = pabrik.eksemplar(db, judul_buku_id=j.id, status="DIPINJAM")
    item = pabrik.item(
        db,
        transaksi_id=trx.id,
        eksemplar_id=e.id,
        tanggal_pinjam=jatuh_tempo - timedelta(days=30),
        jatuh_tempo=jatuh_tempo,
        status="DIPINJAM",
    )
    return item, e


def _hilang(db: Session, trx: TransaksiPeminjaman) -> ItemTransaksi:
    """Data setup saja (bukan service 5.3.10): item Hilang + eksemplar Hilang."""
    j = pabrik.judul(db)
    e = pabrik.eksemplar(db, judul_buku_id=j.id, status="HILANG")
    return pabrik.item(
        db,
        transaksi_id=trx.id,
        eksemplar_id=e.id,
        tanggal_pinjam=HARI_INI - timedelta(days=20),
        jatuh_tempo=HARI_INI + timedelta(days=10),
        status="HILANG",
        tanggal_kejadian=HARI_INI - timedelta(days=2),
        keterangan="Laporan lisan",
        admin_pencatat_id=pabrik.admin(db).id,
    )


def _setup_tercommit(db: Session) -> None:
    """Commit data setup sebelum operasi yang diharapkan gagal (rollback service membuang yang
    belum di-commit). Fixture `db` memakai savepoint, jadi tetap di-rollback di akhir test."""
    db.commit()


def _galat(fungsi, *args, **kwargs) -> GalatBisnis:
    with pytest.raises(GalatBisnis) as info:
        fungsi(*args, **kwargs)
    return info.value


def _segar(db: Session, model, id_: int):
    db.expire_all()
    return db.get(model, id_)


def _tagihan_item(db: Session, item: ItemTransaksi) -> list[Tagihan]:
    return list(db.scalars(select(Tagihan).where(Tagihan.item_transaksi_id == item.id)))


# --------------------------------------------------------------------------- pratinjau


def test_FR_KMB_01_02_pratinjau_dari_kode_menampilkan_peminjam_dan_tanggal(db: Session):
    a = pabrik.anggota(db, nama="Wulan Siregar")
    item, e = _dipinjam(db, _transaksi(db, a), terlambat=-3, judul="Cantik Itu Luka")
    p = pengembalian.pratinjau(db, f"  {e.kode.lower()} ")
    assert p == pengembalian.Pratinjau(
        eksemplar=pengembalian.Ringkas(kode=e.kode, nama="Cantik Itu Luka"),
        peminjam=pengembalian.Ringkas(kode=a.kode, nama="Wulan Siregar"),
        tanggal_pinjam=item.tanggal_pinjam,
        jatuh_tempo=HARI_INI + timedelta(days=3),
        hari_terlambat=0,
        denda=0,
    )


def test_FR_KMB_03_eksemplar_tersedia_ditolak_tidak_sedang_dipinjam(db: Session):
    e = pabrik.eksemplar(db)
    g = _galat(pengembalian.pratinjau, db, e.kode)
    assert (g.kode, g.status_code, g.rujukan) == ("KMB_TIDAK_DIPINJAM", 422, "FR-KMB-03")
    assert f"Eksemplar {e.kode} tidak sedang dipinjam" in g.pesan
    assert "Tersedia" in g.pesan


@pytest.mark.parametrize(("status", "label"), [("HILANG", "Hilang"), ("RUSAK", "Rusak")])
def test_FR_KMB_03_hilang_rusak_ditolak_menyebut_status(db: Session, status, label):
    e = pabrik.eksemplar(db, status=status)
    g = _galat(pengembalian.konfirmasi, db, kode_eksemplar=e.kode)
    assert g.kode == "KMB_TIDAK_DIPINJAM"
    assert f"tidak sedang dipinjam (status saat ini: {label})" in g.pesan


def test_FR_KMB_03_kode_tidak_ada_404(db: Session):
    g = _galat(pengembalian.pratinjau, db, "EKS-999999")
    assert (g.kode, g.status_code) == ("KMB_EKSEMPLAR_TIDAK_ADA", 404)
    assert "EKS-999999" in g.pesan


def test_FR_KMB_04_pratinjau_menampilkan_hari_dan_denda_sebelum_konfirmasi(db: Session):
    item, e = _dipinjam(db, _transaksi(db), terlambat=8, harga=100_000)
    p = pengembalian.pratinjau(db, e.kode)
    assert (p.hari_terlambat, p.denda) == (8, 20_000)
    # pratinjau tidak mengubah data
    assert _segar(db, ItemTransaksi, item.id).status == "DIPINJAM"
    assert _segar(db, Eksemplar, e.id).status == "DIPINJAM"
    assert _tagihan_item(db, item) == []


def test_FR_KMB_04_pratinjau_tepat_waktu_denda_0(db: Session):
    _, e = _dipinjam(db, _transaksi(db), terlambat=0)
    p = pengembalian.pratinjau(db, e.kode)
    assert (p.hari_terlambat, p.denda) == (0, 0)


# --------------------------------------------------------------------------- konfirmasi


def test_FR_KMB_05_tepat_waktu_dikembalikan_tanpa_tagihan(db: Session):
    item, e = _dipinjam(db, _transaksi(db), terlambat=0)
    h = pengembalian.konfirmasi(db, kode_eksemplar=e.kode)
    assert (h.tanggal_kembali, h.hari_terlambat, h.tagihan) == (HARI_INI, 0, None)
    i = _segar(db, ItemTransaksi, item.id)
    assert (i.status, i.tanggal_kembali) == ("DIKEMBALIKAN", HARI_INI)
    assert _segar(db, Eksemplar, e.id).status == "TERSEDIA"
    assert _tagihan_item(db, item) == []


def test_FR_KMB_06_terlambat_satu_tagihan_denda_belum_lunas_nominal_tersimpan(db: Session):
    item, e = _dipinjam(db, _transaksi(db), terlambat=8, harga=100_000)
    h = pengembalian.konfirmasi(db, kode_eksemplar=e.kode)
    (t,) = _tagihan_item(db, item)
    assert h.tagihan == pengembalian.TagihanDibentuk(id=t.id, nominal=20_000)
    assert h.hari_terlambat == 8
    assert (t.jenis, t.status, t.nominal, t.tanggal_dibentuk) == (
        "DENDA",
        "BELUM_LUNAS",
        20_000,
        HARI_INI,
    )
    assert (t.cara_penyelesaian, t.nominal_dibayar, t.tanggal_penyelesaian) == (None, None, None)
    assert _segar(db, Eksemplar, e.id).status == "TERSEDIA"


def test_FR_KMB_06_OQ_01_pembulatan_nominal_tagihan(db: Session):
    _, e = _dipinjam(db, _transaksi(db), terlambat=1, harga=15_555)
    assert pengembalian.konfirmasi(db, kode_eksemplar=e.kode).tagihan.nominal == 1_556


def test_FR_KMB_06_nominal_tidak_berubah_bila_harga_judul_diubah_kemudian(db: Session):
    item, e = _dipinjam(db, _transaksi(db), terlambat=8, harga=100_000)
    pengembalian.konfirmasi(db, kode_eksemplar=e.kode)
    judul = db.get(JudulBuku, _segar(db, Eksemplar, e.id).judul_buku_id)
    judul.harga = 250_000
    db.flush()
    (t,) = _tagihan_item(db, item)
    assert _segar(db, Tagihan, t.id).nominal == 20_000  # SRS 7.1


def test_FR_KMB_06_OQ_25_harga_saat_konfirmasi_dipakai(db: Session):
    _, e = _dipinjam(db, _transaksi(db), terlambat=8, harga=100_000)
    assert pengembalian.pratinjau(db, e.kode).denda == 20_000
    judul = db.get(JudulBuku, _segar(db, Eksemplar, e.id).judul_buku_id)
    judul.harga = 50_000  # diubah admin antara pratinjau dan konfirmasi
    db.flush()
    assert pengembalian.konfirmasi(db, kode_eksemplar=e.kode).tagihan.nominal == 10_000


def test_FR_KMB_06_plafon_100_hari_denda_100_persen(db: Session):
    _, e = _dipinjam(db, _transaksi(db), terlambat=100, harga=47_250)
    h = pengembalian.konfirmasi(db, kode_eksemplar=e.kode)
    assert (h.hari_terlambat, h.tagihan.nominal) == (100, 47_250)


def test_FR_KMB_05_K_07_OQ_25_tanggal_kembali_wib_lewat_tengah_malam(db: Session, atur_waktu):
    item, e = _dipinjam(db, _transaksi(db), terlambat=0, harga=100_000)  # jatuh tempo 15/11
    assert pengembalian.pratinjau(db, e.kode).denda == 0
    atur_waktu(datetime(2026, 11, 15, 17, 30, tzinfo=UTC))  # 16/11 00:30 WIB
    h = pengembalian.konfirmasi(db, kode_eksemplar=e.kode)
    assert (h.tanggal_kembali, h.hari_terlambat, h.tagihan.nominal) == (
        date(2026, 11, 16),
        1,
        10_000,
    )  # nominal final dihitung ulang saat konfirmasi
    assert _segar(db, ItemTransaksi, item.id).tanggal_kembali == date(2026, 11, 16)


def test_FR_KMB_07_pengembalian_sebagian_item_lain_tidak_berubah(db: Session):
    trx = _transaksi(db)
    i1, e1 = _dipinjam(db, trx, terlambat=8)
    i2, e2 = _dipinjam(db, trx, terlambat=8)
    h = pengembalian.konfirmasi(db, kode_eksemplar=e1.kode)
    assert h.transaksi_selesai is False
    lain = _segar(db, ItemTransaksi, i2.id)
    assert (lain.status, lain.tanggal_kembali) == ("DIPINJAM", None)
    assert _segar(db, Eksemplar, e2.id).status == "DIPINJAM"
    assert _tagihan_item(db, i2) == []
    assert _segar(db, TransaksiPeminjaman, trx.id).status == "AKTIF"


def test_FR_KMB_08_transaksi_selesai_saat_item_terakhir(db: Session):
    trx = _transaksi(db)
    _, e1 = _dipinjam(db, trx)
    _, e2 = _dipinjam(db, trx)
    assert pengembalian.konfirmasi(db, kode_eksemplar=e1.kode).transaksi_selesai is False
    assert pengembalian.konfirmasi(db, kode_eksemplar=e2.kode).transaksi_selesai is True
    assert _segar(db, TransaksiPeminjaman, trx.id).status == "SELESAI"


def test_FR_KMB_08_tepat_waktu_dengan_autoflush_mati_transaksi_selesai(db: Session):
    """Sesi aplikasi memakai autoflush=False; tanpa tagihan tidak ada flush lain yang menolong."""
    trx = _transaksi(db)
    _, e = _dipinjam(db, trx, terlambat=0)
    db.autoflush = False
    h = pengembalian.konfirmasi(db, kode_eksemplar=e.kode)
    assert (h.tagihan, h.transaksi_selesai) == (None, True)
    assert _segar(db, TransaksiPeminjaman, trx.id).status == "SELESAI"


def test_FR_KMB_08_campuran_hilang_dan_dikembalikan_selesai(db: Session):
    trx = _transaksi(db)
    _hilang(db, trx)
    _, e = _dipinjam(db, trx)
    assert pengembalian.konfirmasi(db, kode_eksemplar=e.kode).transaksi_selesai is True
    assert _segar(db, TransaksiPeminjaman, trx.id).status == "SELESAI"


def test_FR_KMB_08_tutup_transaksi_hanya_mengubah_transaksi(db: Session):
    trx = _transaksi(db)
    item, e = _dipinjam(db, trx)
    assert pengembalian.tutup_transaksi_bila_selesai(db, trx.id) is False
    assert _segar(db, TransaksiPeminjaman, trx.id).status == "AKTIF"
    assert _segar(db, ItemTransaksi, item.id).status == "DIPINJAM"
    assert _segar(db, Eksemplar, e.id).status == "DIPINJAM"

    trx2 = _transaksi(db)
    _hilang(db, trx2)
    assert pengembalian.tutup_transaksi_bila_selesai(db, trx2.id) is True
    assert _segar(db, TransaksiPeminjaman, trx2.id).status == "SELESAI"


def test_FR_KMB_03_konfirmasi_kedua_eksemplar_sama_ditolak(db: Session):
    item, e = _dipinjam(db, _transaksi(db), terlambat=8)
    pengembalian.konfirmasi(db, kode_eksemplar=e.kode)
    g = _galat(pengembalian.konfirmasi, db, kode_eksemplar=e.kode)
    assert g.kode == "KMB_TIDAK_DIPINJAM"
    assert len(_tagihan_item(db, item)) == 1


def test_FR_KMB_05_eksemplar_bisa_dipinjam_lagi_setelah_kembali(db: Session):
    _, e = _dipinjam(db, _transaksi(db))
    pengembalian.konfirmasi(db, kode_eksemplar=e.kode)
    a = pabrik.anggota(db)
    hasil = peminjaman.konfirmasi(
        db, anggota_id=a.id, kode_eksemplar=[e.kode], admin_id=pabrik.admin(db).id
    )
    assert [i.kode_eksemplar for i in hasil.item] == [e.kode]


def test_BR_18_FR_PJM_03_setelah_kembali_terlambat_anggota_terblokir_oleh_tagihan(db: Session):
    a = pabrik.anggota(db)
    _, e = _dipinjam(db, _transaksi(db, a), terlambat=8, judul="Pulang")
    sebelum = peminjaman.kelayakan_anggota(db, a.id)
    assert [x.rujukan for x in sebelum.alasan] == ["FR-PJM-04"]  # terlambat, belum ada tagihan

    pengembalian.konfirmasi(db, kode_eksemplar=e.kode)
    sesudah = peminjaman.kelayakan_anggota(db, a.id)
    assert [x.rujukan for x in sesudah.alasan] == ["FR-PJM-03"]  # kini lewat tagihan
    assert (
        sesudah.alasan[0].pesan == "Anggota memiliki 1 tagihan Belum Lunas dengan total Rp20.000."
    )


def test_NFR_REL_01_galat_saat_membentuk_tagihan_tidak_ada_perubahan(db: Session, monkeypatch):
    trx = _transaksi(db)
    item, e = _dipinjam(db, trx, terlambat=8)

    class GagalDisengaja(Exception):
        pass

    dipanggil = []

    def gagal(*args, **kwargs):
        dipanggil.append(1)
        raise GagalDisengaja

    monkeypatch.setattr(pengembalian, "_bentuk_tagihan", gagal)
    _setup_tercommit(db)
    with pytest.raises(GagalDisengaja):
        pengembalian.konfirmasi(db, kode_eksemplar=e.kode)
    assert dipanggil == [1]  # gagal tepat di tahap pembentukan tagihan, setelah item diubah
    i = _segar(db, ItemTransaksi, item.id)
    assert (i.status, i.tanggal_kembali) == ("DIPINJAM", None)
    assert _segar(db, Eksemplar, e.id).status == "DIPINJAM"
    assert _segar(db, TransaksiPeminjaman, trx.id).status == "AKTIF"
    assert db.scalar(select(func.count()).where(Tagihan.item_transaksi_id == item.id)) == 0


# --------------------------------------------------------------------------- API & akses


@pytest.fixture
def admin_masuk(client, db: Session):
    akun = pabrik.admin(db, password_hash=hash_password("rahasia-123"))
    r = client.post("/api/v1/auth/login", json={"email": akun.email, "password": "rahasia-123"})
    assert r.status_code == 200
    return akun


def test_KMB_alur_api_pratinjau_lalu_konfirmasi(client, db: Session, admin_masuk):
    a = pabrik.anggota(db, nama="Agus Hidayat")
    _, e = _dipinjam(db, _transaksi(db, a), terlambat=8, judul="Gadis Pantai")

    r = client.get(f"{API}/{e.kode.lower()}")
    assert r.status_code == 200, r.text
    assert r.json() == {
        "eksemplar": {"kode": e.kode, "judul": "Gadis Pantai"},
        "peminjam": {"kode": a.kode, "nama": "Agus Hidayat"},  # tanpa NIK/kontak
        "tanggal_pinjam": "2026-10-08",
        "jatuh_tempo": "2026-11-07",
        "hari_terlambat": 8,
        "denda": 20_000,
    }

    r = client.post(API, json={"kode_eksemplar": e.kode})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["tanggal_kembali"] == "2026-11-15"
    assert body["tagihan"]["nominal"] == 20_000
    assert body["transaksi_selesai"] is True


def test_KMB_api_galat_berformat_standar(client, db: Session, admin_masuk):
    e = pabrik.eksemplar(db)
    r = client.post(API, json={"kode_eksemplar": e.kode})
    assert r.status_code == 422
    assert r.json()["detail"]["kode"] == "KMB_TIDAK_DIPINJAM"
    assert r.json()["detail"]["rujukan"] == "FR-KMB-03"


def test_BR_07_pengembalian_hanya_admin(client, db: Session):
    a = pabrik.anggota(db, password_hash=hash_password("rahasia-123"))
    assert client.get(f"{API}/EKS-000001").status_code == 401
    r = client.post("/api/v1/auth/login", json={"email": a.email, "password": "rahasia-123"})
    assert r.status_code == 200
    assert client.get(f"{API}/EKS-000001").status_code == 403
    assert client.post(API, json={"kode_eksemplar": "EKS-000001"}).status_code == 403

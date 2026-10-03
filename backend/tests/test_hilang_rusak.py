"""WP 5.3.10 — hilang/rusak: FR-HLR-01..05, BR-14..16, BR-18, K-01, OQ-26, OQ-27, FR-KMB-08.

"Hari ini" dipatok 15/11/2026 WIB. Konkurensi (NFR-REL-02) ada di test_hilang_rusak_konkurensi.py.
"""

import re
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

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
from app.models.status import StatusItem
from app.services import hilang_rusak, kalkulasi, peminjaman, pengembalian
from tests import pabrik

HARI_INI = date(2026, 11, 15)
API = "/api/v1/admin/hilang-rusak"


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
    judul: str = "Buku Uji",
) -> tuple[ItemTransaksi, Eksemplar]:
    """Item Dipinjam; `terlambat` = hari_ini − jatuh_tempo (negatif = belum lewat)."""
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


def _item_berstatus(db: Session, trx: TransaksiPeminjaman, status: str) -> ItemTransaksi:
    """Data setup item yang sudah tidak Dipinjam (bukan lewat service)."""
    eks = {"DIKEMBALIKAN": "TERSEDIA", "HILANG": "HILANG", "RUSAK": "RUSAK"}[status]
    e = pabrik.eksemplar(db, judul_buku_id=pabrik.judul(db).id, status=eks)
    data = {
        "transaksi_id": trx.id,
        "eksemplar_id": e.id,
        "tanggal_pinjam": HARI_INI - timedelta(days=20),
        "jatuh_tempo": HARI_INI + timedelta(days=10),
        "status": status,
    }
    if status == "DIKEMBALIKAN":
        data["tanggal_kembali"] = HARI_INI - timedelta(days=1)
    else:
        data |= {
            "tanggal_kejadian": HARI_INI - timedelta(days=2),
            "keterangan": "Data setup",
            "admin_pencatat_id": pabrik.admin(db).id,
        }
    return pabrik.item(db, **data)


def _catat(
    db: Session,
    item: ItemTransaksi,
    *,
    jenis: str = "HILANG",
    tanggal_kejadian: date = HARI_INI,
    keterangan: str = "Hilang di angkutan umum",
    admin_id: int | None = None,
) -> hilang_rusak.HasilPencatatan:
    return hilang_rusak.catat(
        db,
        item_id=item.id,
        jenis=StatusItem(jenis),
        tanggal_kejadian=tanggal_kejadian,
        keterangan=keterangan,
        admin_id=admin_id or pabrik.admin(db).id,
    )


def _setup_tercommit(db: Session) -> None:
    """Commit data setup sebelum operasi yang diharapkan gagal (savepoint fixture)."""
    db.commit()


def _galat(fungsi, *args, **kwargs) -> GalatBisnis:
    with pytest.raises(GalatBisnis) as info:
        fungsi(*args, **kwargs)
    return info.value


def _segar(db: Session, model, id_: int):
    db.expire_all()
    return db.get(model, id_)


def _tagihan(db: Session, item: ItemTransaksi) -> list[Tagihan]:
    return list(db.scalars(select(Tagihan).where(Tagihan.item_transaksi_id == item.id)))


def _tidak_berubah(db: Session, item: ItemTransaksi, e: Eksemplar) -> None:
    i = _segar(db, ItemTransaksi, item.id)
    assert (i.status, i.tanggal_kejadian, i.keterangan, i.admin_pencatat_id) == (
        "DIPINJAM",
        None,
        None,
        None,
    )
    assert _segar(db, Eksemplar, e.id).status == "DIPINJAM"
    assert db.scalar(select(func.count()).where(Tagihan.item_transaksi_id == item.id)) == 0


# ------------------------------------------------------------------------- daftar item (FR-HLR-01)


def test_FR_HLR_01_daftar_item_dipinjam_anggota_dari_kode(db: Session):
    a = pabrik.anggota(db, nama="Hendra Nasution")
    trx = _transaksi(db, a)
    i1, e1 = _dipinjam(db, trx, terlambat=4, judul="Arus Balik")
    i2, e2 = _dipinjam(db, trx, terlambat=-2, judul="Bumi Manusia")
    _item_berstatus(db, trx, "DIKEMBALIKAN")
    _item_berstatus(db, trx, "RUSAK")
    _dipinjam(db, _transaksi(db))  # milik anggota lain

    d = hilang_rusak.daftar_item_anggota(db, f" {a.kode.lower()} ")
    assert d.anggota == hilang_rusak.Ringkas(kode=a.kode, nama="Hendra Nasution")
    assert d.item == [
        hilang_rusak.ItemAktif(
            item_id=i1.id,
            kode_eksemplar=e1.kode,
            judul="Arus Balik",
            tanggal_pinjam=i1.tanggal_pinjam,
            jatuh_tempo=HARI_INI - timedelta(days=4),
            hari_terlambat=4,
        ),
        hilang_rusak.ItemAktif(
            item_id=i2.id,
            kode_eksemplar=e2.kode,
            judul="Bumi Manusia",
            tanggal_pinjam=i2.tanggal_pinjam,
            jatuh_tempo=HARI_INI + timedelta(days=2),
            hari_terlambat=0,
        ),
    ]


def test_FR_HLR_01_kode_anggota_tidak_dikenal_404(db: Session):
    g = _galat(hilang_rusak.daftar_item_anggota, db, "AGT-999999")
    assert (g.kode, g.status_code) == ("HLR_ANGGOTA_TIDAK_ADA", 404)
    assert "AGT-999999" in g.pesan


# --------------------------------------------------------------------------- pencatatan


def test_FR_HLR_01_03_catat_hilang_item_dan_eksemplar_hilang_data_tersimpan(db: Session):
    a = pabrik.anggota(db, nama="Putri")
    item, e = _dipinjam(db, _transaksi(db, a), judul="Siti Nurbaya")
    admin = pabrik.admin(db)
    kejadian = HARI_INI - timedelta(days=3)
    h = _catat(
        db,
        item,
        tanggal_kejadian=kejadian,
        keterangan="  Tertinggal di kereta  ",
        admin_id=admin.id,
    )

    assert (h.item_id, h.kode_eksemplar, h.judul, h.status) == (
        item.id,
        e.kode,
        "Siti Nurbaya",
        "HILANG",
    )
    assert h.anggota == hilang_rusak.Ringkas(kode=a.kode, nama="Putri")
    assert (h.tanggal_kejadian, h.keterangan) == (kejadian, "Tertinggal di kereta")
    i = _segar(db, ItemTransaksi, item.id)
    assert (i.status, i.tanggal_kejadian, i.keterangan, i.admin_pencatat_id, i.tanggal_kembali) == (
        "HILANG",
        kejadian,
        "Tertinggal di kereta",
        admin.id,
        None,
    )
    assert _segar(db, Eksemplar, e.id).status == "HILANG"


def test_FR_HLR_04_OQ_27_tagihan_penggantian_sama_dengan_harga(db: Session):
    item, _ = _dipinjam(db, _transaksi(db), harga=47_250)
    h = _catat(db, item, tanggal_kejadian=HARI_INI - timedelta(days=4))
    (t,) = _tagihan(db, item)
    assert h.tagihan == hilang_rusak.TagihanDibentuk(id=t.id, nominal=47_250)
    assert (t.jenis, t.status, t.nominal, t.tanggal_dibentuk) == (
        "PENGGANTIAN",
        "BELUM_LUNAS",
        47_250,
        HARI_INI,  # OQ-27: tanggal pencatatan, bukan tanggal kejadian
    )
    assert (t.cara_penyelesaian, t.nominal_dibayar, t.tanggal_penyelesaian) == (None, None, None)


def test_FR_HLR_04_BR_15_item_terlambat_dicatat_hilang_tanpa_denda(db: Session):
    item, _ = _dipinjam(db, _transaksi(db), terlambat=30, harga=100_000)
    _catat(db, item)
    assert [(t.jenis, t.nominal) for t in _tagihan(db, item)] == [("PENGGANTIAN", 100_000)]


def test_FR_HLR_04_jalur_penggantian_tidak_memanggil_hitung_denda(db: Session, monkeypatch):
    def dilarang(*args, **kwargs):
        raise AssertionError("hitung_denda dipanggil di jalur penggantian (BR-15)")

    monkeypatch.setattr(kalkulasi, "hitung_denda", dilarang)
    item, _ = _dipinjam(db, _transaksi(db), terlambat=50)
    h = _catat(db, item, jenis="RUSAK")
    assert h.tagihan.nominal == 100_000
    assert not hasattr(h, "denda")


def test_FR_HLR_02_BR_16_catat_rusak_tanpa_buku_diserahkan(db: Session):
    item, e = _dipinjam(db, _transaksi(db), harga=65_000)
    h = _catat(db, item, jenis="RUSAK", keterangan="Terkena banjir, buku tidak dibawa")
    assert h.status == "RUSAK"
    assert _segar(db, ItemTransaksi, item.id).status == "RUSAK"
    assert _segar(db, Eksemplar, e.id).status == "RUSAK"
    assert [(t.jenis, t.nominal) for t in _tagihan(db, item)] == [("PENGGANTIAN", 65_000)]


def test_FR_HLR_04_nominal_tidak_berubah_bila_harga_judul_diubah_kemudian(db: Session):
    item, e = _dipinjam(db, _transaksi(db), harga=80_000)
    _catat(db, item)
    judul = db.get(JudulBuku, _segar(db, Eksemplar, e.id).judul_buku_id)
    judul.harga = 120_000
    db.flush()
    (t,) = _tagihan(db, item)
    assert _segar(db, Tagihan, t.id).nominal == 80_000  # SRS 7.1


@pytest.mark.parametrize("keterangan", ["", "   "])
def test_FR_HLR_03_OQ_10_keterangan_kosong_ditolak(db: Session, keterangan):
    item, e = _dipinjam(db, _transaksi(db))
    admin = pabrik.admin(db)
    _setup_tercommit(db)
    g = _galat(_catat, db, item, keterangan=keterangan, admin_id=admin.id)
    assert (g.kode, g.status_code, g.rujukan) == ("HLR_KETERANGAN_KOSONG", 422, "FR-HLR-03")
    _tidak_berubah(db, item, e)


@pytest.mark.parametrize(
    ("status", "label"),
    [("DIKEMBALIKAN", "Dikembalikan"), ("HILANG", "Hilang"), ("RUSAK", "Rusak")],
)
def test_FR_HLR_03_item_bukan_dipinjam_ditolak_dengan_label_status(db: Session, status, label):
    item = _item_berstatus(db, _transaksi(db), status)
    admin = pabrik.admin(db)
    _setup_tercommit(db)
    g = _galat(_catat, db, item, admin_id=admin.id)
    assert (g.kode, g.status_code, g.rujukan) == ("HLR_TIDAK_DIPINJAM", 422, "FR-HLR-03")
    assert f"(status item: {label})" in g.pesan
    assert status not in g.pesan  # label UI, bukan kode (IR-UI-03)
    assert db.scalar(select(func.count()).where(Tagihan.item_transaksi_id == item.id)) == 0


def test_FR_HLR_03_item_tidak_ada_404(db: Session):
    g = _galat(
        hilang_rusak.catat,
        db,
        item_id=999_999_999,
        jenis=StatusItem.HILANG,
        tanggal_kejadian=HARI_INI,
        keterangan="x",
        admin_id=pabrik.admin(db).id,
    )
    assert (g.kode, g.status_code) == ("HLR_ITEM_TIDAK_ADA", 404)


@pytest.mark.parametrize("selisih", [-1, None])
def test_OQ_26_tanggal_kejadian_di_luar_batas_ditolak(db: Session, selisih):
    item, e = _dipinjam(db, _transaksi(db), terlambat=-5)  # pinjam 21/10/2026
    tanggal = item.tanggal_pinjam + timedelta(days=selisih) if selisih else HARI_INI + timedelta(1)
    admin = pabrik.admin(db)
    _setup_tercommit(db)
    g = _galat(_catat, db, item, tanggal_kejadian=tanggal, admin_id=admin.id)
    assert (g.kode, g.status_code, g.rujukan) == ("HLR_TANGGAL_KEJADIAN", 422, "FR-HLR-03")
    assert "21/10/2026" in g.pesan and "15/11/2026" in g.pesan
    _tidak_berubah(db, item, e)


@pytest.mark.parametrize("batas", ["pinjam", "hari_ini"])
def test_OQ_26_tanggal_kejadian_batas_inklusif_diterima(db: Session, batas):
    item, _ = _dipinjam(db, _transaksi(db))
    tanggal = item.tanggal_pinjam if batas == "pinjam" else HARI_INI
    assert _catat(db, item, tanggal_kejadian=tanggal).tanggal_kejadian == tanggal


def test_OQ_26_tanggal_kejadian_tidak_memengaruhi_nominal(db: Session):
    awal, _ = _dipinjam(db, _transaksi(db), terlambat=40, harga=30_000)
    akhir, _ = _dipinjam(db, _transaksi(db), terlambat=40, harga=30_000)
    _catat(db, awal, tanggal_kejadian=awal.tanggal_pinjam)
    _catat(db, akhir, tanggal_kejadian=HARI_INI)
    assert [t.nominal for t in _tagihan(db, awal) + _tagihan(db, akhir)] == [30_000, 30_000]


# --------------------------------------------------------------------------- penutupan transaksi


def test_FR_KMB_08_transaksi_selesai_lewat_item_rusak(db: Session):
    trx = _transaksi(db)
    _, e1 = _dipinjam(db, trx)
    i2, _ = _dipinjam(db, trx)
    pengembalian.konfirmasi(db, kode_eksemplar=e1.kode)
    assert _catat(db, i2, jenis="RUSAK").transaksi_selesai is True
    assert _segar(db, TransaksiPeminjaman, trx.id).status == "SELESAI"


def test_FR_KMB_08_hilang_tetapi_masih_ada_dipinjam_transaksi_aktif(db: Session):
    trx = _transaksi(db)
    i1, _ = _dipinjam(db, trx)
    i2, _ = _dipinjam(db, trx)
    assert _catat(db, i1).transaksi_selesai is False
    assert _segar(db, TransaksiPeminjaman, trx.id).status == "AKTIF"
    assert _segar(db, ItemTransaksi, i2.id).status == "DIPINJAM"


def test_FR_KMB_08_autoflush_mati_transaksi_selesai(db: Session):
    trx = _transaksi(db)
    item, _ = _dipinjam(db, trx)
    db.autoflush = False
    assert _catat(db, item).transaksi_selesai is True
    assert _segar(db, TransaksiPeminjaman, trx.id).status == "SELESAI"


# --------------------------------------------------------------------------- tanpa jalur otomatis


def test_FR_HLR_05_tidak_ada_jalur_otomatis_ke_hilang_setelah_plafon(db: Session):
    a = pabrik.anggota(db)
    item, e = _dipinjam(db, _transaksi(db, a), terlambat=100)  # denda sudah plafon
    peminjaman.kelayakan_anggota(db, a.id)
    peminjaman.identifikasi_anggota(db, a.kode)
    pengembalian.pratinjau(db, e.kode)
    hilang_rusak.daftar_item_anggota(db, a.kode)
    _tidak_berubah(db, item, e)


# Penulisan status Hilang dari konstanta: `status = StatusItem.HILANG`, `"status": "HILANG"`,
# `.values(status="HILANG")`. Pembacaan (filter/hitungan) tidak cocok dengan pola ini.
_PENULIS_HILANG = re.compile(
    r"status[\"']?\s*[=:]\s*(Status(Item|Eksemplar)\.HILANG|[\"']HILANG[\"'])", re.IGNORECASE
)


def test_FR_HLR_05_tidak_ada_penetapan_hilang_otomatis_maupun_penjadwal():
    """Statis: satu-satunya jalan ke Hilang adalah `hilang_rusak.catat` dengan `jenis` dari admin;
    tak ada kode yang menetapkan Hilang dari konstanta, dan tak ada penjadwal/cron."""
    app = Path(__file__).resolve().parents[1] / "app"
    pelanggar = [
        f.relative_to(app).as_posix()
        for f in app.rglob("*.py")
        if _PENULIS_HILANG.search(f.read_text(encoding="utf-8"))
    ]
    assert pelanggar == []
    penjadwal = re.compile(r"apscheduler|celery|repeat_every|BackgroundTasks|on_event|lifespan")
    assert [f.name for f in app.rglob("*.py") if penjadwal.search(f.read_text("utf-8"))] == []


def test_FR_HLR_05_K_01_tidak_ada_route_anggota_yang_mengubah_item_atau_eksemplar():
    from app.api.deps import butuh_admin
    from tests.test_autentikasi import _dependensi, _route_aplikasi_sungguhan

    route = _route_aplikasi_sungguhan()
    # Endpoint pencatatan hanya di area admin dan dijaga butuh_admin.
    pencatat = [
        r
        for r in route
        if r.original_route.endpoint is not None
        and r.original_route.endpoint.__module__ == "app.api.v1.admin.hilang_rusak"
    ]
    assert pencatat
    for r in pencatat:
        assert r.path.startswith("/api/v1/admin/hilang-rusak")
        assert butuh_admin in set(_dependensi(r.dependant))

    # Area anggota: tidak memakai modul admin/sirkulasi, dan tak ada route pengubah item/eksemplar.
    sirkulasi = re.compile(r"item|eksemplar|hilang|rusak|lapor|pinjam|kembali", re.IGNORECASE)
    for r in route:
        if not r.path.startswith("/api/v1/anggota/"):
            continue
        assert not r.original_route.endpoint.__module__.startswith("app.api.v1.admin"), r.path
        ubah = set(r.methods) - {"GET", "HEAD", "OPTIONS"}
        assert not (ubah and sirkulasi.search(r.path)), r.path


# --------------------------------------------------------------------------- kelayakan & keandalan


def test_BR_18_setelah_dicatat_hilang_blokir_lewat_tagihan_penggantian(db: Session):
    a = pabrik.anggota(db)
    item, _ = _dipinjam(db, _transaksi(db, a), terlambat=12, harga=55_000)
    assert [x.rujukan for x in peminjaman.kelayakan_anggota(db, a.id).alasan] == ["FR-PJM-04"]
    _catat(db, item)
    k = peminjaman.kelayakan_anggota(db, a.id)
    assert [x.rujukan for x in k.alasan] == ["FR-PJM-03"]  # bukan lagi item terlambat
    assert k.alasan[0].pesan == "Anggota memiliki 1 tagihan Belum Lunas dengan total Rp55.000."


def test_NFR_REL_01_galat_saat_membentuk_tagihan_tidak_ada_perubahan(db: Session, monkeypatch):
    trx = _transaksi(db)
    item, e = _dipinjam(db, trx)

    class GagalDisengaja(Exception):
        pass

    dipanggil = []

    def gagal(*args, **kwargs):
        dipanggil.append(1)
        raise GagalDisengaja

    monkeypatch.setattr(hilang_rusak, "_bentuk_tagihan_penggantian", gagal)
    admin = pabrik.admin(db)
    _setup_tercommit(db)
    with pytest.raises(GagalDisengaja):
        _catat(db, item, admin_id=admin.id)
    assert dipanggil == [1]
    _tidak_berubah(db, item, e)
    assert _segar(db, TransaksiPeminjaman, trx.id).status == "AKTIF"


# --------------------------------------------------------------------------- API & akses


@pytest.fixture
def admin_masuk(client, db: Session):
    akun = pabrik.admin(db, password_hash=hash_password("rahasia-123"))
    r = client.post("/api/v1/auth/login", json={"email": akun.email, "password": "rahasia-123"})
    assert r.status_code == 200
    return akun


def test_HLR_alur_api_daftar_lalu_catat(client, db: Session, admin_masuk):
    a = pabrik.anggota(db, nama="Nur")
    item, e = _dipinjam(db, _transaksi(db, a), judul="Ronggeng Dukuh Paruk", harga=72_000)

    r = client.get(f"{API}/anggota/{a.kode}")
    assert r.status_code == 200, r.text
    assert r.json()["anggota"] == {"kode": a.kode, "nama": "Nur"}  # tanpa NIK/kontak
    assert r.json()["item"][0]["kode_eksemplar"] == e.kode

    r = client.post(
        API,
        json={
            "item_id": item.id,
            "jenis": "RUSAK",
            "tanggal_kejadian": "2026-11-14",
            "keterangan": "Sampul sobek",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert (body["status"], body["tagihan"]["nominal"]) == ("RUSAK", 72_000)
    assert "denda" not in body and "denda" not in body["tagihan"]
    assert _segar(db, ItemTransaksi, item.id).admin_pencatat_id == admin_masuk.id


def test_HLR_api_galat_berformat_standar_dan_jenis_tidak_sah(client, db: Session, admin_masuk):
    item = _item_berstatus(db, _transaksi(db), "DIKEMBALIKAN")
    body = {"item_id": item.id, "jenis": "HILANG", "tanggal_kejadian": "2026-11-15"}
    r = client.post(API, json=body | {"keterangan": "x"})
    assert r.status_code == 422
    assert r.json()["detail"]["kode"] == "HLR_TIDAK_DIPINJAM"
    assert (
        client.post(API, json=body | {"jenis": "TERLAMBAT", "keterangan": "x"}).status_code == 422
    )


def test_BR_07_K_01_hilang_rusak_hanya_admin(client, db: Session):
    a = pabrik.anggota(db, password_hash=hash_password("rahasia-123"))
    assert client.get(f"{API}/anggota/{a.kode}").status_code == 401
    r = client.post("/api/v1/auth/login", json={"email": a.email, "password": "rahasia-123"})
    assert r.status_code == 200
    assert client.get(f"{API}/anggota/{a.kode}").status_code == 403
    body = {"item_id": 1, "jenis": "HILANG", "tanggal_kejadian": "2026-11-15", "keterangan": "x"}
    assert client.post(API, json=body).status_code == 403

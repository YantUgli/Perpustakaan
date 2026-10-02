"""WP 5.2.1 — constraint skema (DR-01..DR-09, domain-rules §2/§5/§8, OQ-03, OQ-08..OQ-12).

Setiap test memasukkan data yang melanggar satu aturan dan memastikan basis data menolaknya.
"""

from datetime import timedelta

import pytest
from sqlalchemy import delete, inspect, select, text
from sqlalchemy.exc import IntegrityError

from app.models import Eksemplar, JudulBuku, Kategori, Rak
from tests import pabrik as p
from tests.pabrik import TGL, harus_gagal

# --- DR-01 Admin ----------------------------------------------------------------------------


def test_DR_01_email_admin_unik(db):
    p.admin(db, email="admin@perpus.test")
    harus_gagal(db, p.Admin(nama="B", email="admin@perpus.test", password_hash="x"))


def test_OQ_08_nama_admin_wajib(db):
    harus_gagal(db, p.Admin(nama=None, email="tanpanama@perpus.test", password_hash="x"))


# --- DR-02 Anggota --------------------------------------------------------------------------


@pytest.mark.parametrize("nik", ["123456789012345", "12345678901234567", "12345678901234AB"])
def test_DR_02_nik_15_17_digit_atau_huruf_ditolak(db, nik):
    with pytest.raises(IntegrityError) as info, db.begin_nested():
        p.anggota(db, nik=nik)
    assert info.value.orig.diag.constraint_name == "ck_anggota_nik_16_digit"


def test_DR_02_nik_16_digit_diterima(db):
    assert p.anggota(db, nik="3201234567890001").nik == "3201234567890001"


def test_DR_02_nik_duplikat_ditolak(db):
    p.anggota(db, nik="3201234567890001")
    with pytest.raises(IntegrityError) as info, db.begin_nested():
        p.anggota(db, nik="3201234567890001")
    assert info.value.orig.diag.constraint_name == "uq_anggota_nik"


def test_DR_02_email_duplikat_ditolak(db):
    p.anggota(db, email="budi@perpus.test")
    with pytest.raises(IntegrityError) as info, db.begin_nested():
        p.anggota(db, email="budi@perpus.test")
    assert info.value.orig.diag.constraint_name == "uq_anggota_email_lower"


def test_OQ_09_email_beda_huruf_besar_ditolak(db):
    p.anggota(db, email="budi@perpus.test")
    with pytest.raises(IntegrityError) as info, db.begin_nested():
        p.anggota(db, email="  Budi@Perpus.TEST ")
    assert info.value.orig.diag.constraint_name == "uq_anggota_email_lower"


def test_OQ_09_email_admin_beda_huruf_besar_ditolak(db):
    p.admin(db, email="admin@perpus.test")
    harus_gagal(
        db,
        p.Admin(nama="B", email="ADMIN@perpus.test", password_hash="x"),
        "uq_admin_email_lower",
    )


def test_DR_02_foto_opsional(db):
    assert p.anggota(db).foto_path is None


def test_OQ_03_kode_anggota_otomatis_berurutan(db):
    a1, a2 = p.anggota(db), p.anggota(db)
    db.refresh(a1)
    db.refresh(a2)
    assert a1.kode.startswith("AGT-") and len(a1.kode) == 10
    assert int(a2.kode[4:]) == int(a1.kode[4:]) + 1


# --- DR-03 / DR-04 Kategori & Rak -----------------------------------------------------------


def test_DR_03_nama_kategori_unik(db):
    p.kategori(db, nama="Fiksi")
    harus_gagal(db, Kategori(nama="Fiksi"), "uq_kategori_nama_lower")


def test_OQ_09_nama_kategori_beda_huruf_besar_ditolak(db):
    p.kategori(db, nama="Fiksi")
    harus_gagal(db, Kategori(nama=" FIKSI"), "uq_kategori_nama_lower")


def test_DR_04_kode_rak_unik(db):
    p.rak(db, kode="A-01")
    harus_gagal(db, Rak(kode="a-01"), "uq_rak_kode_lower")


def test_OQ_08_lokasi_rak_opsional(db):
    assert p.rak(db).lokasi is None


# --- DR-05 Judul buku -----------------------------------------------------------------------


@pytest.mark.parametrize("harga", [0, -1])
def test_DR_05_harga_nol_atau_negatif_ditolak(db, harga):
    with pytest.raises(IntegrityError) as info, db.begin_nested():
        p.judul(db, harga=harga)
    assert info.value.orig.diag.constraint_name == "ck_judul_buku_harga_positif"


def test_DR_05_isbn_unik(db):
    p.judul(db, isbn="9786020000001")
    with pytest.raises(IntegrityError) as info, db.begin_nested():
        p.judul(db, isbn="9786020000001")
    # OQ-13 (WP 5.3.5): unik dipindah ke kolom ternormalisasi
    assert info.value.orig.diag.constraint_name == "uq_judul_buku_isbn_normal"


@pytest.mark.parametrize("kolom", ["isbn", "judul", "penulis", "penerbit", "tahun", "kategori_id"])
def test_OQ_10_kolom_wajib_judul(db, kolom):
    with pytest.raises(IntegrityError), db.begin_nested():
        p.judul(db, **{kolom: None})


def test_OQ_10_tahun_harus_positif(db):
    with pytest.raises(IntegrityError) as info, db.begin_nested():
        p.judul(db, tahun=0)
    assert info.value.orig.diag.constraint_name == "ck_judul_buku_tahun_positif"


def test_OQ_10_cover_opsional(db):
    assert p.judul(db).cover_path is None


# --- DR-06 Eksemplar ------------------------------------------------------------------------


def test_DR_06_kode_eksemplar_unik_dan_otomatis(db):
    e1, e2 = p.eksemplar(db), p.eksemplar(db)
    db.refresh(e1)
    db.refresh(e2)
    assert e1.kode.startswith("EKS-") and len(e1.kode) == 10
    assert e1.kode != e2.kode
    harus_gagal(
        db,
        Eksemplar(kode=e1.kode, judul_buku_id=e1.judul_buku_id, rak_id=e1.rak_id),
        "uq_eksemplar_kode",
    )


def test_DR_06_status_awal_tersedia(db):
    e = p.eksemplar(db)
    db.refresh(e)
    assert e.status == "TERSEDIA"


def test_OQ_10_rak_eksemplar_wajib(db):
    with pytest.raises(IntegrityError), db.begin_nested():
        p.eksemplar(db, rak_id=None)


# --- Kosakata status (domain-rules §2) ------------------------------------------------------


def test_status_eksemplar_tidak_dikenal_ditolak(db):
    with pytest.raises(IntegrityError) as info, db.begin_nested():
        p.eksemplar(db, status="TERLAMBAT")  # Terlambat bukan status tersimpan
    assert info.value.orig.diag.constraint_name == "ck_eksemplar_status"


def test_status_transaksi_tidak_dikenal_ditolak(db):
    with pytest.raises(IntegrityError) as info, db.begin_nested():
        p.transaksi(db, status="BATAL")
    assert info.value.orig.diag.constraint_name == "ck_transaksi_peminjaman_status"


def test_status_item_tidak_dikenal_ditolak(db):
    # Status asing juga melanggar CHECK konsistensi; PostgreSQL melaporkan salah satunya.
    harus_gagal(
        db,
        p.item_baru(db, status="TERLAMBAT"),
        {"ck_item_transaksi_status", "ck_item_transaksi_konsistensi_status"},
    )


def test_status_dan_jenis_tagihan_tidak_dikenal_ditolak(db):
    harus_gagal(db, p.tagihan_baru(db, status="SEBAGIAN"), "ck_tagihan_status")
    harus_gagal(db, p.tagihan_baru(db, jenis="LAINNYA"), "ck_tagihan_jenis")
    harus_gagal(
        db,
        p.tagihan_baru(db, cara_penyelesaian="QRIS"),
        "ck_tagihan_cara_penyelesaian",
    )


# --- DR-08 Item transaksi, NFR-REL-02, FR-PJM-07, FR-PJM-11 ---------------------------------


def test_NFR_REL_02_dua_item_dipinjam_eksemplar_sama_ditolak(db):
    e = p.eksemplar(db)
    p.item(db, eksemplar_id=e.id)
    harus_gagal(db, p.item_baru(db, eksemplar_id=e.id), "uq_item_transaksi_pinjaman_aktif")


def test_NFR_REL_02_item_dikembalikan_lalu_dipinjam_lagi_boleh(db):
    e = p.eksemplar(db)
    lama = p.item(db, eksemplar_id=e.id)
    lama.status = "DIKEMBALIKAN"
    lama.tanggal_kembali = TGL + timedelta(days=5)
    db.flush()
    assert p.item(db, eksemplar_id=e.id).id != lama.id


def test_FR_PJM_07_eksemplar_sama_dua_kali_dalam_transaksi_ditolak(db):
    t, e = p.transaksi(db), p.eksemplar(db)
    lama = p.item(db, transaksi_id=t.id, eksemplar_id=e.id)
    lama.status = "DIKEMBALIKAN"
    lama.tanggal_kembali = TGL
    db.flush()
    harus_gagal(
        db,
        p.item_baru(db, transaksi_id=t.id, eksemplar_id=e.id),
        "uq_item_transaksi_transaksi_eksemplar",
    )


@pytest.mark.parametrize("selisih", [29, 31, 0])
def test_FR_PJM_11_jatuh_tempo_bukan_plus_30_ditolak(db, selisih):
    harus_gagal(
        db,
        p.item_baru(db, jatuh_tempo=TGL + timedelta(days=selisih)),
        "ck_item_transaksi_jatuh_tempo_30_hari",
    )


def test_FR_PJM_11_jatuh_tempo_lintas_bulan(db):
    """Contoh domain-rules §4: pinjam 01/10 → jatuh tempo 31/10."""
    i = p.item(db)
    assert i.jatuh_tempo.isoformat() == "2026-10-31"


def test_DR_08_dikembalikan_tanpa_tanggal_kembali_ditolak(db):
    harus_gagal(db, p.item_baru(db, status="DIKEMBALIKAN"), "ck_item_transaksi_konsistensi_status")


def test_DR_08_dipinjam_dengan_tanggal_kembali_ditolak(db):
    harus_gagal(db, p.item_baru(db, tanggal_kembali=TGL), "ck_item_transaksi_konsistensi_status")


def test_DR_08_tanggal_kembali_sebelum_pinjam_ditolak(db):
    harus_gagal(
        db,
        p.item_baru(db, status="DIKEMBALIKAN", tanggal_kembali=TGL - timedelta(days=1)),
        "ck_item_transaksi_kembali_setelah_pinjam",
    )


@pytest.mark.parametrize("status", ["HILANG", "RUSAK"])
def test_FR_HLR_03_hilang_rusak_lengkap_diterima(db, status):
    a = p.admin(db)
    i = p.item(
        db,
        status=status,
        tanggal_kejadian=TGL,
        keterangan="Dilaporkan lisan oleh anggota",
        admin_pencatat_id=a.id,
    )
    assert i.status == status


@pytest.mark.parametrize("keterangan", [None, "", "   "])
def test_OQ_10_keterangan_hilang_rusak_wajib(db, keterangan):
    a = p.admin(db)
    harus_gagal(
        db,
        p.item_baru(
            db,
            status="HILANG",
            tanggal_kejadian=TGL,
            keterangan=keterangan,
            admin_pencatat_id=a.id,
        ),
        "ck_item_transaksi_konsistensi_status",
    )


def test_FR_HLR_03_hilang_tanpa_tanggal_kejadian_atau_admin_ditolak(db):
    a = p.admin(db)
    harus_gagal(
        db,
        p.item_baru(db, status="RUSAK", keterangan="Sobek", admin_pencatat_id=a.id),
        "ck_item_transaksi_konsistensi_status",
    )
    harus_gagal(
        db,
        p.item_baru(db, status="RUSAK", keterangan="Sobek", tanggal_kejadian=TGL),
        "ck_item_transaksi_konsistensi_status",
    )


# --- DR-09 Tagihan --------------------------------------------------------------------------


def test_DR_09_satu_tagihan_per_item(db):
    t = p.tagihan_baru(db)
    p.simpan(db, t)
    harus_gagal(
        db,
        p.tagihan_baru(db, item_transaksi_id=t.item_transaksi_id, jenis="PENGGANTIAN"),
        "uq_tagihan_item_transaksi_id",
    )


@pytest.mark.parametrize("nominal", [0, -5_000])
def test_DR_09_nominal_nol_atau_negatif_ditolak(db, nominal):
    harus_gagal(db, p.tagihan_baru(db, nominal=nominal), "ck_tagihan_nominal_positif")


def test_OQ_08_tanggal_dibentuk_wajib(db):
    harus_gagal(db, p.tagihan_baru(db, tanggal_dibentuk=None))


def _lunas(db, **kw):
    data = {
        "status": "LUNAS",
        "cara_penyelesaian": "TUNAI",
        "nominal_dibayar": 10_000,
        "tanggal_penyelesaian": TGL,
        "admin_pengonfirmasi_id": p.admin(db).id,
    }
    return p.tagihan_baru(db, **(data | kw))


@pytest.mark.parametrize("cara", ["TUNAI", "TRANSFER"])
def test_FR_TGH_02_lunas_dengan_uang_diterima(db, cara):
    assert p.simpan(db, _lunas(db, cara_penyelesaian=cara)).status == "LUNAS"


def test_FR_TGH_03_buku_pengganti_untuk_penggantian_diterima(db):
    t = _lunas(db, jenis="PENGGANTIAN", cara_penyelesaian="BUKU_PENGGANTI", nominal_dibayar=None)
    assert p.simpan(db, t).cara_penyelesaian == "BUKU_PENGGANTI"


def test_FR_TGH_03_buku_pengganti_pada_denda_ditolak(db):
    harus_gagal(
        db,
        _lunas(db, jenis="DENDA", cara_penyelesaian="BUKU_PENGGANTI", nominal_dibayar=None),
        "ck_tagihan_buku_pengganti_hanya_penggantian",
    )


@pytest.mark.parametrize(
    "kosong", ["cara_penyelesaian", "tanggal_penyelesaian", "admin_pengonfirmasi_id"]
)
def test_FR_TGH_05_lunas_tanpa_cara_tanggal_admin_ditolak(db, kosong):
    harus_gagal(db, _lunas(db, **{kosong: None}), "ck_tagihan_konsistensi_penyelesaian")


def test_FR_TGH_05_belum_lunas_dengan_data_penyelesaian_ditolak(db):
    harus_gagal(
        db,
        p.tagihan_baru(db, tanggal_penyelesaian=TGL),
        "ck_tagihan_konsistensi_penyelesaian",
    )


@pytest.mark.parametrize("dibayar", [9_999, 10_001, None])
def test_OQ_08_nominal_dibayar_tidak_sama_ditolak(db, dibayar):
    """FR-TGH-02: pembayaran sebagian (atau lebih) ditolak."""
    harus_gagal(db, _lunas(db, nominal_dibayar=dibayar), "ck_tagihan_nominal_dibayar")


def test_OQ_08_buku_pengganti_nominal_dibayar_harus_kosong(db):
    harus_gagal(
        db,
        _lunas(db, jenis="PENGGANTIAN", cara_penyelesaian="BUKU_PENGGANTI", nominal_dibayar=10_000),
        "ck_tagihan_nominal_dibayar",
    )


# --- FK & penghapusan (FR-BKU-01, FR-BKU-02, OQ-12) -----------------------------------------


def test_FR_BKU_01_hapus_kategori_terpakai_ditolak(db):
    j = p.judul(db)
    with pytest.raises(IntegrityError) as info, db.begin_nested():
        db.execute(delete(Kategori).where(Kategori.id == j.kategori_id))
    assert info.value.orig.diag.constraint_name == "fk_judul_buku_kategori_id_kategori"


def test_FR_BKU_01_hapus_rak_terpakai_ditolak(db):
    e = p.eksemplar(db)
    with pytest.raises(IntegrityError) as info, db.begin_nested():
        db.execute(delete(Rak).where(Rak.id == e.rak_id))
    assert info.value.orig.diag.constraint_name == "fk_eksemplar_rak_id_rak"


def test_FR_BKU_01_hapus_kategori_dan_rak_tidak_terpakai_boleh(db):
    k, r = p.kategori(db), p.rak(db)
    db.execute(delete(Kategori).where(Kategori.id == k.id))
    db.execute(delete(Rak).where(Rak.id == r.id))
    db.flush()


def test_FR_BKU_02_hapus_judul_pernah_dipinjam_ditolak(db):
    e = p.eksemplar(db)
    i = p.item(db, eksemplar_id=e.id)
    i.status = "DIKEMBALIKAN"
    i.tanggal_kembali = TGL
    db.flush()
    with pytest.raises(IntegrityError) as info, db.begin_nested():
        db.execute(delete(JudulBuku).where(JudulBuku.id == e.judul_buku_id))
    assert info.value.orig.diag.constraint_name == "fk_item_transaksi_eksemplar_id_eksemplar"


def test_FR_BKU_02_hapus_judul_belum_pernah_dipinjam_boleh(db):
    """ASUMSI(OQ-12): eksemplarnya ikut terhapus."""
    j = p.judul(db)
    p.eksemplar(db, judul_buku_id=j.id)
    p.eksemplar(db, judul_buku_id=j.id)
    db.execute(delete(JudulBuku).where(JudulBuku.id == j.id))
    db.flush()
    assert db.scalars(select(Eksemplar).where(Eksemplar.judul_buku_id == j.id)).all() == []


def test_FK_referensi_tidak_ada_ditolak(db):
    harus_gagal(db, Eksemplar(judul_buku_id=999_999_999, rak_id=p.rak(db).id))
    harus_gagal(db, p.item_baru(db, eksemplar_id=999_999_999))
    harus_gagal(db, p.tagihan_baru(db, item_transaksi_id=999_999_999))


# --- Struktur skema -------------------------------------------------------------------------


def test_FR_KTL_02_indeks_trigram_pencarian_ada(db):
    rows = db.execute(
        text("SELECT indexname, indexdef FROM pg_indexes WHERE indexdef LIKE '%gin_trgm_ops%'")
    ).all()
    terindeks = {(r.indexdef.split(" ON ")[1].split()[0], r.indexdef) for r in rows}
    for tabel, kolom in [
        ("judul_buku", "judul"),
        ("judul_buku", "penulis"),
        ("judul_buku", "isbn_normal"),  # OQ-13 (WP 5.3.5)
        ("kategori", "nama"),
        ("anggota", "nama"),
    ]:
        assert any(t.endswith(tabel) and f"({kolom} gin_trgm_ops)" in d for t, d in terindeks), (
            tabel,
            kolom,
        )


def test_FR_KTL_02_pencarian_sebagian_tak_peka_huruf(db):
    p.judul(db, judul="Laskar Pelangi")
    hasil = db.scalars(select(JudulBuku.judul).where(JudulBuku.judul.ilike("%PELANG%"))).all()
    assert "Laskar Pelangi" in hasil


def test_uang_bertipe_bigint(db):
    insp = inspect(db.connection())
    kolom = {
        (t, c["name"]): str(c["type"])
        for t in ("judul_buku", "tagihan")
        for c in insp.get_columns(t)
    }
    assert kolom[("judul_buku", "harga")] == "BIGINT"
    assert kolom[("tagihan", "nominal")] == "BIGINT"
    assert kolom[("tagihan", "nominal_dibayar")] == "BIGINT"


def test_K07_tidak_ada_default_tanggal_dari_jam_db(db):
    rows = db.execute(
        text(
            "SELECT table_name, column_name, column_default FROM information_schema.columns "
            "WHERE table_schema = 'public' AND column_default IS NOT NULL"
        )
    ).all()
    terlarang = ("now(", "current_date", "current_timestamp", "localtimestamp", "clock_timestamp")
    pelanggar = [r for r in rows if any(x in r.column_default.lower() for x in terlarang)]
    assert pelanggar == []


def test_tidak_ada_kolom_di_luar_lingkup(db):
    """Syarat review 5.2.1 & domain-rules §2/§6/§13: tidak ada flag turunan atau penonaktifan."""
    terlarang = {"is_terlambat", "terlambat", "diblokir", "is_blokir", "aktif", "is_aktif"}
    insp = inspect(db.connection())
    for t in insp.get_table_names():
        assert not ({c["name"] for c in insp.get_columns(t)} & terlarang), t

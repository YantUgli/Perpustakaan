"""NFR-MNT-01: skema hanya lewat migration; rantai migration harus naik/turun bersih."""

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Engine, inspect, text

from alembic import command
from app.models import Base
from app.models.base import _indeks_ekspresi, sertakan_objek_alembic
from tests.conftest import alembic_config

TABEL_DOMAIN = {
    "admin",
    "anggota",
    "kategori",
    "rak",
    "judul_buku",
    "eksemplar",
    "transaksi_peminjaman",
    "item_transaksi",
    "tagihan",
}


def test_NFR_MNT_01_alembic_upgrade_downgrade_bersih(engine: Engine):
    cfg = alembic_config()
    command.upgrade(cfg, "head")
    assert set(inspect(engine).get_table_names()) >= TABEL_DOMAIN | {"alembic_version"}
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    assert set(inspect(engine).get_table_names()) >= TABEL_DOMAIN


def test_NFR_MNT_01_downgrade_menghapus_semua_objek(engine: Engine):
    cfg = alembic_config()
    try:
        command.downgrade(cfg, "base")
        with engine.connect() as k:
            sisa_tabel = set(inspect(k).get_table_names()) - {"alembic_version"}
            sisa_seq = (
                k.execute(text("SELECT sequence_name FROM information_schema.sequences"))
                .scalars()
                .all()
            )
        assert sisa_tabel == set()
        assert sisa_seq == []
    finally:
        command.upgrade(cfg, "head")


def test_NFR_MNT_01_model_sinkron_dengan_migration(engine: Engine):
    """Autogenerate terhadap DB di head tidak boleh menemukan perbedaan."""
    with engine.connect() as k:
        ctx = MigrationContext.configure(
            k, opts={"compare_type": True, "include_object": sertakan_objek_alembic}
        )
        beda = compare_metadata(ctx, Base.metadata)
    assert beda == []


def test_indeks_ekspresi_yang_dilewati_autogenerate_ada_di_db(engine: Engine):
    """Indeks yang dilewati filter autogenerate tetap wajib ada di DB (OQ-09)."""
    assert _indeks_ekspresi() == {
        "uq_admin_email_lower",
        "uq_anggota_email_lower",
        "uq_kategori_nama_lower",
        "uq_rak_kode_lower",
    }
    with engine.connect() as k:
        ada = set(k.execute(text("SELECT indexname FROM pg_indexes")).scalars())
    assert _indeks_ekspresi() <= ada


def test_NFR_MNT_01_alembic_check_lewat_env_py_bersih():
    """`alembic check` (memakai alembic/env.py sungguhan) tidak boleh melihat perbedaan."""
    command.check(alembic_config())

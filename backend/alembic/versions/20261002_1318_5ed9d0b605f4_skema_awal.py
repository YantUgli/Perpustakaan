"""skema awal — DR-01..DR-09 (SRS 7.1), status domain-rules §2, constraint work-plan §5.2.1.

Constraint dari keputusan sementara ditandai ASUMSI(OQ-xx); lihat docs/proyek/decisions.md.

Revision ID: 5ed9d0b605f4
Revises:
Create Date: 2026-10-02 13:18:08.598490+07:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5ed9d0b605f4"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # FR-KTL-02 / FR-AKN-10: pencarian sebagian tak peka huruf (ILIKE) memakai indeks trigram.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    # ASUMSI(OQ-03): kode AGT-/EKS- 6 digit; MAXVALUE mencegah kode terpotong.
    op.execute("CREATE SEQUENCE seq_kode_anggota START 1 MINVALUE 1 MAXVALUE 999999")
    op.execute("CREATE SEQUENCE seq_kode_eksemplar START 1 MINVALUE 1 MAXVALUE 999999")

    op.create_table(
        "admin",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("nama", sa.Text(), nullable=False),  # ASUMSI(OQ-08)
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_admin")),
    )
    # ASUMSI(OQ-09): unik tanpa peka huruf besar-kecil dan spasi tepi
    op.create_index(
        "uq_admin_email_lower", "admin", [sa.literal_column("lower(trim(email))")], unique=True
    )
    op.create_table(
        "anggota",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "kode",
            sa.String(length=10),
            server_default=sa.text("'AGT-' || lpad(nextval('seq_kode_anggota')::text, 6, '0')"),
            nullable=False,
        ),
        sa.Column("nik", sa.Text(), nullable=False),
        sa.Column("nama", sa.Text(), nullable=False),
        sa.Column("alamat", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("telepon", sa.Text(), nullable=False),
        sa.Column("foto_path", sa.Text(), nullable=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("tanggal_daftar", sa.Date(), nullable=False),
        sa.CheckConstraint("kode ~ '^AGT-[0-9]{6}$'", name=op.f("ck_anggota_kode_format")),
        sa.CheckConstraint("nik ~ '^[0-9]{16}$'", name=op.f("ck_anggota_nik_16_digit")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_anggota")),
        sa.UniqueConstraint("kode", name=op.f("uq_anggota_kode")),
        sa.UniqueConstraint("nik", name=op.f("uq_anggota_nik")),
    )
    op.create_index(
        "ix_anggota_nama_trgm",
        "anggota",
        ["nama"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"nama": "gin_trgm_ops"},
    )
    # ASUMSI(OQ-09): unik tanpa peka huruf besar-kecil dan spasi tepi
    op.create_index(
        "uq_anggota_email_lower", "anggota", [sa.literal_column("lower(trim(email))")], unique=True
    )
    op.create_table(
        "kategori",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("nama", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_kategori")),
    )
    op.create_index(
        "ix_kategori_nama_trgm",
        "kategori",
        ["nama"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"nama": "gin_trgm_ops"},
    )
    # ASUMSI(OQ-09): unik tanpa peka huruf besar-kecil dan spasi tepi
    op.create_index(
        "uq_kategori_nama_lower", "kategori", [sa.literal_column("lower(trim(nama))")], unique=True
    )
    op.create_table(
        "rak",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("kode", sa.Text(), nullable=False),
        sa.Column("lokasi", sa.Text(), nullable=True),  # ASUMSI(OQ-08)
        sa.PrimaryKeyConstraint("id", name=op.f("pk_rak")),
    )
    # ASUMSI(OQ-08, OQ-09): kode rak wajib, unik tanpa peka huruf besar-kecil
    op.create_index(
        "uq_rak_kode_lower", "rak", [sa.literal_column("lower(trim(kode))")], unique=True
    )
    op.create_table(
        "judul_buku",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("isbn", sa.Text(), nullable=False),
        sa.Column("judul", sa.Text(), nullable=False),
        sa.Column("penulis", sa.Text(), nullable=False),
        sa.Column("penerbit", sa.Text(), nullable=False),  # ASUMSI(OQ-10)
        sa.Column("tahun", sa.Integer(), nullable=False),  # ASUMSI(OQ-10)
        sa.Column("kategori_id", sa.BigInteger(), nullable=False),
        sa.Column("cover_path", sa.Text(), nullable=True),  # ASUMSI(OQ-10)
        sa.Column("harga", sa.BigInteger(), nullable=False),
        sa.CheckConstraint("harga > 0", name=op.f("ck_judul_buku_harga_positif")),
        # ASUMSI(OQ-10): cukup > 0, tanpa membandingkan tahun berjalan dari jam DB (K-07)
        sa.CheckConstraint("tahun > 0", name=op.f("ck_judul_buku_tahun_positif")),
        sa.ForeignKeyConstraint(
            ["kategori_id"],
            ["kategori.id"],
            name=op.f("fk_judul_buku_kategori_id_kategori"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_judul_buku")),
        sa.UniqueConstraint("isbn", name=op.f("uq_judul_buku_isbn")),
    )
    op.create_index(
        "ix_judul_buku_isbn_trgm",
        "judul_buku",
        ["isbn"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"isbn": "gin_trgm_ops"},
    )
    op.create_index(
        "ix_judul_buku_judul_trgm",
        "judul_buku",
        ["judul"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"judul": "gin_trgm_ops"},
    )
    op.create_index(op.f("ix_judul_buku_kategori_id"), "judul_buku", ["kategori_id"], unique=False)
    op.create_index(
        "ix_judul_buku_penulis_trgm",
        "judul_buku",
        ["penulis"],
        unique=False,
        postgresql_using="gin",
        postgresql_ops={"penulis": "gin_trgm_ops"},
    )
    op.create_table(
        "transaksi_peminjaman",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("anggota_id", sa.BigInteger(), nullable=False),
        sa.Column("admin_id", sa.BigInteger(), nullable=False),
        sa.Column("tanggal_transaksi", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.CheckConstraint(
            "status IN ('AKTIF', 'SELESAI')", name=op.f("ck_transaksi_peminjaman_status")
        ),
        sa.ForeignKeyConstraint(
            ["admin_id"],
            ["admin.id"],
            name=op.f("fk_transaksi_peminjaman_admin_id_admin"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["anggota_id"],
            ["anggota.id"],
            name=op.f("fk_transaksi_peminjaman_anggota_id_anggota"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_transaksi_peminjaman")),
    )
    op.create_index(
        op.f("ix_transaksi_peminjaman_admin_id"), "transaksi_peminjaman", ["admin_id"], unique=False
    )
    op.create_index(
        op.f("ix_transaksi_peminjaman_anggota_id"),
        "transaksi_peminjaman",
        ["anggota_id"],
        unique=False,
    )
    op.create_table(
        "eksemplar",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column(
            "kode",
            sa.String(length=10),
            server_default=sa.text("'EKS-' || lpad(nextval('seq_kode_eksemplar')::text, 6, '0')"),
            nullable=False,
        ),
        sa.Column("judul_buku_id", sa.BigInteger(), nullable=False),
        sa.Column("rak_id", sa.BigInteger(), nullable=False),  # ASUMSI(OQ-10)
        sa.Column("status", sa.String(length=20), server_default="TERSEDIA", nullable=False),
        sa.CheckConstraint("kode ~ '^EKS-[0-9]{6}$'", name=op.f("ck_eksemplar_kode_format")),
        sa.CheckConstraint(
            "status IN ('TERSEDIA', 'DIPINJAM', 'HILANG', 'RUSAK')",
            name=op.f("ck_eksemplar_status"),
        ),
        # ASUMSI(OQ-12): CASCADE; judul yang pernah dipinjam tertahan FK item_transaksi → eksemplar
        sa.ForeignKeyConstraint(
            ["judul_buku_id"],
            ["judul_buku.id"],
            name=op.f("fk_eksemplar_judul_buku_id_judul_buku"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["rak_id"], ["rak.id"], name=op.f("fk_eksemplar_rak_id_rak"), ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_eksemplar")),
        sa.UniqueConstraint("kode", name=op.f("uq_eksemplar_kode")),
    )
    op.create_index(
        op.f("ix_eksemplar_judul_buku_id"), "eksemplar", ["judul_buku_id"], unique=False
    )
    op.create_index(op.f("ix_eksemplar_rak_id"), "eksemplar", ["rak_id"], unique=False)
    op.create_table(
        "item_transaksi",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("transaksi_id", sa.BigInteger(), nullable=False),
        sa.Column("eksemplar_id", sa.BigInteger(), nullable=False),
        sa.Column("tanggal_pinjam", sa.Date(), nullable=False),
        sa.Column("jatuh_tempo", sa.Date(), nullable=False),
        sa.Column("tanggal_kembali", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("tanggal_kejadian", sa.Date(), nullable=True),
        sa.Column("keterangan", sa.Text(), nullable=True),
        sa.Column("admin_pencatat_id", sa.BigInteger(), nullable=True),
        # DR-08/FR-HLR-03; ASUMSI(OQ-10): keterangan hilang/rusak wajib dan tidak kosong
        sa.CheckConstraint(
            "(status IN ('DIPINJAM', 'DIKEMBALIKAN') AND (tanggal_kembali IS NOT NULL) = (status = 'DIKEMBALIKAN') AND tanggal_kejadian IS NULL AND keterangan IS NULL AND admin_pencatat_id IS NULL) OR (status IN ('HILANG', 'RUSAK') AND tanggal_kembali IS NULL AND tanggal_kejadian IS NOT NULL AND admin_pencatat_id IS NOT NULL AND keterangan IS NOT NULL AND btrim(keterangan) <> '')",
            name=op.f("ck_item_transaksi_konsistensi_status"),
        ),
        sa.CheckConstraint(
            "status IN ('DIPINJAM', 'DIKEMBALIKAN', 'HILANG', 'RUSAK')",
            name=op.f("ck_item_transaksi_status"),
        ),
        sa.CheckConstraint(
            "jatuh_tempo = tanggal_pinjam + 30", name=op.f("ck_item_transaksi_jatuh_tempo_30_hari")
        ),
        sa.CheckConstraint(
            "tanggal_kembali IS NULL OR tanggal_kembali >= tanggal_pinjam",
            name=op.f("ck_item_transaksi_kembali_setelah_pinjam"),
        ),
        sa.ForeignKeyConstraint(
            ["admin_pencatat_id"],
            ["admin.id"],
            name=op.f("fk_item_transaksi_admin_pencatat_id_admin"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["eksemplar_id"],
            ["eksemplar.id"],
            name=op.f("fk_item_transaksi_eksemplar_id_eksemplar"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["transaksi_id"],
            ["transaksi_peminjaman.id"],
            name=op.f("fk_item_transaksi_transaksi_id_transaksi_peminjaman"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_item_transaksi")),
        sa.UniqueConstraint(
            "transaksi_id", "eksemplar_id", name="uq_item_transaksi_transaksi_eksemplar"
        ),
    )
    op.create_index(
        op.f("ix_item_transaksi_eksemplar_id"), "item_transaksi", ["eksemplar_id"], unique=False
    )
    op.create_index(
        op.f("ix_item_transaksi_transaksi_id"), "item_transaksi", ["transaksi_id"], unique=False
    )
    op.create_index(
        "uq_item_transaksi_pinjaman_aktif",
        "item_transaksi",
        ["eksemplar_id"],
        unique=True,
        postgresql_where=sa.text("status = 'DIPINJAM'"),
    )
    op.create_table(
        "tagihan",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("item_transaksi_id", sa.BigInteger(), nullable=False),
        sa.Column("jenis", sa.String(length=20), nullable=False),
        sa.Column("nominal", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("tanggal_dibentuk", sa.Date(), nullable=False),  # ASUMSI(OQ-08, OQ-11)
        sa.Column("cara_penyelesaian", sa.String(length=20), nullable=True),
        sa.Column("nominal_dibayar", sa.BigInteger(), nullable=True),  # ASUMSI(OQ-08)
        sa.Column("tanggal_penyelesaian", sa.Date(), nullable=True),
        sa.Column("admin_pengonfirmasi_id", sa.BigInteger(), nullable=True),
        sa.CheckConstraint(
            "(status = 'LUNAS') = (cara_penyelesaian IS NOT NULL) AND (status = 'LUNAS') = (tanggal_penyelesaian IS NOT NULL) AND (status = 'LUNAS') = (admin_pengonfirmasi_id IS NOT NULL)",
            name=op.f("ck_tagihan_konsistensi_penyelesaian"),
        ),
        # ASUMSI(OQ-08) + FR-TGH-02: bayar uang harus sama persis; Buku Pengganti tanpa nominal
        sa.CheckConstraint(
            "CASE WHEN cara_penyelesaian IN ('TUNAI', 'TRANSFER') THEN nominal_dibayar IS NOT NULL AND nominal_dibayar = nominal ELSE nominal_dibayar IS NULL END",
            name=op.f("ck_tagihan_nominal_dibayar"),
        ),
        sa.CheckConstraint(
            "cara_penyelesaian IN ('TUNAI', 'TRANSFER', 'BUKU_PENGGANTI')",
            name=op.f("ck_tagihan_cara_penyelesaian"),
        ),
        sa.CheckConstraint(
            "cara_penyelesaian IS DISTINCT FROM 'BUKU_PENGGANTI' OR jenis = 'PENGGANTIAN'",
            name=op.f("ck_tagihan_buku_pengganti_hanya_penggantian"),
        ),
        sa.CheckConstraint("jenis IN ('DENDA', 'PENGGANTIAN')", name=op.f("ck_tagihan_jenis")),
        sa.CheckConstraint("status IN ('BELUM_LUNAS', 'LUNAS')", name=op.f("ck_tagihan_status")),
        sa.CheckConstraint("nominal > 0", name=op.f("ck_tagihan_nominal_positif")),
        sa.ForeignKeyConstraint(
            ["admin_pengonfirmasi_id"],
            ["admin.id"],
            name=op.f("fk_tagihan_admin_pengonfirmasi_id_admin"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["item_transaksi_id"],
            ["item_transaksi.id"],
            name=op.f("fk_tagihan_item_transaksi_id_item_transaksi"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tagihan")),
        sa.UniqueConstraint("item_transaksi_id", name=op.f("uq_tagihan_item_transaksi_id")),
    )
    op.create_index(op.f("ix_tagihan_status"), "tagihan", ["status"], unique=False)
    op.create_index(
        op.f("ix_tagihan_tanggal_dibentuk"), "tagihan", ["tanggal_dibentuk"], unique=False
    )

    op.execute("ALTER SEQUENCE seq_kode_anggota OWNED BY anggota.kode")
    op.execute("ALTER SEQUENCE seq_kode_eksemplar OWNED BY eksemplar.kode")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_tagihan_tanggal_dibentuk"), table_name="tagihan")
    op.drop_index(op.f("ix_tagihan_status"), table_name="tagihan")
    op.drop_table("tagihan")
    op.drop_index(
        "uq_item_transaksi_pinjaman_aktif",
        table_name="item_transaksi",
        postgresql_where=sa.text("status = 'DIPINJAM'"),
    )
    op.drop_index(op.f("ix_item_transaksi_transaksi_id"), table_name="item_transaksi")
    op.drop_index(op.f("ix_item_transaksi_eksemplar_id"), table_name="item_transaksi")
    op.drop_table("item_transaksi")
    op.drop_index(op.f("ix_eksemplar_rak_id"), table_name="eksemplar")
    op.drop_index(op.f("ix_eksemplar_judul_buku_id"), table_name="eksemplar")
    op.drop_table("eksemplar")
    op.drop_index(op.f("ix_transaksi_peminjaman_anggota_id"), table_name="transaksi_peminjaman")
    op.drop_index(op.f("ix_transaksi_peminjaman_admin_id"), table_name="transaksi_peminjaman")
    op.drop_table("transaksi_peminjaman")
    op.drop_index(
        "ix_judul_buku_penulis_trgm",
        table_name="judul_buku",
        postgresql_using="gin",
        postgresql_ops={"penulis": "gin_trgm_ops"},
    )
    op.drop_index(op.f("ix_judul_buku_kategori_id"), table_name="judul_buku")
    op.drop_index(
        "ix_judul_buku_judul_trgm",
        table_name="judul_buku",
        postgresql_using="gin",
        postgresql_ops={"judul": "gin_trgm_ops"},
    )
    op.drop_index(
        "ix_judul_buku_isbn_trgm",
        table_name="judul_buku",
        postgresql_using="gin",
        postgresql_ops={"isbn": "gin_trgm_ops"},
    )
    op.drop_table("judul_buku")
    op.drop_index("uq_rak_kode_lower", table_name="rak")
    op.drop_table("rak")
    op.drop_index("uq_kategori_nama_lower", table_name="kategori")
    op.drop_index(
        "ix_kategori_nama_trgm",
        table_name="kategori",
        postgresql_using="gin",
        postgresql_ops={"nama": "gin_trgm_ops"},
    )
    op.drop_table("kategori")
    op.drop_index("uq_anggota_email_lower", table_name="anggota")
    op.drop_index(
        "ix_anggota_nama_trgm",
        table_name="anggota",
        postgresql_using="gin",
        postgresql_ops={"nama": "gin_trgm_ops"},
    )
    op.drop_table("anggota")
    op.drop_index("uq_admin_email_lower", table_name="admin")
    op.drop_table("admin")
    # Sequence OWNED BY ikut terhapus bersama tabelnya; IF EXISTS untuk berjaga.
    op.execute("DROP SEQUENCE IF EXISTS seq_kode_eksemplar")
    op.execute("DROP SEQUENCE IF EXISTS seq_kode_anggota")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")

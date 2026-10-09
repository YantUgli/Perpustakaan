"""deskripsi judul — OQ-46 (change request, di luar DR-05), susulan WP 5.3.5.

Kolom opsional `judul_buku.deskripsi`; judul lama bernilai NULL. Batas 2.000 karakter diperiksa
service (pesan spesifik), bukan CHECK. Tanpa indeks: deskripsi tidak ikut pencarian (OQ-24).

Revision ID: 380c3a1b87be
Revises: 485a69c0f745
Create Date: 2026-10-09 10:04:37.924501+07:00

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "380c3a1b87be"
down_revision: str | Sequence[str] | None = "485a69c0f745"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("judul_buku", sa.Column("deskripsi", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("judul_buku", "deskripsi")

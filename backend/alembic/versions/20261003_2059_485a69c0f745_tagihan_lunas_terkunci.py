"""tagihan lunas terkunci — FR-TGH-06 di lapis DB (WP 5.3.11, lanjutan 5.2.1).

Trigger menolak UPDATE dan DELETE baris tagihan yang `OLD.status = 'LUNAS'`. Transisi
Belum Lunas → Lunas tetap lolos (OLD masih Belum Lunas). Service lebih dulu menolak dengan
`TGH_SUDAH_LUNAS`; pesan trigger teknis dan diterjemahkan service bila terpicu akibat balapan
(penanda `tagihan_lunas_terkunci`). TRUNCATE tidak memicu trigger baris (dipakai teardown test).
Ditulis manual: autogenerate tidak mendeteksi fungsi/trigger.

Revision ID: 485a69c0f745
Revises: 8ead55e364f2
Create Date: 2026-10-03 20:59:51.151421+07:00

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "485a69c0f745"
down_revision: str | Sequence[str] | None = "8ead55e364f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        CREATE FUNCTION tolak_ubah_tagihan_lunas() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            IF OLD.status = 'LUNAS' THEN
                RAISE EXCEPTION 'tagihan_lunas_terkunci: tagihan % sudah LUNAS (%)',
                    OLD.id, TG_OP
                    USING HINT = 'FR-TGH-06: tagihan Lunas tidak dapat diubah atau dihapus.';
            END IF;
            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END;
        $$
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_tagihan_lunas_terkunci
        BEFORE UPDATE OR DELETE ON tagihan
        FOR EACH ROW EXECUTE FUNCTION tolak_ubah_tagihan_lunas()
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TRIGGER trg_tagihan_lunas_terkunci ON tagihan")
    op.execute("DROP FUNCTION tolak_ubah_tagihan_lunas()")

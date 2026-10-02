"""Sequence untuk kode yang tampil ke pengguna. ASUMSI(OQ-03).

MAXVALUE 999999 sesuai format 6 digit: bila habis, insert gagal jelas, bukan kode terpotong.
"""

from sqlalchemy import Sequence

from app.models.base import Base

SEQ_KODE_ANGGOTA = Sequence(
    "seq_kode_anggota", start=1, minvalue=1, maxvalue=999_999, metadata=Base.metadata
)
SEQ_KODE_EKSEMPLAR = Sequence(
    "seq_kode_eksemplar", start=1, minvalue=1, maxvalue=999_999, metadata=Base.metadata
)

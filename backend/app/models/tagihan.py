"""DR-09 Tagihan."""

from datetime import date

from sqlalchemy import BigInteger, CheckConstraint, Date, ForeignKey, Identity, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.status import CaraPenyelesaian, JenisTagihan, StatusTagihan, ck_nilai


class Tagihan(Base):
    __tablename__ = "tagihan"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    # SRS 7.1: satu item transaksi paling banyak satu tagihan
    item_transaksi_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("item_transaksi.id", ondelete="RESTRICT"), unique=True
    )
    jenis: Mapped[str] = mapped_column(String(20))
    # Disimpan saat dibentuk; tidak dihitung ulang bila harga judul berubah (SRS 7.1)
    nominal: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(20), index=True)
    # ASUMSI(OQ-08, OQ-11): diisi service dari hari_ini_wib(); dasar filter laporan FR-LAP-03
    tanggal_dibentuk: Mapped[date] = mapped_column(Date, index=True)
    cara_penyelesaian: Mapped[str | None] = mapped_column(String(20))
    # ASUMSI(OQ-08): nominal yang dibayar; = nominal untuk Tunai/Transfer, NULL untuk Buku Pengganti
    nominal_dibayar: Mapped[int | None] = mapped_column(BigInteger)
    # FR-TGH-05; ASUMSI(OQ-08): juga tanggal penerimaan buku pengganti (FR-TGH-03)
    tanggal_penyelesaian: Mapped[date | None] = mapped_column(Date)
    admin_pengonfirmasi_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("admin.id", ondelete="RESTRICT")
    )

    __table_args__ = (
        ck_nilai("jenis", JenisTagihan),
        ck_nilai("status", StatusTagihan),
        ck_nilai("cara_penyelesaian", CaraPenyelesaian),
        CheckConstraint("nominal > 0", name="nominal_positif"),  # FR-KMB-06: dibentuk bila > 0
        # FR-TGH-03: Buku Pengganti hanya untuk tagihan Penggantian
        CheckConstraint(
            "cara_penyelesaian IS DISTINCT FROM 'BUKU_PENGGANTI' OR jenis = 'PENGGANTIAN'",
            name="buku_pengganti_hanya_penggantian",
        ),
        # FR-TGH-05: Lunas ⇔ cara, tanggal, dan admin pengonfirmasi tercatat
        CheckConstraint(
            "(status = 'LUNAS') = (cara_penyelesaian IS NOT NULL)"
            " AND (status = 'LUNAS') = (tanggal_penyelesaian IS NOT NULL)"
            " AND (status = 'LUNAS') = (admin_pengonfirmasi_id IS NOT NULL)",
            name="konsistensi_penyelesaian",
        ),
        # ASUMSI(OQ-08) + FR-TGH-02: uang harus sama persis; selain itu nominal_dibayar NULL
        CheckConstraint(
            "CASE WHEN cara_penyelesaian IN ('TUNAI', 'TRANSFER')"
            " THEN nominal_dibayar IS NOT NULL AND nominal_dibayar = nominal"
            " ELSE nominal_dibayar IS NULL END",
            name="nominal_dibayar",
        ),
    )

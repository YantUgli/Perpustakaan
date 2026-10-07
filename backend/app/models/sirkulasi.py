"""DR-07 Transaksi peminjaman, DR-08 Item transaksi."""

from datetime import date

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    ForeignKey,
    Identity,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.status import StatusItem, StatusTransaksi, ck_nilai


class TransaksiPeminjaman(Base):
    __tablename__ = "transaksi_peminjaman"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    anggota_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("anggota.id", ondelete="RESTRICT"), index=True
    )
    admin_id: Mapped[int] = mapped_column(  # admin pemroses (FR-PJM-10)
        BigInteger, ForeignKey("admin.id", ondelete="RESTRICT"), index=True
    )
    tanggal_transaksi: Mapped[date] = mapped_column(Date)  # dari hari_ini_wib() (K-07)
    status: Mapped[str] = mapped_column(String(20))

    __table_args__ = (ck_nilai("status", StatusTransaksi),)


class ItemTransaksi(Base):
    __tablename__ = "item_transaksi"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    transaksi_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("transaksi_peminjaman.id", ondelete="RESTRICT"), index=True
    )
    # RESTRICT: eksemplar yang punya riwayat pinjam (dan judulnya) tak bisa dihapus (FR-BKU-02)
    eksemplar_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("eksemplar.id", ondelete="RESTRICT"), index=True
    )
    tanggal_pinjam: Mapped[date] = mapped_column(Date)
    jatuh_tempo: Mapped[date] = mapped_column(Date)
    tanggal_kembali: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20))
    # FR-HLR-03: data pencatatan hilang/rusak
    tanggal_kejadian: Mapped[date | None] = mapped_column(Date)
    keterangan: Mapped[str | None] = mapped_column(Text)
    admin_pencatat_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("admin.id", ondelete="RESTRICT")
    )

    __table_args__ = (
        ck_nilai("status", StatusItem),
        # FR-PJM-11: jatuh tempo = tanggal pinjam + 30 hari kalender
        CheckConstraint("jatuh_tempo = tanggal_pinjam + 30", name="jatuh_tempo_30_hari"),
        CheckConstraint(
            "tanggal_kembali IS NULL OR tanggal_kembali >= tanggal_pinjam",
            name="kembali_setelah_pinjam",
        ),
        # DR-08/FR-KMB-05/FR-HLR-03: data pendukung sesuai status.
        # ASUMSI(OQ-10): keterangan hilang/rusak wajib dan tidak kosong.
        CheckConstraint(
            "(status IN ('DIPINJAM', 'DIKEMBALIKAN')"
            " AND (tanggal_kembali IS NOT NULL) = (status = 'DIKEMBALIKAN')"
            " AND tanggal_kejadian IS NULL AND keterangan IS NULL AND admin_pencatat_id IS NULL)"
            " OR (status IN ('HILANG', 'RUSAK')"
            " AND tanggal_kembali IS NULL AND tanggal_kejadian IS NOT NULL"
            " AND admin_pencatat_id IS NOT NULL"
            " AND keterangan IS NOT NULL AND btrim(keterangan) <> '')",
            name="konsistensi_status",
        ),
        # FR-PJM-07: eksemplar yang sama tidak boleh dua kali dalam satu transaksi
        UniqueConstraint(
            "transaksi_id", "eksemplar_id", name="uq_item_transaksi_transaksi_eksemplar"
        ),
        # NFR-REL-02 (lapis DB): paling banyak satu pinjaman aktif per eksemplar
        Index(
            "uq_item_transaksi_pinjaman_aktif",
            "eksemplar_id",
            unique=True,
            postgresql_where=text("status = 'DIPINJAM'"),
        ),
    )

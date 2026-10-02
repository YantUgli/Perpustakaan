"""DR-01 Admin, DR-02 Anggota."""

from datetime import date

from sqlalchemy import BigInteger, CheckConstraint, Date, Identity, Index, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.sekuens import SEQ_KODE_ANGGOTA


class Admin(Base):
    """Akun admin; hanya dibuat lewat seed (FR-AKN-12, K-04)."""

    __tablename__ = "admin"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    nama: Mapped[str] = mapped_column(Text)  # ASUMSI(OQ-08): nama admin wajib
    email: Mapped[str] = mapped_column(Text)
    password_hash: Mapped[str] = mapped_column(Text)  # NFR-SEC-01

    __table_args__ = (
        # ASUMSI(OQ-09): email unik tanpa peka huruf besar-kecil dan spasi tepi
        Index("uq_admin_email_lower", func.lower(func.trim(email)), unique=True),
    )


class Anggota(Base):
    __tablename__ = "anggota"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    # ASUMSI(OQ-03): AGT-000001, berurutan dari sequence DB
    kode: Mapped[str] = mapped_column(
        String(10),
        unique=True,
        server_default=text(f"'AGT-' || lpad(nextval('{SEQ_KODE_ANGGOTA.name}')::text, 6, '0')"),
    )
    nik: Mapped[str] = mapped_column(Text, unique=True)
    nama: Mapped[str] = mapped_column(Text)
    alamat: Mapped[str] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text)
    telepon: Mapped[str] = mapped_column(Text)
    foto_path: Mapped[str | None] = mapped_column(Text)  # opsional; tidak bisa diubah (K-05)
    password_hash: Mapped[str] = mapped_column(Text)  # NFR-SEC-01
    tanggal_daftar: Mapped[date] = mapped_column(Date)  # diisi service dari hari_ini_wib() (K-07)

    __table_args__ = (
        CheckConstraint("nik ~ '^[0-9]{16}$'", name="nik_16_digit"),  # FR-AKN-03
        CheckConstraint("kode ~ '^AGT-[0-9]{6}$'", name="kode_format"),  # ASUMSI(OQ-03)
        # ASUMSI(OQ-09): email unik tanpa peka huruf besar-kecil dan spasi tepi
        Index("uq_anggota_email_lower", func.lower(func.trim(email)), unique=True),
        # FR-AKN-10: cari anggota berdasarkan nama (sebagian, tak peka huruf)
        Index(
            "ix_anggota_nama_trgm",
            "nama",
            postgresql_using="gin",
            postgresql_ops={"nama": "gin_trgm_ops"},
        ),
    )

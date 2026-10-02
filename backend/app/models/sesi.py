"""Sesi login (OQ-04, NFR-SEC-04). Tabel teknis, bukan entitas DR-01..09."""

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Identity, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.status import Role, ck_nilai


class Sesi(Base):
    """Satu baris per perangkat yang login. ASUMSI(OQ-17): satu akun boleh punya beberapa sesi."""

    __tablename__ = "sesi"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    # ASUMSI(OQ-04): hanya hash SHA-256 token yang disimpan; token asli hanya ada di cookie.
    token_hash: Mapped[str] = mapped_column(Text, unique=True)
    role: Mapped[str] = mapped_column(String(20))
    admin_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("admin.id", ondelete="CASCADE"), index=True
    )
    anggota_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("anggota.id", ondelete="CASCADE"), index=True
    )
    # Diisi dari Python (app/core/waktu.py), bukan now() basis data, agar bisa dipatok di test.
    dibuat_pada: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    terakhir_aktif: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    __table_args__ = (
        ck_nilai("role", Role),
        CheckConstraint(
            "(role = 'ADMIN' AND admin_id IS NOT NULL AND anggota_id IS NULL)"
            " OR (role = 'ANGGOTA' AND anggota_id IS NOT NULL AND admin_id IS NULL)",
            name="pemilik_sesuai_role",
        ),
    )

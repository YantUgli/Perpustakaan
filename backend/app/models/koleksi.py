"""DR-03 Kategori, DR-04 Rak, DR-05 Judul buku, DR-06 Eksemplar."""

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Computed,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.sekuens import SEQ_KODE_EKSEMPLAR
from app.models.status import StatusEksemplar, ck_nilai

ISBN_NORMAL_SQL = "upper(regexp_replace(isbn, '[-[:space:]]', '', 'g'))"


def _trgm(nama: str, kolom: str) -> Index:
    """Indeks GIN trigram: pencarian sebagian & tak peka huruf via ILIKE (FR-KTL-02, NFR-PRF-01)."""
    return Index(nama, kolom, postgresql_using="gin", postgresql_ops={kolom: "gin_trgm_ops"})


class Kategori(Base):
    __tablename__ = "kategori"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    nama: Mapped[str] = mapped_column(Text)

    __table_args__ = (
        # ASUMSI(OQ-09): nama unik tanpa peka huruf besar-kecil dan spasi tepi
        Index("uq_kategori_nama_lower", func.lower(func.trim(nama)), unique=True),
        _trgm("ix_kategori_nama_trgm", "nama"),
    )


class Rak(Base):
    __tablename__ = "rak"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    kode: Mapped[str] = mapped_column(Text)
    lokasi: Mapped[str | None] = mapped_column(Text)  # ASUMSI(OQ-08): lokasi opsional

    __table_args__ = (
        # ASUMSI(OQ-08, OQ-09): kode wajib, unik tanpa peka huruf besar-kecil
        Index("uq_rak_kode_lower", func.lower(func.trim(kode)), unique=True),
    )


class JudulBuku(Base):
    __tablename__ = "judul_buku"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    isbn: Mapped[str] = mapped_column(Text)  # ASUMSI(OQ-06): wajib, teks seperti diketik admin
    # ASUMSI(OQ-13): keunikan & pencarian ISBN memakai bentuk ternormalisasi (tanpa tanda
    # hubung/spasi, x → X). Harus sama dengan app.core.validasi.normalisasi_isbn.
    isbn_normal: Mapped[str] = mapped_column(
        Text, Computed(ISBN_NORMAL_SQL, persisted=True), unique=True
    )
    judul: Mapped[str] = mapped_column(Text)
    penulis: Mapped[str] = mapped_column(Text)
    penerbit: Mapped[str] = mapped_column(Text)  # ASUMSI(OQ-10): wajib
    tahun: Mapped[int] = mapped_column(Integer)  # ASUMSI(OQ-10): wajib
    # ASUMSI(OQ-05): satu kategori per judul. RESTRICT: kategori terpakai tak bisa dihapus
    kategori_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("kategori.id", ondelete="RESTRICT"), index=True
    )
    cover_path: Mapped[str | None] = mapped_column(Text)  # ASUMSI(OQ-10): opsional
    # ASUMSI(OQ-46, CR di luar DR-05): opsional, maks 2.000 karakter (diperiksa service)
    deskripsi: Mapped[str | None] = mapped_column(Text)
    # Hanya arah judul → kategori (tanpa backref): menghapus kategori tidak menyentuh judul di ORM,
    # sehingga FK RESTRICT yang menolak bila kategori masih dipakai (FR-BKU-01).
    kategori: Mapped[Kategori] = relationship()
    harga: Mapped[int] = mapped_column(BigInteger)  # Rupiah bulat; berlaku untuk semua eksemplar

    __table_args__ = (
        CheckConstraint("harga > 0", name="harga_positif"),  # DR-05
        # ASUMSI(OQ-10): cukup > 0; tidak dibandingkan dengan tahun berjalan dari jam DB (K-07)
        CheckConstraint("tahun > 0", name="tahun_positif"),
        _trgm("ix_judul_buku_judul_trgm", "judul"),
        _trgm("ix_judul_buku_penulis_trgm", "penulis"),
        _trgm("ix_judul_buku_isbn_normal_trgm", "isbn_normal"),  # OQ-13
    )


class Eksemplar(Base):
    __tablename__ = "eksemplar"

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    # ASUMSI(OQ-03): EKS-000001, berurutan dari sequence DB
    kode: Mapped[str] = mapped_column(
        String(10),
        unique=True,
        server_default=text(f"'EKS-' || lpad(nextval('{SEQ_KODE_EKSEMPLAR.name}')::text, 6, '0')"),
    )
    # ASUMSI(OQ-12): CASCADE — judul yang belum pernah dipinjam boleh dihapus beserta eksemplarnya;
    # judul yang pernah dipinjam tertahan oleh FK item_transaksi → eksemplar (RESTRICT).
    judul_buku_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("judul_buku.id", ondelete="CASCADE"), index=True
    )
    # ASUMSI(OQ-10): rak wajib. RESTRICT: rak terpakai tak bisa dihapus (FR-BKU-01)
    rak_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("rak.id", ondelete="RESTRICT"), index=True
    )
    rak: Mapped[Rak] = relationship()  # satu arah (tanpa backref), sama seperti JudulBuku.kategori
    status: Mapped[str] = mapped_column(
        String(20),
        server_default=StatusEksemplar.TERSEDIA.value,  # FR-BKU-04
    )

    __table_args__ = (
        ck_nilai("status", StatusEksemplar),
        CheckConstraint("kode ~ '^EKS-[0-9]{6}$'", name="kode_format"),  # ASUMSI(OQ-03)
    )

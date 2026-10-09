"""Kategori, rak, judul buku: FR-BKU-01..03, DR-03..05, NFR-SEC-06 (cover).

Pola: periksa aturan di service dulu (pesan spesifik), lalu commit. Bila balapan membuat
constraint DB yang menolak, IntegrityError diterjemahkan ke galat yang sama — pesan mentah
PostgreSQL tidak bocor ke klien.
"""

from dataclasses import dataclass
from types import EllipsisType
from typing import BinaryIO

from sqlalchemy import exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.galat import GalatBisnis
from app.core.validasi import isbn_bentuk_valid, normalisasi_isbn
from app.models import Eksemplar, ItemTransaksi, JudulBuku, Kategori, Rak
from app.services import berkas, katalog

# --------------------------------------------------------------------------------------- galat


def _tidak_ada(kode: str, pesan: str, rujukan: str) -> GalatBisnis:
    return GalatBisnis(kode=kode, pesan=pesan, rujukan=rujukan, status_code=404)


def _konflik(kode: str, pesan: str, rujukan: str) -> GalatBisnis:
    return GalatBisnis(kode=kode, pesan=pesan, rujukan=rujukan, status_code=409)


def _tidak_valid(kode: str, pesan: str, rujukan: str) -> GalatBisnis:
    return GalatBisnis(kode=kode, pesan=pesan, rujukan=rujukan, status_code=422)


def _nama_constraint(exc: IntegrityError) -> str | None:
    diag = getattr(exc.orig, "diag", None)
    return getattr(diag, "constraint_name", None)


def _commit(db: Session, terjemahan: dict[str, GalatBisnis]) -> None:
    """Commit; IntegrityError dari constraint yang dikenal → galat bisnis yang sudah disiapkan."""
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        galat = terjemahan.get(_nama_constraint(exc) or "")
        if galat is None:
            raise
        raise galat from exc


def _wajib_isi(rujukan: str, **isian: str | None) -> dict[str, str]:
    """ASUMSI(OQ-10): isian wajib di-trim dan tidak boleh kosong. `rujukan` = FR pemanggil."""
    hasil = {k: (v or "").strip() for k, v in isian.items()}
    kosong = [k for k, v in hasil.items() if not v]
    if kosong:
        raise _tidak_valid(
            "BKU_ISIAN_KOSONG", f"Isian wajib belum diisi: {', '.join(kosong)}.", rujukan
        )
    return hasil


# --------------------------------------------------------------------------------------- kategori


def _galat_kategori_duplikat(nama: str) -> GalatBisnis:
    return _konflik("BKU_KATEGORI_DUPLIKAT", f"Kategori '{nama}' sudah ada.", "DR-03")


def _galat_kategori_dipakai(nama: str, jumlah: int) -> GalatBisnis:
    return _konflik(
        "BKU_KATEGORI_DIPAKAI",
        f"Kategori '{nama}' masih dipakai oleh {jumlah} judul buku.",
        "FR-BKU-01",
    )


def _kategori(db: Session, kategori_id: int) -> Kategori:
    k = db.get(Kategori, kategori_id)
    if k is None:
        raise _tidak_ada("BKU_KATEGORI_TIDAK_ADA", "Kategori tidak ditemukan.", "FR-BKU-01")
    return k


def _kategori_bernama(db: Session, nama: str, kecuali_id: int | None = None) -> Kategori | None:
    """ASUMSI(OQ-09): nama unik tanpa peka huruf besar-kecil."""
    q = select(Kategori).where(func.lower(func.trim(Kategori.nama)) == nama.lower())
    if kecuali_id is not None:
        q = q.where(Kategori.id != kecuali_id)
    return db.scalar(q)


def _jumlah_judul_kategori(db: Session, kategori_id: int) -> int:
    q = select(func.count()).where(JudulBuku.kategori_id == kategori_id)
    return db.scalar(q)


def daftar_kategori(db: Session) -> list[Kategori]:
    return list(db.scalars(select(Kategori).order_by(func.lower(Kategori.nama), Kategori.id)))


def simpan_kategori(db: Session, *, nama: str, kategori_id: int | None = None) -> Kategori:
    """FR-BKU-01: tambah (kategori_id None) atau ubah kategori."""
    nama = _wajib_isi("FR-BKU-01", nama=nama)["nama"]
    k = Kategori() if kategori_id is None else _kategori(db, kategori_id)
    if _kategori_bernama(db, nama, kecuali_id=kategori_id) is not None:
        raise _galat_kategori_duplikat(nama)
    k.nama = nama
    db.add(k)
    _commit(db, {"uq_kategori_nama_lower": _galat_kategori_duplikat(nama)})
    return k


def hapus_kategori(db: Session, kategori_id: int) -> None:
    """FR-BKU-01: kategori yang masih dipakai judul tidak dapat dihapus."""
    k = _kategori(db, kategori_id)
    jumlah = _jumlah_judul_kategori(db, k.id)
    if jumlah:
        raise _galat_kategori_dipakai(k.nama, jumlah)
    nama, kid = k.nama, k.id
    db.delete(k)
    try:
        db.commit()
    except IntegrityError as exc:  # balapan: judul baru dibuat setelah pemeriksaan
        db.rollback()
        if _nama_constraint(exc) != "fk_judul_buku_kategori_id_kategori":
            raise
        jumlah = db.scalar(select(func.count()).where(JudulBuku.kategori_id == kid))
        raise _galat_kategori_dipakai(nama, jumlah) from exc


# --------------------------------------------------------------------------------------- rak


def _galat_rak_duplikat(kode: str) -> GalatBisnis:
    return _konflik("BKU_RAK_DUPLIKAT", f"Kode rak '{kode}' sudah ada.", "DR-04")


def _galat_rak_dipakai(kode: str, jumlah: int) -> GalatBisnis:
    return _konflik(
        "BKU_RAK_DIPAKAI", f"Rak {kode} masih dipakai oleh {jumlah} eksemplar.", "FR-BKU-01"
    )


def _rak(db: Session, rak_id: int) -> Rak:
    r = db.get(Rak, rak_id)
    if r is None:
        raise _tidak_ada("BKU_RAK_TIDAK_ADA", "Rak tidak ditemukan.", "FR-BKU-01")
    return r


def _rak_berkode(db: Session, kode: str, kecuali_id: int | None = None) -> Rak | None:
    """ASUMSI(OQ-09): kode rak unik tanpa peka huruf besar-kecil."""
    q = select(Rak).where(func.lower(func.trim(Rak.kode)) == kode.lower())
    if kecuali_id is not None:
        q = q.where(Rak.id != kecuali_id)
    return db.scalar(q)


def _jumlah_eksemplar_rak(db: Session, rak_id: int) -> int:
    return db.scalar(select(func.count()).where(Eksemplar.rak_id == rak_id))


def daftar_rak(db: Session) -> list[Rak]:
    return list(db.scalars(select(Rak).order_by(func.lower(Rak.kode), Rak.id)))


def simpan_rak(db: Session, *, kode: str, lokasi: str | None, rak_id: int | None = None) -> Rak:
    """FR-BKU-01: tambah (rak_id None) atau ubah rak. ASUMSI(OQ-08): kode wajib, lokasi opsional."""
    kode = _wajib_isi("FR-BKU-01", kode=kode)["kode"]
    r = Rak() if rak_id is None else _rak(db, rak_id)
    if _rak_berkode(db, kode, kecuali_id=rak_id) is not None:
        raise _galat_rak_duplikat(kode)
    r.kode = kode
    r.lokasi = (lokasi or "").strip() or None
    db.add(r)
    _commit(db, {"uq_rak_kode_lower": _galat_rak_duplikat(kode)})
    return r


def hapus_rak(db: Session, rak_id: int) -> None:
    """FR-BKU-01: rak yang masih dipakai eksemplar tidak dapat dihapus."""
    r = _rak(db, rak_id)
    jumlah = _jumlah_eksemplar_rak(db, r.id)
    if jumlah:
        raise _galat_rak_dipakai(r.kode, jumlah)
    kode, rid = r.kode, r.id
    db.delete(r)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if _nama_constraint(exc) != "fk_eksemplar_rak_id_rak":
            raise
        jumlah = db.scalar(select(func.count()).where(Eksemplar.rak_id == rid))
        raise _galat_rak_dipakai(kode, jumlah) from exc


# --------------------------------------------------------------------------------------- judul


@dataclass(frozen=True)
class DataJudul:
    isbn: str
    judul: str
    penulis: str
    penerbit: str
    tahun: int
    kategori_id: int
    harga: int
    # ASUMSI(OQ-46): `...` = isian tidak dikirim → tidak diubah (judul baru: kosong)
    deskripsi: str | None | EllipsisType = ...


DESKRIPSI_MAKS = 2000  # ASUMSI(OQ-46), dihitung setelah trim


def _ribuan(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def _deskripsi_bersih(teks: str | None) -> str | None:
    """OQ-46: trim tepi (baris baru di tengah tetap); kosong → None; lebih dari batas → 422."""
    bersih = (teks or "").strip()
    if len(bersih) > DESKRIPSI_MAKS:
        pesan = (
            f"Deskripsi maksimal {_ribuan(DESKRIPSI_MAKS)} karakter "
            f"(saat ini {_ribuan(len(bersih))})."
        )
        raise GalatBisnis(
            kode="BKU_DESKRIPSI_TERLALU_PANJANG",
            pesan=pesan,
            rujukan="OQ-46",
            status_code=422,
            isian={"deskripsi": pesan},
        )
    return bersih or None


def _galat_isbn_duplikat(isbn: str, judul_pemilik: str) -> GalatBisnis:
    return _konflik(
        "BKU_ISBN_DUPLIKAT", f"ISBN {isbn} sudah dipakai oleh judul '{judul_pemilik}'.", "FR-BKU-02"
    )


def _galat_pernah_dipinjam(judul: str) -> GalatBisnis:
    return _konflik(
        "BKU_JUDUL_PERNAH_DIPINJAM",
        f"Judul '{judul}' tidak dapat dihapus karena pernah dipinjam.",
        "FR-BKU-02",
    )


def _judul(db: Session, judul_id: int) -> JudulBuku:
    j = db.get(JudulBuku, judul_id, options=[joinedload(JudulBuku.kategori)])
    if j is None:
        raise _tidak_ada("BKU_JUDUL_TIDAK_ADA", "Judul buku tidak ditemukan.", "FR-BKU-02")
    return j


def _judul_ber_isbn(db: Session, isbn: str, kecuali_id: int | None = None) -> JudulBuku | None:
    """ASUMSI(OQ-13): bandingkan bentuk ternormalisasi."""
    q = select(JudulBuku).where(JudulBuku.isbn_normal == normalisasi_isbn(isbn))
    if kecuali_id is not None:
        q = q.where(JudulBuku.id != kecuali_id)
    return db.scalar(q)


def _pernah_dipinjam(db: Session, judul_id: int) -> bool:
    """Ada item transaksi apa pun (status apa pun) untuk eksemplar judul ini."""
    q = (
        select(ItemTransaksi.id)
        .join(Eksemplar, ItemTransaksi.eksemplar_id == Eksemplar.id)
        .where(Eksemplar.judul_buku_id == judul_id)
    )
    return db.scalar(select(exists(q)))


def daftar_judul(
    db: Session, *, halaman: int, per_halaman: int, q: str | None = None
) -> tuple[list[JudulBuku], int]:
    """FR-BKU-02: daftar judul admin berhalaman, urut judul A–Z lalu id.

    ASUMSI(OQ-45): `q` opsional memakai ulang aturan katalog OQ-24 (`katalog.filter_kata_kunci`);
    tanpa `q` (atau kosong) perilaku sama dengan sebelumnya. `total` dari kondisi yang sama."""
    kondisi = [k for k in [katalog.filter_kata_kunci(q)] if k is not None]
    total = db.scalar(select(func.count()).select_from(JudulBuku).where(*kondisi))
    q_data = (
        select(JudulBuku)
        .options(joinedload(JudulBuku.kategori))
        .where(*kondisi)
        .order_by(func.lower(JudulBuku.judul), JudulBuku.id)
        .offset((halaman - 1) * per_halaman)
        .limit(per_halaman)
    )
    return list(db.scalars(q_data)), total


def detail_judul(db: Session, judul_id: int) -> JudulBuku:
    return _judul(db, judul_id)


def simpan_judul(db: Session, data: DataJudul, *, judul_id: int | None = None) -> JudulBuku:
    """FR-BKU-02: tambah (judul_id None) atau ubah judul. Harga hanya di judul (FR-BKU-03);
    tagihan yang sudah terbentuk tidak dihitung ulang (nominal tersimpan, SRS 7.1)."""
    isian = _wajib_isi(
        "FR-BKU-02", isbn=data.isbn, judul=data.judul, penulis=data.penulis, penerbit=data.penerbit
    )
    if not isbn_bentuk_valid(isian["isbn"]):  # ASUMSI(OQ-18)
        raise _tidak_valid(
            "BKU_ISBN_BENTUK",
            "ISBN harus 10 karakter (9 angka diikuti angka atau X) atau 13 angka; "
            "tanda hubung dan spasi diabaikan.",
            "FR-BKU-02",
        )
    if data.tahun <= 0:  # ASUMSI(OQ-10)
        raise _tidak_valid("BKU_TAHUN_TIDAK_VALID", "Tahun terbit harus lebih dari 0.", "DR-05")
    if data.harga <= 0:
        raise _tidak_valid("BKU_HARGA_TIDAK_VALID", "Harga harus lebih dari Rp0.", "DR-05")
    if db.get(Kategori, data.kategori_id) is None:
        raise _tidak_valid(
            "BKU_KATEGORI_TIDAK_ADA", "Kategori yang dipilih tidak ditemukan.", "FR-BKU-02"
        )
    deskripsi = data.deskripsi if data.deskripsi is ... else _deskripsi_bersih(data.deskripsi)

    j = JudulBuku() if judul_id is None else _judul(db, judul_id)
    pemilik = _judul_ber_isbn(db, isian["isbn"], kecuali_id=judul_id)
    if pemilik is not None:
        raise _galat_isbn_duplikat(isian["isbn"], pemilik.judul)

    j.isbn, j.judul = isian["isbn"], isian["judul"]
    j.penulis, j.penerbit = isian["penulis"], isian["penerbit"]
    j.tahun, j.kategori_id, j.harga = data.tahun, data.kategori_id, data.harga
    if deskripsi is not ...:
        j.deskripsi = deskripsi
    db.add(j)
    try:
        db.commit()
    except IntegrityError as exc:  # balapan ISBN
        db.rollback()
        if _nama_constraint(exc) != "uq_judul_buku_isbn_normal":
            raise
        pemilik = db.scalar(
            select(JudulBuku.judul).where(JudulBuku.isbn_normal == normalisasi_isbn(isian["isbn"]))
        )
        raise _galat_isbn_duplikat(isian["isbn"], pemilik or "lain") from exc
    db.refresh(j)
    return _judul(db, j.id)


def hapus_judul(db: Session, judul_id: int) -> None:
    """FR-BKU-02: judul yang pernah dipinjam tidak dapat dihapus.
    ASUMSI(OQ-12): yang belum pernah dipinjam boleh dihapus; eksemplarnya ikut (CASCADE)."""
    j = _judul(db, judul_id)
    if _pernah_dipinjam(db, j.id):
        raise _galat_pernah_dipinjam(j.judul)
    nama, cover = j.judul, j.cover_path
    db.delete(j)
    try:
        db.commit()
    except IntegrityError as exc:  # balapan: dipinjam setelah pemeriksaan (FK item → eksemplar)
        db.rollback()
        if _nama_constraint(exc) != "fk_item_transaksi_eksemplar_id_eksemplar":
            raise
        raise _galat_pernah_dipinjam(nama) from exc
    berkas.hapus(cover)


def ganti_cover(db: Session, judul_id: int, unggahan: BinaryIO) -> JudulBuku:
    """FR-BKU-02, NFR-SEC-06. ASUMSI(OQ-19): cover hanya diunggah/diganti, tidak dihapus terpisah.
    Berkas lama dihapus setelah commit berhasil; bila commit gagal, berkas baru dibuang."""
    j = _judul(db, judul_id)
    gambar = berkas.periksa_gambar(unggahan, label="Cover")
    path_baru = berkas.simpan(gambar, "cover")
    path_lama = j.cover_path
    j.cover_path = path_baru
    try:
        db.commit()
    except Exception:
        db.rollback()
        berkas.hapus(path_baru)
        raise
    berkas.hapus(path_lama)
    return _judul(db, j.id)

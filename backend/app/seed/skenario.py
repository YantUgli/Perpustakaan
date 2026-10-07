"""Data skenario QA (WBS 6.1.2): anggota dengan pinjaman terlambat, batas 3, dan tagihan.

ASUMSI(OQ-15): ditolak bila APP_ENV=production.

Berbeda dari `data_uji.py`, seed ini **sengaja** membuat item DIPINJAM/DIKEMBALIKAN/HILANG dan
tagihan langsung lewat tabel, karena service sirkulasi selalu memakai `hari_ini_wib()` sehingga
pinjaman bertanggal mundur tidak bisa dibuat lewat jalur biasa. Tidak ada aturan bisnis baru:
jatuh tempo dari `kalkulasi.hitung_jatuh_tempo`, denda dari `kalkulasi.hitung_denda`, penggantian
= harga judul, dan setiap baris lolos CHECK yang sama dengan data dari service.

Semua tanggal relatif terhadap H = `hari_ini_wib()` saat seed dijalankan, jadi skenario bergeser
satu hari setiap hari: jalankan `python -m app.seed reset --ya <nama_db>` sebelum sesi uji.
Idempoten per email: akun yang sudah ada dilewati (tanggalnya tidak diperbarui).
"""

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import func, insert, select
from sqlalchemy.orm import Session

from app.core.keamanan import hash_password
from app.core.validasi import PANJANG_MIN_PASSWORD, password_cukup_panjang
from app.core.waktu import hari_ini_wib
from app.models import (
    Admin,
    Anggota,
    Eksemplar,
    ItemTransaksi,
    JudulBuku,
    Tagihan,
    TransaksiPeminjaman,
)
from app.models.status import (
    JenisTagihan,
    StatusEksemplar,
    StatusItem,
    StatusTagihan,
    StatusTransaksi,
)
from app.seed.admin import GalatSeed
from app.seed.data_uji import _pastikan_master, _tolak_di_produksi, isbn13
from app.services import kalkulasi

# Rp100.000 agar nominal sama dengan tabel kasus uji SRS (domain-rules §5).
HARGA_SKENARIO = 100_000
JUDUL_SKENARIO = "Buku Skenario QA"
ISBN_SKENARIO = isbn13("978602200000")  # prefiks 9786022: terpisah dari data uji & performa
DOMAIN_EMAIL = "skenario.example"
_EKSEMPLAR_TERSEDIA = 3  # cukup untuk uji item ke-4 (batas-3) dan 3 pinjaman akun `bersih`


@dataclass(frozen=True)
class _Rencana:
    skenario: str
    nama: str
    jenis: str  # "terlambat" | "batas" | "denda" | "penggantian" | "bersih"
    hari_terlambat: int = 0


RENCANA = [
    *(
        _Rencana(f"terlambat-{n}", f"QA Terlambat {n} Hari", "terlambat", n)
        for n in (0, 1, 7, 8, 70, 71)
    ),
    _Rencana("batas-3", "QA Tiga Pinjaman Aktif", "batas"),
    _Rencana("tagihan-denda", "QA Tagihan Denda", "denda"),
    _Rencana("tagihan-penggantian", "QA Tagihan Penggantian", "penggantian"),
    _Rencana("bersih", "QA Tanpa Pinjaman", "bersih"),
]
# NIK diturunkan dari urutan: skenario baru ditambahkan di akhir agar NIK akun lama tetap.


@dataclass(frozen=True)
class AkunSkenario:
    skenario: str
    email: str
    kode_anggota: str
    kode_eksemplar: tuple[str, ...]
    dibuat: bool


@dataclass(frozen=True)
class HasilSkenario:
    akun: list[AkunSkenario]
    eksemplar_tersedia: list[str]  # eksemplar TERSEDIA judul skenario (untuk uji pinjam baru)


def _email(skenario: str) -> str:
    return f"{skenario}@{DOMAIN_EMAIL}"


def _nik(urutan: int) -> str:
    return f"99{urutan:014d}"  # 16 digit, deterministik; tidak bertabrakan dengan NIK uji lain


def _admin_id(db: Session) -> int:
    admin_id = db.scalar(select(Admin.id).order_by(Admin.id).limit(1))
    if admin_id is None:
        raise GalatSeed("Belum ada admin. Jalankan `python -m app.seed admin` dulu.")
    return admin_id


def _judul_skenario(db: Session) -> int:
    judul_id = db.scalar(select(JudulBuku.id).where(JudulBuku.isbn == ISBN_SKENARIO))
    if judul_id is not None:
        return judul_id
    kategori_id, rak_id, _, _ = _pastikan_master(db)
    judul_id = db.scalar(
        insert(JudulBuku)
        .values(
            isbn=ISBN_SKENARIO,
            judul=JUDUL_SKENARIO,
            penulis="Tim QA",
            penerbit="Penerbit Uji Satu",
            tahun=2026,
            kategori_id=kategori_id[0],
            harga=HARGA_SKENARIO,
        )
        .returning(JudulBuku.id)
    )
    db.execute(
        insert(Eksemplar),
        [
            {"judul_buku_id": judul_id, "rak_id": rak_id[0], "status": StatusEksemplar.TERSEDIA}
            for _ in range(_EKSEMPLAR_TERSEDIA)
        ],
    )
    return judul_id


class _Penyusun:
    def __init__(self, db: Session, *, judul_id: int, admin_id: int, hari_ini: date) -> None:
        self.db = db
        self.judul_id = judul_id
        self.admin_id = admin_id
        self.h = hari_ini
        self.rak_id = db.scalar(select(Eksemplar.rak_id).where(Eksemplar.judul_buku_id == judul_id))

    def eksemplar(self, status: StatusEksemplar) -> int:
        return self.db.scalar(
            insert(Eksemplar)
            .values(judul_buku_id=self.judul_id, rak_id=self.rak_id, status=status)
            .returning(Eksemplar.id)
        )

    def transaksi(self, anggota_id: int, tanggal_pinjam: date, status: StatusTransaksi) -> int:
        return self.db.scalar(
            insert(TransaksiPeminjaman)
            .values(
                anggota_id=anggota_id,
                admin_id=self.admin_id,
                tanggal_transaksi=tanggal_pinjam,
                status=status,
            )
            .returning(TransaksiPeminjaman.id)
        )

    def item(self, transaksi_id: int, eksemplar_id: int, tanggal_pinjam: date, **kw) -> int:
        return self.db.scalar(
            insert(ItemTransaksi)
            .values(
                transaksi_id=transaksi_id,
                eksemplar_id=eksemplar_id,
                tanggal_pinjam=tanggal_pinjam,
                jatuh_tempo=kalkulasi.hitung_jatuh_tempo(tanggal_pinjam),
                **({"status": StatusItem.DIPINJAM} | kw),
            )
            .returning(ItemTransaksi.id)
        )

    def tagihan(self, item_id: int, jenis: JenisTagihan, nominal: int, dibentuk: date) -> None:
        self.db.execute(
            insert(Tagihan).values(
                item_transaksi_id=item_id,
                jenis=jenis,
                nominal=nominal,
                status=StatusTagihan.BELUM_LUNAS,
                tanggal_dibentuk=dibentuk,
            )
        )

    def susun(self, r: _Rencana, anggota_id: int) -> None:
        h = self.h
        if r.jenis == "bersih":
            return
        if r.jenis == "terlambat":
            # jatuh tempo = H − n → terlambat n hari pada H (n = 0: tepat jatuh tempo)
            pinjam = h - timedelta(days=kalkulasi.MASA_PINJAM_HARI + r.hari_terlambat)
            trx = self.transaksi(anggota_id, pinjam, StatusTransaksi.AKTIF)
            self.item(trx, self.eksemplar(StatusEksemplar.DIPINJAM), pinjam)
        elif r.jenis == "batas":
            pinjam = h - timedelta(days=10)
            trx = self.transaksi(anggota_id, pinjam, StatusTransaksi.AKTIF)
            for _ in range(3):
                self.item(trx, self.eksemplar(StatusEksemplar.DIPINJAM), pinjam)
        elif r.jenis == "denda":
            # pinjam H−45, jatuh tempo H−15, kembali H−5 (terlambat 10 hari), tagihan dibentuk H−5
            pinjam, kembali = h - timedelta(days=45), h - timedelta(days=5)
            trx = self.transaksi(anggota_id, pinjam, StatusTransaksi.SELESAI)
            item_id = self.item(
                trx,
                self.eksemplar(StatusEksemplar.TERSEDIA),
                pinjam,
                status=StatusItem.DIKEMBALIKAN,
                tanggal_kembali=kembali,
            )
            denda = kalkulasi.hitung_denda(
                jatuh_tempo=kalkulasi.hitung_jatuh_tempo(pinjam),
                tanggal_kembali=kembali,
                harga=HARGA_SKENARIO,
            )
            self.tagihan(item_id, JenisTagihan.DENDA, denda, kembali)
        elif r.jenis == "penggantian":
            # OQ-26: tanggal_pinjam ≤ tanggal_kejadian ≤ H; OQ-27: tagihan dibentuk H
            pinjam = h - timedelta(days=20)
            trx = self.transaksi(anggota_id, pinjam, StatusTransaksi.SELESAI)
            item_id = self.item(
                trx,
                self.eksemplar(StatusEksemplar.HILANG),
                pinjam,
                status=StatusItem.HILANG,
                tanggal_kejadian=h - timedelta(days=3),
                keterangan="Dilaporkan hilang secara lisan oleh anggota (data skenario QA).",
                admin_pencatat_id=self.admin_id,
            )
            self.tagihan(item_id, JenisTagihan.PENGGANTIAN, HARGA_SKENARIO, h)  # FR-HLR-03


def _kode_eksemplar(db: Session, anggota_id: int) -> tuple[str, ...]:
    return tuple(
        db.scalars(
            select(Eksemplar.kode)
            .join(ItemTransaksi, ItemTransaksi.eksemplar_id == Eksemplar.id)
            .join(TransaksiPeminjaman, ItemTransaksi.transaksi_id == TransaksiPeminjaman.id)
            .where(TransaksiPeminjaman.anggota_id == anggota_id)
            .order_by(ItemTransaksi.id)
        )
    )


def seed_skenario(db: Session, *, app_env: str, password: str | None) -> HasilSkenario:
    """Buat akun skenario QA yang belum ada. Tidak commit; pemanggil yang memegang transaksi."""
    _tolak_di_produksi(app_env)
    if not password:
        raise GalatSeed("Variabel lingkungan wajib belum diisi: SKENARIO_PASSWORD.")
    if not password_cukup_panjang(password):  # NFR-SEC-02
        raise GalatSeed(f"SKENARIO_PASSWORD minimal {PANJANG_MIN_PASSWORD} karakter.")

    penyusun = _Penyusun(
        db, judul_id=_judul_skenario(db), admin_id=_admin_id(db), hari_ini=hari_ini_wib()
    )
    password_hash = None
    akun = []
    for urutan, r in enumerate(RENCANA, start=1):
        email = _email(r.skenario)
        anggota_id = db.scalar(
            select(Anggota.id).where(func.lower(func.trim(Anggota.email)) == email)
        )
        dibuat = anggota_id is None
        if dibuat:
            password_hash = password_hash or hash_password(password)  # NFR-SEC-01; sekali saja
            anggota_id = db.scalar(
                insert(Anggota)
                .values(
                    nik=_nik(urutan),
                    nama=r.nama,
                    alamat="Jl. Skenario QA No. 1",
                    email=email,
                    telepon="081200000000",
                    password_hash=password_hash,
                    tanggal_daftar=penyusun.h - timedelta(days=120),  # sebelum pinjaman tertua
                )
                .returning(Anggota.id)
            )
            penyusun.susun(r, anggota_id)
        akun.append(
            AkunSkenario(
                skenario=r.skenario,
                email=email,
                kode_anggota=db.scalar(select(Anggota.kode).where(Anggota.id == anggota_id)),
                kode_eksemplar=_kode_eksemplar(db, anggota_id),
                dibuat=dibuat,
            )
        )
    db.flush()
    tersedia = list(
        db.scalars(
            select(Eksemplar.kode)
            .where(
                Eksemplar.judul_buku_id == penyusun.judul_id,
                Eksemplar.status == StatusEksemplar.TERSEDIA,
            )
            .order_by(Eksemplar.id)
        )
    )
    return HasilSkenario(akun=akun, eksemplar_tersedia=tersedia)

"""Reset data dev/staging: kosongkan semua tabel kecuali `admin`, lalu seed data uji & skenario.

ASUMSI(OQ-15): ditolak bila APP_ENV=production. Karena APP_ENV bawaan "dev", penolakan itu saja
tidak melindungi server yang lupa diberi APP_ENV; maka pemanggil wajib mengetik ulang nama DB
yang dituju dan nama itu dicocokkan dengan `current_database()`.

Tidak commit: TRUNCATE, ALTER SEQUENCE RESTART, dan kedua seed berjalan dalam transaksi pemanggil
(keduanya transaksional di PostgreSQL), jadi gagal di tengah = tidak ada yang berubah.
TRUNCATE tidak memicu trigger baris `trg_tagihan_lunas_terkunci` (decisions §B).

Ikut terhapus: semua sesi (termasuk admin → semua orang login ulang) dan data performa.
Berkas cover/foto di STORAGE_DIR tidak dihapus.
"""

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import Admin, Base
from app.models.sekuens import SEQ_KODE_ANGGOTA, SEQ_KODE_EKSEMPLAR
from app.seed.admin import GalatSeed
from app.seed.data_uji import RingkasanSeed, _tolak_di_produksi, seed_data_uji
from app.seed.skenario import HasilSkenario, seed_skenario


@dataclass(frozen=True)
class HasilReset:
    tabel: list[str]
    data_uji: RingkasanSeed
    skenario: HasilSkenario


def tabel_direset() -> list[str]:
    """Semua tabel model kecuali admin; tabel baru otomatis ikut."""
    return [t.name for t in Base.metadata.sorted_tables if t.name != Admin.__tablename__]


def reset_data(
    db: Session, *, app_env: str, nama_db: str | None, password: str | None
) -> HasilReset:
    _tolak_di_produksi(app_env)
    sebenarnya = db.scalar(text("SELECT current_database()"))
    if not nama_db or nama_db != sebenarnya:
        raise GalatSeed(
            f"Nama DB konfirmasi '{nama_db or ''}' tidak cocok dengan DB yang dituju "
            f"'{sebenarnya}'. Tidak ada yang dihapus."
        )

    tabel = tabel_direset()
    # Nama tabel & sequence berasal dari metadata model, bukan masukan pengguna.
    daftar = ", ".join(f'"{t}"' for t in tabel)
    db.execute(text(f"TRUNCATE {daftar} RESTART IDENTITY"))
    for seq in (SEQ_KODE_ANGGOTA, SEQ_KODE_EKSEMPLAR):
        db.execute(text(f'ALTER SEQUENCE "{seq.name}" RESTART'))

    data_uji = seed_data_uji(db, app_env=app_env)
    skenario = seed_skenario(db, app_env=app_env, password=password)
    return HasilReset(tabel=tabel, data_uji=data_uji, skenario=skenario)

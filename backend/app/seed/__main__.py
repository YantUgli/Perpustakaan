"""CLI seed: `uv run python -m app.seed {admin|data-uji|performa}`.

Commit dilakukan di sini (satu transaksi per perintah). Password tidak pernah dicetak.
"""

import argparse
import sys

from pydantic import ValidationError

from app.core.config import get_settings
from app.db import get_sessionmaker
from app.seed.admin import GalatSeed, HasilSeedAdmin, seed_admin
from app.seed.data_uji import RingkasanSeed, seed_data_uji, seed_performa


def _cetak_ringkasan(judul: str, r: RingkasanSeed) -> None:
    print(
        f"{judul}: {r.kategori} kategori, {r.rak} rak, {r.judul} judul, "
        f"{r.eksemplar} eksemplar baru."
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.seed", description="Seed basis data.")
    sub = parser.add_subparsers(dest="perintah", required=True)
    sub.add_parser("admin", help="Buat akun admin awal dari env ADMIN_AWAL_* (FR-AKN-12).")
    sub.add_parser("data-uji", help="Kategori, rak, dan buku uji (dev/staging saja).")
    performa = sub.add_parser("performa", help="10.000 eksemplar untuk uji NFR-PRF-01.")
    performa.add_argument("--judul", type=int, default=2_000)
    performa.add_argument("--per-judul", type=int, default=5)
    args = parser.parse_args(argv)

    try:
        settings = get_settings()
    except ValidationError as exc:
        salah = ", ".join(str(e["loc"][0]).upper() for e in exc.errors())
        print(
            f"Konfigurasi tidak valid: {salah}. APP_ENV hanya dev, staging, atau production.",
            file=sys.stderr,
        )
        return 2

    try:
        with get_sessionmaker()() as db, db.begin():
            if args.perintah == "admin":
                hasil = seed_admin(
                    db,
                    nama=settings.admin_awal_nama,
                    email=settings.admin_awal_email,
                    password=settings.admin_awal_password,
                )
                email = (settings.admin_awal_email or "").strip()
                if hasil is HasilSeedAdmin.DIBUAT:
                    print(f"Admin {email} dibuat.")
                else:
                    print(f"Admin {email} sudah ada; tidak ada yang diubah (OQ-14).")
            elif args.perintah == "data-uji":
                _cetak_ringkasan("Data uji", seed_data_uji(db, app_env=settings.app_env))
            else:
                _cetak_ringkasan(
                    "Data performa",
                    seed_performa(
                        db,
                        app_env=settings.app_env,
                        jumlah_judul=args.judul,
                        eksemplar_per_judul=args.per_judul,
                    ),
                )
    except GalatSeed as exc:
        print(f"Seed dibatalkan: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

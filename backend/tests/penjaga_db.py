"""Penjaga agar pytest tidak pernah menyentuh database dev/produksi."""

from sqlalchemy.engine import make_url


class DatabaseTestTidakAman(Exception):
    pass


def pastikan_url_db_test(url_test: str | None, url_dev: str | None) -> str:
    if not url_test:
        raise DatabaseTestTidakAman("DATABASE_URL_TEST belum diisi.")
    nama = make_url(url_test).database or ""
    if not nama.endswith("_test"):
        raise DatabaseTestTidakAman(
            f"Nama database test harus berakhiran '_test', didapat '{nama}'."
        )
    if url_dev and make_url(url_dev) == make_url(url_test):
        raise DatabaseTestTidakAman("DATABASE_URL_TEST tidak boleh sama dengan DATABASE_URL.")
    return url_test

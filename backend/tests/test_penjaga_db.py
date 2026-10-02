import pytest

from tests.penjaga_db import DatabaseTestTidakAman, pastikan_url_db_test

DEV = "postgresql+psycopg://u:p@127.0.0.1:5434/perpustakaan"


@pytest.mark.parametrize(
    "url",
    [None, "", DEV, "postgresql+psycopg://u:p@127.0.0.1:5434/perpustakaan_testing"],
)
def test_penjaga_tolak_db_bukan_test(url):
    with pytest.raises(DatabaseTestTidakAman):
        pastikan_url_db_test(url, DEV)


def test_penjaga_terima_db_berakhiran_test():
    url = "postgresql+psycopg://u:p@127.0.0.1:5434/perpustakaan_test"
    assert pastikan_url_db_test(url, DEV) == url


def test_conftest_mengarahkan_aplikasi_ke_db_test():
    from sqlalchemy.engine import make_url

    from app.core.config import get_settings

    assert make_url(get_settings().database_url).database.endswith("_test")

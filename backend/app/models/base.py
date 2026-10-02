from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# Penamaan constraint yang konsisten agar migration Alembic deterministik.
KONVENSI_NAMA = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=KONVENSI_NAMA)


def _indeks_ekspresi() -> set[str]:
    from sqlalchemy import Column

    return {
        ix.name
        for tabel in Base.metadata.tables.values()
        for ix in tabel.indexes
        if ix.name and any(not isinstance(e, Column) for e in ix.expressions)
    }


def sertakan_objek_alembic(_obj, name, type_, _reflected, _compare_to) -> bool:
    """Filter autogenerate: lewati indeks ekspresi (mis. `lower(trim(email))`).

    Alembic tidak bisa membandingkan indeks ekspresi sehingga selalu melaporkan drop+create palsu.
    Perubahan pada indeks semacam ini harus ditulis manual di migration baru.
    """
    return not (type_ == "index" and name in _indeks_ekspresi())

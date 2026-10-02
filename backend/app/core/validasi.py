"""Validator isian bersama: email & password (FR-AKN-03), ISBN (OQ-13, OQ-18)."""

import re

from email_validator import EmailNotValidError, validate_email

PANJANG_MIN_PASSWORD = 8  # NFR-SEC-02


def email_valid(email: str) -> bool:
    """Format email valid (FR-AKN-03). Tanpa cek DNS/deliverability. `email` harus sudah di-trim."""
    try:
        validate_email(email, check_deliverability=False)
    except EmailNotValidError:
        return False
    return True


def password_cukup_panjang(password: str) -> bool:
    return len(password) >= PANJANG_MIN_PASSWORD


_PEMISAH_ISBN = re.compile(r"[-\s]")
# ASUMSI(OQ-18): ISBN-10 (9 angka + angka/X) atau ISBN-13 (13 angka); tanpa cek digit kontrol.
_BENTUK_ISBN = re.compile(r"\d{9}[\dX]|\d{13}")


def normalisasi_isbn(isbn: str) -> str:
    """ASUMSI(OQ-13): buang tanda hubung & spasi, `x` → `X`.

    Wajib sama dengan kolom generated `judul_buku.isbn_normal` (lihat models/koleksi.py).
    Dipakai juga untuk kata kunci pencarian ISBN di katalog (WP 5.3.2).
    """
    return _PEMISAH_ISBN.sub("", isbn).upper()


def isbn_bentuk_valid(isbn: str) -> bool:
    return _BENTUK_ISBN.fullmatch(normalisasi_isbn(isbn)) is not None

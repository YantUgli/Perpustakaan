"""Validator isian bersama: seed admin dan (nanti) pendaftaran/profil anggota (FR-AKN-03)."""

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

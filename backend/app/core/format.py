"""Format tampilan bersama untuk pesan ke pengguna (CLAUDE.md: uang `Rp10.000`)."""


def format_rupiah(nominal: int) -> str:
    """`Rp35.555`: tanpa spasi, titik pemisah ribuan. Uang selalu int Rupiah, tidak negatif."""
    if not isinstance(nominal, int) or isinstance(nominal, bool):
        raise TypeError("nominal harus int Rupiah.")
    if nominal < 0:
        raise ValueError("nominal tidak boleh negatif.")
    return f"Rp{nominal:,}".replace(",", ".")

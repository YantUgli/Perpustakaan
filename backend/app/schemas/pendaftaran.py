from pydantic import BaseModel


class HasilDaftarKeluar(BaseModel):
    """FR-AKN-04. Sengaja tanpa NIK, foto, dan hash password. `isi_qr` = kode anggota (teks
    polos); gambar QR dibuat frontend (IR-SW-02)."""

    kode: str
    nama: str
    email: str
    isi_qr: str

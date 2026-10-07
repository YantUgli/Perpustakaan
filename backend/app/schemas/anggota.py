from datetime import date

from pydantic import BaseModel, ConfigDict

from app.services.anggota import ProfilAnggota


class _TanpaIsianAsing(BaseModel):
    """`extra="forbid"`: `nik`, `foto`, `kode`, `id`, dll. ditolak (K-05, NFR-SEC-03; §B)."""

    model_config = ConfigDict(extra="forbid")


class ProfilKeluar(BaseModel):
    """FR-AKN-07/10. Sengaja tanpa `password_hash` dan `foto_path`.

    Foto disajikan lewat endpoint terpisah khusus pemilik & admin (OQ-42); di sini hanya penanda
    `ada_foto`."""

    kode: str
    nama: str
    alamat: str
    email: str
    telepon: str
    nik: str
    tanggal_daftar: date
    ada_foto: bool  # OQ-42

    @classmethod
    def dari(cls, p: ProfilAnggota) -> "ProfilKeluar":
        return cls(**vars(p))


class HalamanAnggota(BaseModel):
    data: list[ProfilKeluar]
    total: int
    halaman: int
    per_halaman: int


class UbahProfilMasuk(_TanpaIsianAsing):
    """FR-AKN-07: hanya isian ini yang boleh diubah anggota."""

    nama: str
    alamat: str
    email: str
    telepon: str


class GantiPasswordMasuk(_TanpaIsianAsing):
    """FR-AKN-09. Tidak di-trim."""

    password_lama: str
    password_baru: str


class UbahAnggotaAdminMasuk(_TanpaIsianAsing):
    """FR-AKN-11, K-03: `password_baru` opsional, tanpa password lama."""

    nama: str
    alamat: str
    email: str
    telepon: str
    password_baru: str | None = None

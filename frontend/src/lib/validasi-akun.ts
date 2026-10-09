/**
 * Validasi klien untuk login & pendaftaran — hanya kenyamanan (umpan balik cepat). Keputusan tetap di backend
 * (FR-AKN-01..03, NFR-SEC-02/06). Pesan & batas sama dengan backend (dijaga validasi-akun.test.ts):
 * `services/pendaftaran.py`, `services/berkas.py`, `core/validasi.py`.
 */

export const PANJANG_MIN_PASSWORD = 8; // NFR-SEC-02 (desain menulis 6 — tidak diikuti)
export const UKURAN_MAKS_FOTO = 2 * 1024 * 1024; // NFR-SEC-06: 2.097.152 byte, tepat 2 MB diterima

export const LABEL_ISIAN = {
  nama: "Nama",
  alamat: "Alamat",
  email: "Email",
  telepon: "Telepon",
  nik: "NIK",
  password: "Password",
  foto: "Foto",
} as const;

export const PESAN_AKUN = {
  nik: "NIK harus tepat 16 digit angka.",
  email: "Format email tidak valid.",
  password: `Password minimal ${PANJANG_MIN_PASSWORD} karakter.`,
  fotoTerlaluBesar: "Ukuran berkas melebihi batas 2 MB.",
  fotoFormat: "Foto harus berupa gambar JPG atau PNG.",
} as const;

export const wajibDiisi = (label: string) => `${label} wajib diisi.`;

export type NilaiDaftar = {
  nama: string;
  alamat: string;
  email: string;
  telepon: string;
  nik: string;
  password: string;
  foto: File | null;
};

const POLA_NIK = /^[0-9]{16}$/;
// Sengaja longgar (tanpa spasi, satu @, domain bertitik): tidak boleh lebih ketat dari backend.
const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JENIS_FOTO = new Set(["image/jpeg", "image/png"]);

/** Galat per isian (`nama_isian → pesan`); objek kosong = boleh dikirim. */
export function validasiDaftar(n: NilaiDaftar): Record<string, string> {
  const galat: Record<string, string> = {};
  // Teks di-trim seperti backend; password apa adanya.
  const teks = {
    nama: n.nama.trim(),
    alamat: n.alamat.trim(),
    email: n.email.trim(),
    telepon: n.telepon.trim(),
    nik: n.nik.trim(),
  };
  for (const [k, v] of Object.entries(teks)) {
    if (!v) galat[k] = wajibDiisi(LABEL_ISIAN[k as keyof typeof teks]);
  }
  if (!n.password) galat.password = wajibDiisi(LABEL_ISIAN.password);

  if (teks.nik && !POLA_NIK.test(teks.nik)) galat.nik = PESAN_AKUN.nik; // FR-AKN-03
  if (teks.email && !POLA_EMAIL.test(teks.email)) galat.email = PESAN_AKUN.email; // FR-AKN-03
  // OQ-31: telepon hanya wajib, tanpa format.
  if (n.password && n.password.length < PANJANG_MIN_PASSWORD) galat.password = PESAN_AKUN.password;

  if (n.foto) {
    const galatFoto = validasiFoto(n.foto);
    if (galatFoto) galat.foto = galatFoto;
  }
  return galat;
}

/**
 * NFR-SEC-06: foto anggota saat daftar (FR-AKN-01) dan saat diganti di Profil (OQ-48). Ukuran > 2.097.152 byte
 * ditahan; jenis hanya ditahan bila `File.type` terisi dan bukan JPG/PNG (P3) — jenis kosong → backend memeriksa
 * isi berkas. Pesan identik dengan backend (`berkas.py`).
 */
export function validasiFoto(foto: File): string | undefined {
  if (foto.size > UKURAN_MAKS_FOTO) return PESAN_AKUN.fotoTerlaluBesar;
  if (foto.type && !JENIS_FOTO.has(foto.type)) return PESAN_AKUN.fotoFormat;
  return undefined;
}

/** Login hanya memeriksa isian wajib; kecocokan kredensial diputuskan backend (OQ-16). */
export function validasiMasuk(n: { email: string; password: string }): Record<string, string> {
  const galat: Record<string, string> = {};
  if (!n.email.trim()) galat.email = wajibDiisi(LABEL_ISIAN.email);
  if (!n.password) galat.password = wajibDiisi(LABEL_ISIAN.password);
  return galat;
}

/**
 * FR-AKN-07/08: ubah data diri. NIK tidak dapat diubah; foto lewat endpoint terpisah (OQ-48). Pesan sama dengan
 * backend `anggota.py`.
 */
export function validasiProfil(n: {
  nama: string;
  alamat: string;
  email: string;
  telepon: string;
}): Record<string, string> {
  const galat: Record<string, string> = {};
  for (const k of ["nama", "alamat", "email", "telepon"] as const) {
    if (!n[k].trim()) galat[k] = wajibDiisi(LABEL_ISIAN[k]);
  }
  const email = n.email.trim();
  if (email && !POLA_EMAIL.test(email)) galat.email = PESAN_AKUN.email;
  return galat;
}

export const PESAN_GANTI_PASSWORD = {
  lamaWajib: "Password lama wajib diisi.",
  baruPendek: `Password baru minimal ${PANJANG_MIN_PASSWORD} karakter.`,
  konfirmasiWajib: "Konfirmasi password wajib diisi.",
  konfirmasiBeda: "Konfirmasi password tidak sama dengan password baru.",
} as const;

/**
 * FR-AKN-09, NFR-SEC-02. Password baru kosong memakai pesan "minimal 8" seperti backend.
 * Konfirmasi hanya diperiksa di klien (tidak dikirim ke backend).
 */
export function validasiGantiPassword(n: {
  password_lama: string;
  password_baru: string;
  konfirmasi: string;
}): Record<string, string> {
  const galat: Record<string, string> = {};
  if (!n.password_lama) galat.password_lama = PESAN_GANTI_PASSWORD.lamaWajib;
  if (n.password_baru.length < PANJANG_MIN_PASSWORD)
    galat.password_baru = PESAN_GANTI_PASSWORD.baruPendek;
  if (!n.konfirmasi) galat.konfirmasi = PESAN_GANTI_PASSWORD.konfirmasiWajib;
  else if (n.konfirmasi !== n.password_baru) galat.konfirmasi = PESAN_GANTI_PASSWORD.konfirmasiBeda;
  return galat;
}

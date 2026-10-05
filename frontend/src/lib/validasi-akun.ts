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
    if (n.foto.size > UKURAN_MAKS_FOTO) {
      galat.foto = PESAN_AKUN.fotoTerlaluBesar;
    } else if (n.foto.type && !JENIS_FOTO.has(n.foto.type)) {
      // P3: tahan hanya bila jenis diketahui dan bukan JPG/PNG; jenis kosong → backend memeriksa isi berkas.
      galat.foto = PESAN_AKUN.fotoFormat;
    }
  }
  return galat;
}

/** Login hanya memeriksa isian wajib; kecocokan kredensial diputuskan backend (OQ-16). */
export function validasiMasuk(n: { email: string; password: string }): Record<string, string> {
  const galat: Record<string, string> = {};
  if (!n.email.trim()) galat.email = wajibDiisi(LABEL_ISIAN.email);
  if (!n.password) galat.password = wajibDiisi(LABEL_ISIAN.password);
  return galat;
}

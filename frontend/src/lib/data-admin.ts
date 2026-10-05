/**
 * Logika halaman data admin (WP 5.4.7): anggota (FR-AKN-10/11), kategori & rak (FR-BKU-01).
 * Klien hanya merapikan masukan dan memberi umpan cepat; semua keputusan (keunikan, pemakaian, hak ubah)
 * tetap dari backend. Pesan validasi sama dengan backend (`services/anggota.py`, `core/validasi.py`).
 */
import { halamanDariParam } from "./halaman";
import { PANJANG_MIN_PASSWORD, validasiProfil, wajibDiisi } from "./validasi-akun";

type Param = string | string[] | undefined;

export type FilterAnggota = {
  /** ID, NIK, atau nama apa adanya (di-trim); backend yang mencocokkan & menormalisasi (OQ-33). */
  q?: string;
  halaman: number;
};

/** Filter daftar anggota dari `searchParams`. `q` kosong atau berganda dibuang; halaman tak sah → 1. */
export function filterAnggotaDariParam(p: Record<string, Param>): FilterAnggota {
  const f: FilterAnggota = { halaman: halamanDariParam(p.halaman) };
  const q = typeof p.q === "string" ? p.q.trim() : "";
  if (q) f.q = q;
  return f;
}

/** Query string untuk `GET /admin/anggota` (urutan tetap: q, halaman). */
export function queryAnggota(f: FilterAnggota): string {
  const q = new URLSearchParams();
  if (f.q) q.set("q", f.q);
  q.set("halaman", String(f.halaman));
  return q.toString();
}

export type NilaiUbahAnggota = {
  nama: string;
  alamat: string;
  email: string;
  telepon: string;
  /** Kosong = password tidak diubah (K-03). */
  password_baru: string;
};

/**
 * Body `PUT /admin/anggota/{kode}`. Hanya lima isian yang boleh diubah (FR-AKN-11); NIK, kode, dan foto
 * tidak pernah ikut walau ada di objek sumber (K-05). `password_baru` kosong tidak dikirim; bila diisi,
 * dikirim apa adanya (tidak di-trim).
 */
export function bodyUbahAnggota(n: NilaiUbahAnggota): {
  nama: string;
  alamat: string;
  email: string;
  telepon: string;
  password_baru?: string;
} {
  const body: ReturnType<typeof bodyUbahAnggota> = {
    nama: n.nama,
    alamat: n.alamat,
    email: n.email,
    telepon: n.telepon,
  };
  if (n.password_baru) body.password_baru = n.password_baru;
  return body;
}

/** FR-AKN-11, NFR-SEC-02: data diri seperti profil; password baru opsional tetapi minimal 8 bila diisi. */
export function validasiUbahAnggota(n: NilaiUbahAnggota): Record<string, string> {
  const galat = validasiProfil(n);
  if (n.password_baru && n.password_baru.length < PANJANG_MIN_PASSWORD) {
    galat.password_baru = `Password baru minimal ${PANJANG_MIN_PASSWORD} karakter.`;
  }
  return galat;
}

/** OQ-32: menetapkan password baru mengakhiri semua sesi anggota itu. */
export function pesanSuksesUbahAnggota(passwordDiubah: boolean): string {
  return passwordDiubah
    ? "Data anggota berhasil disimpan. Password baru ditetapkan dan semua sesi anggota ini diakhiri; anggota harus masuk kembali dengan password baru."
    : "Data anggota berhasil disimpan.";
}

/** FR-BKU-01, DR-03: nama kategori wajib (keunikan tak peka huruf diputuskan backend, OQ-09). */
export function validasiKategori(n: { nama: string }): Record<string, string> {
  return n.nama.trim() ? {} : { nama: wajibDiisi("Nama") };
}

export function bodyKategori(n: { nama: string }): { nama: string } {
  return { nama: n.nama.trim() };
}

/** FR-BKU-01, DR-04, OQ-08: kode rak wajib, lokasi opsional. */
export function validasiRak(n: { kode: string; lokasi: string }): Record<string, string> {
  return n.kode.trim() ? {} : { kode: wajibDiisi("Kode") };
}

export function bodyRak(n: { kode: string; lokasi: string }): {
  kode: string;
  lokasi: string | null;
} {
  return { kode: n.kode.trim(), lokasi: n.lokasi.trim() || null };
}

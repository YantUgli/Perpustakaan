/**
 * Logika halaman data admin (WP 5.4.7): anggota (FR-AKN-10/11), kategori & rak (FR-BKU-01).
 * Klien hanya merapikan masukan dan memberi umpan cepat; semua keputusan (keunikan, pemakaian, hak ubah)
 * tetap dari backend. Pesan validasi sama dengan backend (`services/anggota.py`, `core/validasi.py`).
 */
import { halamanDariParam } from "./halaman";
import { PANJANG_MIN_PASSWORD, PESAN_AKUN, validasiProfil, wajibDiisi } from "./validasi-akun";

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

export type FilterJudul = {
  /** Kata kunci apa adanya (di-trim); backend yang mencocokkan judul/penulis/ISBN/kategori (OQ-24/OQ-45). */
  q?: string;
  halaman: number;
};

/** ASUMSI(OQ-45): filter daftar judul admin dari `searchParams`, pola sama dengan anggota. */
export function filterJudulDariParam(p: Record<string, Param>): FilterJudul {
  const f: FilterJudul = { halaman: halamanDariParam(p.halaman) };
  const q = typeof p.q === "string" ? p.q.trim() : "";
  if (q) f.q = q;
  return f;
}

/** FR-BKU-02 (keputusan Ayen 2026-10-07): pesan setelah hapus judul; judul tidak ditaruh di URL. */
export const PESAN_JUDUL_DIHAPUS = "Judul berhasil dihapus.";
export const URL_SETELAH_HAPUS_JUDUL = "/admin/judul?dihapus=1";

/**
 * Penanda `dihapus` sah hanya string "1" persis; nilai lain diabaikan tanpa galat. Sengaja di luar
 * `FilterJudul`, sehingga tidak dikirim ke API dan tidak terbawa ke paginasi maupun pencarian.
 */
export function judulBaruDihapus(p: Record<string, Param>): boolean {
  return p.dihapus === "1";
}

/** Query string untuk `GET /admin/judul` (urutan tetap: q, halaman); tanpa q sama seperti sebelumnya. */
export function queryJudul(f: FilterJudul): string {
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

// ---- Judul & eksemplar (bagian B) ----

export const UKURAN_MAKS_COVER = 2 * 1024 * 1024; // NFR-SEC-06: 2.097.152 byte, tepat 2 MB diterima
const JENIS_COVER = new Set(["image/jpeg", "image/png"]);
const POLA_BULAT = /^[0-9]+$/;

/**
 * Bilangan bulat tak negatif dari teks isian; selain itu `null`. Sengaja tanpa fungsi parse desimal:
 * pecahan, koma, titik ribuan, dan notasi ilmiah ditolak, bukan dibulatkan (uang = int Rupiah, DR-05).
 */
export function bacaBulat(teks: string): number | null {
  const t = teks.trim();
  if (!POLA_BULAT.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

export type NilaiJudul = {
  isbn: string;
  judul: string;
  penulis: string;
  penerbit: string;
  tahun: string;
  kategori_id: string;
  harga: string;
};

const PESAN_JUDUL = {
  kategori: "Pilih kategori.",
  tahunBulat: "Tahun harus berupa bilangan bulat.",
  hargaBulat: "Harga harus berupa bilangan bulat Rupiah tanpa titik atau koma.",
  coverFormat: "Cover harus berupa gambar JPG atau PNG.",
} as const;

/**
 * FR-BKU-02, DR-05, NFR-SEC-06: umpan cepat sebelum kirim. Aturan harga (> 0), tahun, bentuk ISBN
 * (OQ-18), dan isi berkas diputuskan backend. Cover diperiksa SEBELUM judul dibuat agar tidak ada judul
 * setengah jadi karena berkas yang jelas salah.
 */
export function validasiJudul(n: NilaiJudul, cover: File | null): Record<string, string> {
  const galat: Record<string, string> = {};
  const wajib = [
    ["isbn", "ISBN"],
    ["judul", "Judul"],
    ["penulis", "Penulis"],
    ["penerbit", "Penerbit"],
  ] as const;
  for (const [k, label] of wajib) {
    if (!n[k].trim()) galat[k] = wajibDiisi(label);
  }
  if (!n.tahun.trim()) galat.tahun = wajibDiisi("Tahun");
  else if (bacaBulat(n.tahun) === null) galat.tahun = PESAN_JUDUL.tahunBulat;
  if (!n.kategori_id.trim()) galat.kategori_id = PESAN_JUDUL.kategori;
  if (!n.harga.trim()) galat.harga = wajibDiisi("Harga");
  else if (bacaBulat(n.harga) === null) galat.harga = PESAN_JUDUL.hargaBulat;

  if (cover) {
    if (cover.size > UKURAN_MAKS_COVER) {
      galat.cover = PESAN_AKUN.fotoTerlaluBesar;
    } else if (cover.type && !JENIS_COVER.has(cover.type)) {
      // Seperti foto anggota (P3): tahan hanya bila jenis diketahui; jenis kosong → backend memeriksa isi.
      galat.cover = PESAN_JUDUL.coverFormat;
    }
  }
  return galat;
}

/** Body `POST/PUT /admin/judul`: tahun, kategori, dan harga bertipe integer (backend `StrictInt`). */
export function bodyJudul(n: NilaiJudul): {
  isbn: string;
  judul: string;
  penulis: string;
  penerbit: string;
  tahun: number;
  kategori_id: number;
  harga: number;
} {
  const tahun = bacaBulat(n.tahun);
  const kategori = bacaBulat(n.kategori_id);
  const harga = bacaBulat(n.harga);
  if (tahun === null || kategori === null || harga === null) {
    throw new Error("bodyJudul dipanggil sebelum validasiJudul lulus");
  }
  return {
    isbn: n.isbn.trim(),
    judul: n.judul.trim(),
    penulis: n.penulis.trim(),
    penerbit: n.penerbit.trim(),
    tahun,
    kategori_id: kategori,
    harga,
  };
}

/** Judul sudah tersimpan tetapi unggah cover gagal; `pesan` backend apa adanya (IR-UI-04). */
export function pesanCoverGagal(pesan: string): string {
  return `Judul tersimpan, tetapi cover gagal diunggah: ${pesan}`;
}

/** FR-BKU-04: batas jumlah (1–100) dan keberadaan rak diputuskan backend. */
export function validasiTambahEksemplar(n: {
  jumlah: string;
  rak_id: string;
}): Record<string, string> {
  const galat: Record<string, string> = {};
  if (!n.jumlah.trim()) galat.jumlah = "Jumlah eksemplar wajib diisi.";
  else if (bacaBulat(n.jumlah) === null)
    galat.jumlah = "Jumlah eksemplar harus berupa bilangan bulat.";
  if (!n.rak_id.trim()) galat.rak_id = "Pilih rak.";
  return galat;
}

export function bodyTambahEksemplar(n: { jumlah: string; rak_id: string }): {
  jumlah: number;
  rak_id: number;
} {
  const jumlah = bacaBulat(n.jumlah);
  const rak = bacaBulat(n.rak_id);
  if (jumlah === null || rak === null) {
    throw new Error("bodyTambahEksemplar dipanggil sebelum validasiTambahEksemplar lulus");
  }
  return { jumlah, rak_id: rak };
}

/** OQ-20: konfirmasi sebelum simpan, karena eksemplar tidak dapat dihapus (mitigasi salah input). */
export function teksKonfirmasiTambah(n: { jumlah: number; judul: string; rak: string }): string {
  return `Tambahkan ${n.jumlah} eksemplar untuk judul "${n.judul}" di rak ${n.rak}? Eksemplar tidak dapat dihapus setelah ditambahkan.`;
}

/** FR-BKU-04: kode dari respons API (urut kode), bukan dihitung klien. */
export function pesanSuksesTambah(kode: string[]): string {
  const rentang = kode.length > 1 ? `${kode[0]} s.d. ${kode[kode.length - 1]}` : kode[0];
  return `${kode.length} eksemplar ditambahkan: ${rentang}.`;
}

/**
 * FR-BKU-07/08, K-02: aksi manual yang ditawarkan per status eksemplar (dibaca dari field `status`; backend
 * tetap menolak transisi yang tidak sah). Hanya Tersedia → Rusak. Dipinjam berubah lewat sirkulasi;
 * Hilang/Rusak tidak punya jalan kembali (tanpa "pulihkan", domain-rules §3).
 */
export function aksiEksemplar(status: string): { tandaiRusak: boolean; keterangan: string | null } {
  if (status === "TERSEDIA") return { tandaiRusak: true, keterangan: null };
  if (status === "DIPINJAM") return { tandaiRusak: false, keterangan: "Diubah lewat sirkulasi" };
  return { tandaiRusak: false, keterangan: null };
}

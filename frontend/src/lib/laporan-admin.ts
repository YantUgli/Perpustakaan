/**
 * Logika halaman dashboard & laporan admin (WP 5.4.9, FR-LAP-01..04). Angka dashboard, `total_nominal`, dan
 * status `Terlambat` (field `terlambat`) selalu dari API; satu-satunya turunan klien adalah total & persen
 * eksemplar untuk tampilan (`ringkasEksemplar`, keputusan Ayen 10/10/2026). Daftar dan tautan ekspor dibentuk
 * dari **satu** penyusun filter agar berkas yang diunduh cocok dengan layar.
 */
import { urlApi } from "./api";
import { halamanDariParam } from "./halaman";
import {
  LABEL_CARA_PENYELESAIAN,
  LABEL_JENIS_TAGIHAN,
  LABEL_STATUS,
  LABEL_TERLAMBAT,
} from "./label";

type Param = string | string[] | undefined;
type Opsi = { nilai: string; label: string }[];

/** Pilihan status laporan transaksi, saling lepas (OQ-37). `TERLAMBAT` hanya nilai filter, tidak pernah disimpan. */
export const STATUS_TRANSAKSI = [
  "DIPINJAM",
  "TERLAMBAT",
  "DIKEMBALIKAN",
  "HILANG",
  "RUSAK",
] as const;
const JENIS = ["DENDA", "PENGGANTIAN"] as const;
const STATUS_TAGIHAN = ["BELUM_LUNAS", "LUNAS"] as const;
const CARA = ["TUNAI", "TRANSFER", "BUKU_PENGGANTI"] as const;

/** Urutan tampil eksemplar per status di dashboard (OQ-40: keempat status selalu dikirim API, walau 0). */
export const URUT_STATUS_EKSEMPLAR = ["TERSEDIA", "DIPINJAM", "HILANG", "RUSAK"] as const;

export type StatusTransaksi = (typeof STATUS_TRANSAKSI)[number];
export type FormatEkspor = "pdf" | "xlsx";

export type FilterTransaksi = {
  /** `YYYY-MM-DD`, tanggal pinjam (OQ-07). Urutan dari > sampai diputuskan backend (OQ-38). */
  dari?: string;
  sampai?: string;
  status?: StatusTransaksi;
  halaman: number;
};

export type FilterTagihanLaporan = {
  /** `YYYY-MM-DD`, tanggal dibentuk (OQ-11). */
  dari?: string;
  sampai?: string;
  jenis?: (typeof JENIS)[number];
  status?: (typeof STATUS_TAGIHAN)[number];
  cara?: (typeof CARA)[number];
  halaman: number;
};

const semua = (teks: string, daftar: Record<string, string>): Opsi => [
  { nilai: "", label: teks },
  ...Object.entries(daftar).map(([nilai, label]) => ({ nilai, label })),
];

export const OPSI_STATUS_TRANSAKSI: Opsi = semua("Semua status", {
  DIPINJAM: LABEL_STATUS.DIPINJAM,
  TERLAMBAT: LABEL_TERLAMBAT,
  DIKEMBALIKAN: LABEL_STATUS.DIKEMBALIKAN,
  HILANG: LABEL_STATUS.HILANG,
  RUSAK: LABEL_STATUS.RUSAK,
});
export const OPSI_JENIS_LAPORAN: Opsi = semua("Semua jenis", LABEL_JENIS_TAGIHAN);
export const OPSI_STATUS_TAGIHAN_LAPORAN: Opsi = semua("Semua status", {
  BELUM_LUNAS: LABEL_STATUS.BELUM_LUNAS,
  LUNAS: LABEL_STATUS.LUNAS,
});
export const OPSI_CARA_LAPORAN: Opsi = semua("Semua metode", LABEL_CARA_PENYELESAIAN);

function pilihan<T extends string>(nilai: Param, sah: readonly T[]): T | undefined {
  return typeof nilai === "string" && (sah as readonly string[]).includes(nilai)
    ? (nilai as T)
    : undefined;
}

/** `YYYY-MM-DD` yang benar-benar ada di kalender (2026-02-30 ditolak); selain itu dibuang. */
function tanggal(nilai: Param): string | undefined {
  if (typeof nilai !== "string") return undefined;
  const t = nilai.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return undefined;
  const [tahun, bulan, hari] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(tahun, bulan - 1, hari));
  const nyata =
    d.getUTCFullYear() === tahun && d.getUTCMonth() === bulan - 1 && d.getUTCDate() === hari;
  return nyata ? t : undefined;
}

/** Filter transaksi dari `searchParams`. Nilai di luar kontrak dibuang (seperti pola 5.4.8). */
export function filterTransaksiDariParam(p: Record<string, Param>): FilterTransaksi {
  const f: FilterTransaksi = { halaman: halamanDariParam(p.halaman) };
  const dari = tanggal(p.dari);
  const sampai = tanggal(p.sampai);
  const status = pilihan(p.status, STATUS_TRANSAKSI);
  if (dari) f.dari = dari;
  if (sampai) f.sampai = sampai;
  if (status) f.status = status;
  return f;
}

export function filterTagihanDariParam(p: Record<string, Param>): FilterTagihanLaporan {
  const f: FilterTagihanLaporan = { halaman: halamanDariParam(p.halaman) };
  const dari = tanggal(p.dari);
  const sampai = tanggal(p.sampai);
  const jenis = pilihan(p.jenis, JENIS);
  const status = pilihan(p.status, STATUS_TAGIHAN);
  const cara = pilihan(p.cara, CARA);
  if (dari) f.dari = dari;
  if (sampai) f.sampai = sampai;
  if (jenis) f.jenis = jenis;
  if (status) f.status = status;
  if (cara) f.cara = cara;
  return f;
}

function susun(pasangan: [string, string | undefined][]): URLSearchParams {
  const q = new URLSearchParams();
  for (const [k, v] of pasangan) if (v) q.set(k, v);
  return q;
}

/** Satu-satunya penyusun filter transaksi: dipakai daftar, ekspor, dan paginasi (urutan tetap). */
export function paramFilterTransaksi(f: FilterTransaksi): URLSearchParams {
  return susun([
    ["dari", f.dari],
    ["sampai", f.sampai],
    ["status", f.status],
  ]);
}

export function paramFilterTagihan(f: FilterTagihanLaporan): URLSearchParams {
  return susun([
    ["dari", f.dari],
    ["sampai", f.sampai],
    ["jenis", f.jenis],
    ["status", f.status],
    ["cara", f.cara],
  ]);
}

const denganHalaman = (q: URLSearchParams, halaman: number) => {
  q.set("halaman", String(halaman));
  return q.toString();
};

export const queryTransaksi = (f: FilterTransaksi) =>
  denganHalaman(paramFilterTransaksi(f), f.halaman);
export const queryTagihan = (f: FilterTagihanLaporan) =>
  denganHalaman(paramFilterTagihan(f), f.halaman);

function urlEkspor(jenis: "transaksi" | "tagihan", q: URLSearchParams, format: FormatEkspor) {
  q.set("format", format);
  return urlApi(`/admin/laporan/${jenis}/ekspor?${q.toString()}`);
}

/** Tautan unduh (FR-LAP-04): filter aktif + format, tanpa halaman (backend mengekspor semua baris). */
export const urlEksporTransaksi = (f: FilterTransaksi, format: FormatEkspor) =>
  urlEkspor("transaksi", paramFilterTransaksi(f), format);
export const urlEksporTagihan = (f: FilterTagihanLaporan, format: FormatEkspor) =>
  urlEkspor("tagihan", paramFilterTagihan(f), format);

/** Parameter yang dipertahankan di tautan `Paginasi` (tanpa nilai kosong). */
export function paramsPaginasi(
  f: FilterTransaksi | FilterTagihanLaporan,
): Record<string, string | undefined> {
  // Filter transaksi tidak punya `jenis`/`cara` (undefined → dilewati), jadi satu penyusun cukup.
  return Object.fromEntries(paramFilterTagihan(f as FilterTagihanLaporan).entries());
}

/**
 * Empat status eksemplar dalam urutan tetap; jumlah apa adanya dari API.
 * OQ-40: backend selalu mengirim keempat status. Status yang hilang adalah pelanggaran kontrak, bukan
 * jumlah nol, jadi `jumlah` = `null` (UI menampilkan "—"), tidak diisi 0.
 */
export function urutkanEksemplar(
  dict: Partial<Record<string, number>>,
): { status: string; jumlah: number | null }[] {
  return URUT_STATUS_EKSEMPLAR.map((status) => ({ status, jumlah: dict[status] ?? null }));
}

export type RingkasanEksemplar = {
  /** Jumlah keempat status (semua eksemplar, termasuk Hilang & Rusak; bukan Y katalog FR-KTL-03). */
  total: number | null;
  baris: { status: string; jumlah: number | null; persen: number | null }[];
};

/**
 * Total & persen eksemplar untuk kartu dan donut dashboard. **Hanya tampilan** (keputusan Ayen 10/10/2026):
 * total = jumlah 4 status `eksemplar_per_status`; persen `Math.round`, sehingga jumlahnya bisa 99–101%.
 * Satu status tidak dikirim (OQ-40) → total dan semua persen `null` ("—"); total 0 → persen `null`.
 */
export function ringkasEksemplar(dict: Partial<Record<string, number>>): RingkasanEksemplar {
  const urut = urutkanEksemplar(dict);
  const lengkap = urut.every((b) => b.jumlah !== null);
  const total = lengkap ? urut.reduce((a, b) => a + (b.jumlah ?? 0), 0) : null;
  return {
    total,
    baris: urut.map((b) => ({
      ...b,
      persen: total && b.jumlah !== null ? Math.round((b.jumlah / total) * 100) : null,
    })),
  };
}

/**
 * Geometri segmen donut (stroke-dasharray pada lingkaran ber-`keliling`): `mulai` = posisi awal di keliling,
 * `panjang` = panjang garis setelah dikurangi `celah` pemisah. Nilai 0 dilewati (indeks asli tetap, untuk warna);
 * satu-satunya nilai tak nol → lingkaran penuh tanpa celah. Ada `null` atau semua 0 → tanpa segmen.
 */
export function segmenDonut(
  jumlah: (number | null)[],
  keliling: number,
  celah: number,
): { indeks: number; panjang: number; mulai: number }[] {
  if (jumlah.some((n) => n === null)) return [];
  const nilai = jumlah as number[];
  const total = nilai.reduce((a, n) => a + n, 0);
  if (total === 0) return [];
  const tunggal = nilai.filter((n) => n > 0).length === 1;
  const hasil: { indeks: number; panjang: number; mulai: number }[] = [];
  let mulai = 0;
  nilai.forEach((n, indeks) => {
    if (n === 0) return;
    const bagian = (n / total) * keliling;
    hasil.push({ indeks, panjang: tunggal ? keliling : Math.max(bagian - celah, 0), mulai });
    mulai += bagian;
  });
  return hasil;
}

/**
 * Logika halaman tagihan admin (WP 5.4.8, FR-TGH-01..06). Klien tidak memutuskan aturan bisnis:
 * kecocokan nominal (FR-TGH-02), batas tanggal (OQ-28), dan status eksemplar (FR-TGH-04) diputuskan backend.
 */
import type { components } from "./api-skema";
import { formatRupiah } from "./format";
import { halamanDariParam } from "./halaman";

type StatusTagihan = components["schemas"]["StatusTagihan"];
type JenisTagihan = components["schemas"]["JenisTagihan"];
type CaraPenyelesaian = components["schemas"]["CaraPenyelesaian"];

const STATUS: readonly StatusTagihan[] = ["BELUM_LUNAS", "LUNAS"];
const JENIS: readonly JenisTagihan[] = ["DENDA", "PENGGANTIAN"];

export type FilterTagihan = {
  status?: StatusTagihan;
  jenis?: JenisTagihan;
  /** Kode anggota apa adanya (di-trim); backend menormalisasi & mencocokkan persis (OQ-29). */
  anggota?: string;
  halaman: number;
};

type Param = string | string[] | undefined;

function satu<T extends string>(nilai: Param, sah: readonly T[]): T | undefined {
  return typeof nilai === "string" && (sah as readonly string[]).includes(nilai)
    ? (nilai as T)
    : undefined;
}

/** Filter daftar dari `searchParams`. Nilai status/jenis di luar kontrak dibuang (backend menolaknya dengan 422). */
export function filterDariParam(p: Record<string, Param>): FilterTagihan {
  const f: FilterTagihan = { halaman: halamanDariParam(p.halaman) };
  const status = satu(p.status, STATUS);
  const jenis = satu(p.jenis, JENIS);
  const anggota = typeof p.anggota === "string" ? p.anggota.trim() : "";
  if (status) f.status = status;
  if (jenis) f.jenis = jenis;
  if (anggota) f.anggota = anggota;
  return f;
}

/** Query string untuk `GET /admin/tagihan` dan tautan halaman (urutan tetap: status, jenis, anggota, halaman). */
export function queryDaftar(f: FilterTagihan): string {
  const q = new URLSearchParams();
  if (f.status) q.set("status", f.status);
  if (f.jenis) q.set("jenis", f.jenis);
  if (f.anggota) q.set("anggota", f.anggota);
  q.set("halaman", String(f.halaman));
  return q.toString();
}

/** FR-TGH-02/03: Buku Pengganti hanya ditawarkan untuk tagihan Penggantian (backend tetap menegakkan). */
export function caraTersedia(jenis: JenisTagihan): CaraPenyelesaian[] {
  return jenis === "PENGGANTIAN" ? ["TUNAI", "TRANSFER", "BUKU_PENGGANTI"] : ["TUNAI", "TRANSFER"];
}

export type NilaiPenyelesaian = { cara: CaraPenyelesaian | ""; nominal: string; tanggal: string };

export const PESAN_PENYELESAIAN = {
  caraWajib: "Pilih cara penyelesaian.",
  tanggalWajib: "Tanggal penyelesaian wajib diisi.",
  tanggalTerimaWajib: "Tanggal penerimaan buku wajib diisi.",
  /** Menyebut nominal tagihan karena keterangan isian tersembunyi saat galat tampil. */
  nominalBulat: (nominalTagihan: number) =>
    `Nominal harus berupa angka Rupiah bulat tanpa titik atau koma (${formatRupiah(nominalTagihan)}).`,
} as const;

const POLA_NOMINAL = /^[0-9]+$/;

/**
 * Hanya isian wajib & bentuk angka. TIDAK membandingkan nominal dengan tagihan (FR-TGH-02) dan TIDAK
 * menghitung batas "hari ini" (OQ-28, K-07) — keduanya diputuskan backend, pesannya ditampilkan apa adanya.
 */
export function validasiPenyelesaian(
  n: NilaiPenyelesaian,
  tagihan: { nominal: number },
): Record<string, string> {
  const galat: Record<string, string> = {};
  if (!n.cara) galat.cara = PESAN_PENYELESAIAN.caraWajib;
  if (!n.tanggal) {
    galat.tanggal =
      n.cara === "BUKU_PENGGANTI"
        ? PESAN_PENYELESAIAN.tanggalTerimaWajib
        : PESAN_PENYELESAIAN.tanggalWajib;
  }
  if (n.cara === "TUNAI" || n.cara === "TRANSFER") {
    const nominal = n.nominal.trim();
    if (!nominal) {
      // Sama dengan backend `services/tagihan.py` (TGH_NOMINAL_WAJIB).
      galat.nominal = `Nominal pembayaran wajib diisi (${formatRupiah(tagihan.nominal)}).`;
    } else if (!POLA_NOMINAL.test(nominal) || !Number.isSafeInteger(Number(nominal))) {
      galat.nominal = PESAN_PENYELESAIAN.nominalBulat(tagihan.nominal);
    }
  }
  return galat;
}

/** Body `POST /admin/tagihan/{id}/penyelesaian`. OQ-08: Buku Pengganti tanpa `nominal`. */
export function bodyPenyelesaian(n: NilaiPenyelesaian): {
  cara: CaraPenyelesaian;
  tanggal: string;
  nominal?: number;
} {
  const cara = n.cara as CaraPenyelesaian;
  if (cara === "BUKU_PENGGANTI") return { cara, tanggal: n.tanggal };
  return { cara, nominal: Number(n.nominal.trim()), tanggal: n.tanggal };
}

/** P3 (keputusan pemilik proyek): FR-TGH-04/BR-20 + pengingat label (Brief §6.5 langkah 3). */
export function pesanSukses(cara: CaraPenyelesaian, kodeEksemplar: string): string {
  if (cara !== "BUKU_PENGGANTI") return "Tagihan telah lunas.";
  return (
    `Tagihan telah lunas. Eksemplar ${kodeEksemplar} kembali berstatus Tersedia dengan kode yang sama; ` +
    `pasang label ${kodeEksemplar} pada buku pengganti.`
  );
}

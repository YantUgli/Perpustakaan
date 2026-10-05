/**
 * Label UI dari kode API (IR-UI-03, domain-rules §2). Teks wajib sama persis dengan `LABEL_*` di
 * backend/app/models/status.py — dijaga oleh label.test.ts.
 *
 * `Terlambat` bukan status tersimpan (FR-DND-05): ia hanya muncul dari field `terlambat` di respons API.
 */

/** Status eksemplar, item transaksi, dan tagihan. */
export const LABEL_STATUS = {
  TERSEDIA: "Tersedia",
  DIPINJAM: "Dipinjam",
  DIKEMBALIKAN: "Dikembalikan",
  HILANG: "Hilang",
  RUSAK: "Rusak",
  BELUM_LUNAS: "Belum Lunas",
  LUNAS: "Lunas",
} as const;

export type KodeStatus = keyof typeof LABEL_STATUS;

export const LABEL_TERLAMBAT = "Terlambat";

export const LABEL_JENIS_TAGIHAN = { DENDA: "Denda", PENGGANTIAN: "Penggantian" } as const;

export const LABEL_CARA_PENYELESAIAN = {
  TUNAI: "Tunai",
  TRANSFER: "Transfer",
  BUKU_PENGGANTI: "Buku Pengganti",
} as const;

/** Nama token warna badge (design-system §5; Belum Lunas = hilang, Lunas = tersedia). */
export type NadaStatus =
  "tersedia" | "dipinjam" | "dikembalikan" | "terlambat" | "hilang" | "rusak";

const NADA: Record<KodeStatus, NadaStatus> = {
  TERSEDIA: "tersedia",
  DIPINJAM: "dipinjam",
  DIKEMBALIKAN: "dikembalikan",
  HILANG: "hilang",
  RUSAK: "rusak",
  BELUM_LUNAS: "hilang",
  LUNAS: "tersedia",
};

function kodeDikenal(kode: string): kode is KodeStatus {
  return Object.hasOwn(LABEL_STATUS, kode);
}

/**
 * Label dan nada warna untuk satu kode status API. `terlambat` (field API) hanya bermakna untuk item
 * berstatus `DIPINJAM`; kode yang tidak dikenal (termasuk `TERLAMBAT`) adalah pelanggaran kontrak API.
 */
export function labelStatus(kode: string, terlambat = false): { label: string; nada: NadaStatus } {
  if (!kodeDikenal(kode)) throw new Error(`Kode status tidak dikenal: ${JSON.stringify(kode)}`);
  if (kode === "DIPINJAM" && terlambat) return { label: LABEL_TERLAMBAT, nada: "terlambat" };
  return { label: LABEL_STATUS[kode], nada: NADA[kode] };
}

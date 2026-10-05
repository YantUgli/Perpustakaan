/**
 * Logika tampilan area anggota (WP 5.4.4). Hanya menyusun teks dari field API; tidak menghitung tanggal,
 * denda, maupun kelayakan sendiri (aturan frontend: backend sumber kebenaran).
 */

type SisaHari = { sisa_hari: number; terlambat: boolean; hari_terlambat: number };

/**
 * FR-AGT-02, OQ-34: `sisa_hari` = max(jatuh tempo − hari ini WIB, 0), `terlambat` & `hari_terlambat` terpisah.
 * Tepat pada jatuh tempo: sisa 0 dan tidak terlambat.
 */
export function teksSisaHari({ sisa_hari, terlambat, hari_terlambat }: SisaHari): string {
  if (terlambat) return `Terlambat ${hari_terlambat} hari`;
  if (sisa_hari === 0) return "Jatuh tempo hari ini";
  return `${sisa_hari} hari lagi`;
}

const JUDUL_ALASAN: Record<string, string> = {
  PJM_ADA_TAGIHAN: "Anda memiliki tagihan yang belum lunas",
  PJM_ADA_TERLAMBAT: "Anda memiliki buku yang terlambat dikembalikan",
};

export const JUDUL_ALASAN_UMUM = "Ada hal yang perlu diselesaikan";

/**
 * FR-AGT-05 (decisions §B "Alasan blokir di area anggota"): judul berkalimat "Anda …" dari `alasan[].kode`.
 * Rincian (jumlah, total, judul, hari) tetap `alasan[].pesan` dari backend, ditampilkan apa adanya.
 */
export function judulAlasan(kode: string): string {
  return JUDUL_ALASAN[kode] ?? JUDUL_ALASAN_UMUM;
}

/** Dashboard: 3 pinjaman pertama. Backend sudah mengurutkan menurut jatuh tempo lalu id; tidak diurutkan ulang. */
export function pinjamanTerdekat<T>(daftar: T[], jumlah = 3): T[] {
  return daftar.slice(0, jumlah);
}

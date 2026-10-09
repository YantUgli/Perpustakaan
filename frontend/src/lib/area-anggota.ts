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

/** Batas `per_halaman` backend (decisions §B "Daftar berhalaman"); dipakai untuk mengambil semua halaman. */
export const PER_HALAMAN_SEMUA = 100;
/** Nama lama, tetap diekspor: tagihan dashboard memakai batas yang sama. */
export const PER_HALAMAN_TAGIHAN = PER_HALAMAN_SEMUA;

type Halaman<T> = { data: T[]; total: number };

/**
 * Semua baris daftar berhalaman, hanya untuk tampilan (D1 dashboard; Riwayat hal-13). Halaman 1 lebih dulu, lalu
 * halaman 2..ceil(total/100) saja; digabung berurutan sehingga urutan API terjaga (tanpa urut ulang). Halaman mana
 * pun gagal → galat diteruskan (tidak ada data parsial).
 */
export async function ambilSemuaHalaman<T>(
  pathDasar: string,
  ambil: (path: string) => Promise<Halaman<T>>,
): Promise<T[]> {
  const path = (h: number) => `${pathDasar}?halaman=${h}&per_halaman=${PER_HALAMAN_SEMUA}`;
  const pertama = await ambil(path(1));
  const jumlah = Math.ceil(pertama.total / PER_HALAMAN_SEMUA);
  const sisa = await Promise.all(
    Array.from({ length: Math.max(jumlah - 1, 0) }, (_, i) => ambil(path(i + 2))),
  );
  return [pertama, ...sisa].flatMap((h) => h.data);
}

/**
 * D1 (Ayen 08/10/2026), FR-AGT-04 ringkas: tagihan `BELUM_LUNAS` (urutan API) untuk kartu "Tagihan Aktif"
 * (`.length`) dan panel Tagihan Aktif (3 teratas, keputusan 09/10/2026). Galat diteruskan. Tidak menentukan
 * kelayakan apa pun.
 */
export async function tagihanAktif<T extends { status: string }>(
  ambil: (path: string) => Promise<Halaman<T>>,
): Promise<T[]> {
  // Hanya tampilan (D1); kelayakan dari /anggota/kelayakan
  const semua = await ambilSemuaHalaman("/anggota/tagihan", ambil);
  return semua.filter((t) => t.status === "BELUM_LUNAS");
}

/** Status item riwayat (domain-rules §2); "Terlambat" bukan status, jadi bukan tab maupun kartu (IR-UI-03). */
export const STATUS_RIWAYAT = ["DIPINJAM", "DIKEMBALIKAN", "HILANG", "RUSAK"] as const;
export type StatusRiwayat = (typeof STATUS_RIWAYAT)[number];

/** Riwayat hal-13: per halaman sama dengan bawaan backend. */
export const PER_HALAMAN_RIWAYAT = 20;

/** `?status=` → kode sah, selain itu (tak dikenal, kosong, berulang) `undefined` = Semua (kontrol tertutup). */
export function statusRiwayatDariParam(
  nilai: string | string[] | undefined,
): StatusRiwayat | undefined {
  return typeof nilai === "string" && (STATUS_RIWAYAT as readonly string[]).includes(nilai)
    ? (nilai as StatusRiwayat)
    : undefined;
}

/**
 * Hitungan per kode `status` seluruh item, hanya tampilan (keputusan Ayen 09/10/2026). `DIPINJAM` mencakup item
 * terlambat (status tersimpan tetap Dipinjam; BR-08, OQ-40).
 */
export function hitungPerStatus(item: { status: string }[]): Record<StatusRiwayat, number> {
  const hasil = { DIPINJAM: 0, DIKEMBALIKAN: 0, HILANG: 0, RUSAK: 0 };
  for (const i of item) if (i.status in hasil) hasil[i.status as StatusRiwayat] += 1;
  return hasil;
}

/** Potongan halaman di klien; di luar jangkauan → kosong (seperti backend). */
export function potongHalaman<T>(semua: T[], halaman: number, per = PER_HALAMAN_RIWAYAT): T[] {
  return semua.slice((halaman - 1) * per, halaman * per);
}

type TanggalItem = {
  status: string;
  tanggal_kembali: string | null;
  tanggal_kejadian: string | null;
};

/**
 * Tanggal penutup item riwayat (OQ-35): kejadian untuk Hilang/Rusak, kembali untuk lainnya; `null` = belum ada
 * ("—" untuk kejadian, "Belum dikembalikan" untuk kembali). Dipakai kartu dan tabel Riwayat.
 */
export function tanggalAkhir(item: TanggalItem): {
  label: "Tanggal kejadian" | "Tanggal kembali";
  tanggal: string | null;
  kosong: string;
} {
  if (item.status === "HILANG" || item.status === "RUSAK") {
    return { label: "Tanggal kejadian", tanggal: item.tanggal_kejadian, kosong: "—" };
  }
  return { label: "Tanggal kembali", tanggal: item.tanggal_kembali, kosong: "Belum dikembalikan" };
}

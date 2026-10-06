/**
 * Katalog publik (BR-01, FR-KTL-01..05, IR-UI-05, OQ-44 filter & urutan). Klien hanya menyusun URL dan teks
 * tampilan: pencocokan kata kunci, filter, urutan, ketersediaan X/Y, dan daftar rak semuanya dari backend.
 */
import type { components, operations } from "./api-skema";
import { formatAngka } from "./format";
import { halamanDariParam } from "./halaman";

export type JudulKatalog = components["schemas"]["JudulKatalogKeluar"];
export type HalamanKatalog = components["schemas"]["HalamanKatalog"];
export type Kategori = components["schemas"]["KategoriKeluar"];
type RakKatalog = components["schemas"]["RakKatalogKeluar"];

type Param = string | string[] | undefined;
type QueryCari = NonNullable<
  operations["cari_judul_api_v1_katalog_judul_get"]["parameters"]["query"]
>;
export type Urut = NonNullable<QueryCari["urut"]>;

/** ASUMSI(OQ-44): pilihan "Urutkan"; `judul_az` = bawaan backend, tidak ditulis ke URL. */
export const OPSI_URUT: { nilai: Urut; label: string }[] = [
  { nilai: "judul_az", label: "Judul A–Z" },
  { nilai: "tahun_terbaru", label: "Tahun terbit (terbaru)" },
  { nilai: "tahun_terlama", label: "Tahun terbit (terlama)" },
];
const URUT_BAWAAN = "judul_az" satisfies Urut;

/**
 * Isian katalog dari URL. Isian opsional hanya ada bila aktif, sehingga `{ halaman }` = tanpa filter.
 * `kategori_id` dan `tahun_*` disimpan sebagai teks apa adanya (tidak diubah ke Number).
 */
export type FilterKatalog = {
  q?: string;
  kategori_id?: string[];
  tersedia?: true;
  tahun_dari?: string;
  tahun_sampai?: string;
  urut?: Exclude<Urut, "judul_az">;
  halaman: number;
};
type FilterTanpaHalaman = Omit<FilterKatalog, "halaman"> & { halaman?: number };

const satu = (v: Param): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

/**
 * `?q=&kategori_id=&tersedia=&tahun_dari=&tahun_sampai=&urut=&halaman=` dari URL.
 * - ASUMSI(OQ-24): `q` apa adanya (tanpa trim/normalisasi ISBN, OQ-13); string kosong = tanpa kata kunci.
 * - ASUMSI(OQ-44): `kategori_id`, `tersedia`, `urut` berasal dari kontrol tertutup → nilai tak sah dibuang
 *   (`kategori_id` hanya angka desimal, tanpa duplikat; `tersedia` hanya "true"; `urut` hanya 3 pilihan,
 *   bawaan tidak disimpan). `tahun_*` diketik bebas → SEMUA nilai tidak kosong diteruskan apa adanya, agar
 *   backend menolak dengan pesan spesifik (IR-UI-04; "abc", 0, dari > sampai), bukan diam-diam diabaikan.
 */
export function filterKatalogDariParam(p: Record<string, Param>): FilterKatalog {
  const f: FilterKatalog = { halaman: halamanDariParam(p.halaman) };
  const q = satu(p.q);
  if (q !== undefined) f.q = q;
  const daftar = typeof p.kategori_id === "string" ? [p.kategori_id] : (p.kategori_id ?? []);
  const kategori = [...new Set(daftar.filter((v) => /^[0-9]+$/.test(v)))];
  if (kategori.length > 0) f.kategori_id = kategori;
  if (p.tersedia === "true") f.tersedia = true;
  const dari = satu(p.tahun_dari);
  if (dari !== undefined) f.tahun_dari = dari;
  const sampai = satu(p.tahun_sampai);
  if (sampai !== undefined) f.tahun_sampai = sampai;
  const urut = OPSI_URUT.find((o) => o.nilai === p.urut && o.nilai !== URUT_BAWAAN);
  if (urut) f.urut = urut.nilai as FilterKatalog["urut"];
  return f;
}

/** Pasangan parameter dalam urutan tetap (tanpa `halaman`); `kategori_id` berulang. */
export function pasanganKatalog(f: FilterTanpaHalaman): [string, string][] {
  const hasil: [string, string][] = [];
  if (f.q !== undefined) hasil.push(["q", f.q]);
  for (const id of f.kategori_id ?? []) hasil.push(["kategori_id", id]);
  if (f.tersedia) hasil.push(["tersedia", "true"]);
  if (f.tahun_dari !== undefined) hasil.push(["tahun_dari", f.tahun_dari]);
  if (f.tahun_sampai !== undefined) hasil.push(["tahun_sampai", f.tahun_sampai]);
  if (f.urut !== undefined) hasil.push(["urut", f.urut]);
  return hasil;
}

/** Query `GET /katalog/judul`: urutan tetap, `halaman` terakhir; `per_halaman` bawaan backend. */
export function queryKatalog(f: FilterKatalog): string {
  const q = new URLSearchParams(pasanganKatalog(f));
  q.set("halaman", String(f.halaman));
  return q.toString();
}

/** URL halaman `/katalog` untuk filter `f`, SELALU tanpa `halaman` (setiap perubahan → halaman 1). */
export function urlKatalog(f: FilterTanpaHalaman): string {
  const q = new URLSearchParams(pasanganKatalog(f)).toString();
  return q ? `/katalog?${q}` : "/katalog";
}

/** ASUMSI(OQ-44): ada filter selain kata kunci & urutan (dasar teks state kosong). */
export function adaFilter(f: FilterTanpaHalaman): boolean {
  return Boolean(f.kategori_id?.length || f.tersedia || f.tahun_dari || f.tahun_sampai);
}

/** Keputusan Ayen (2026-10-06): "Reset Semua" membuang filter & urutan, `q` dipertahankan. */
export function urlReset(f: FilterTanpaHalaman): string {
  return urlKatalog({ q: f.q });
}

/** Ganti urutan → halaman 1; `judul_az` (bawaan) menghapus `urut` dari URL. */
export function urlUrutan(f: FilterTanpaHalaman, urut: Urut): string {
  return urlKatalog({ ...f, urut: urut === URUT_BAWAAN ? undefined : urut });
}

/** Chip filter aktif (hal-04): satu per parameter; × = URL tanpa parameter itu saja (halaman 1). */
export function chipFilter(
  f: FilterTanpaHalaman,
  kategori: Kategori[],
): { label: string; href: string }[] {
  const chip: { label: string; href: string }[] = [];
  if (f.q !== undefined)
    chip.push({ label: `Kata kunci: ${f.q}`, href: urlKatalog({ ...f, q: undefined }) });
  for (const id of f.kategori_id ?? []) {
    const nama = kategori.find((k) => String(k.id) === id)?.nama;
    chip.push({
      label: nama !== undefined ? `Kategori: ${nama}` : "Kategori tidak dikenal",
      href: urlKatalog({ ...f, kategori_id: f.kategori_id?.filter((k) => k !== id) }),
    });
  }
  if (f.tersedia)
    chip.push({ label: "Tersedia sekarang", href: urlKatalog({ ...f, tersedia: undefined }) });
  if (f.tahun_dari !== undefined)
    chip.push({
      label: `Tahun dari: ${f.tahun_dari}`,
      href: urlKatalog({ ...f, tahun_dari: undefined }),
    });
  if (f.tahun_sampai !== undefined)
    chip.push({
      label: `Tahun sampai: ${f.tahun_sampai}`,
      href: urlKatalog({ ...f, tahun_sampai: undefined }),
    });
  return chip;
}

/**
 * Isi tanda kutip judul "Ditemukan N buku untuk “…”" (hal-04; keputusan pemilik proyek 06/10/2026,
 * opsi 2): kata kunci dan filter aktif digabung koma, urutan sama dengan chip. `undefined` bila tidak ada
 * kata kunci maupun filter (urutan bukan filter).
 */
export function teksJudulHasil(f: FilterTanpaHalaman, kategori: Kategori[]): string | undefined {
  const bagian: string[] = [];
  if (f.q !== undefined) bagian.push(f.q);
  for (const id of f.kategori_id ?? []) {
    bagian.push(kategori.find((k) => String(k.id) === id)?.nama ?? "Kategori tidak dikenal");
  }
  if (f.tersedia) bagian.push("Tersedia sekarang");
  if (f.tahun_dari !== undefined && f.tahun_sampai !== undefined)
    bagian.push(`tahun ${f.tahun_dari}–${f.tahun_sampai}`);
  else if (f.tahun_dari !== undefined) bagian.push(`tahun ${f.tahun_dari} ke atas`);
  else if (f.tahun_sampai !== undefined) bagian.push(`tahun ${f.tahun_sampai} ke bawah`);
  return bagian.length > 0 ? bagian.join(", ") : undefined;
}

/** FR-KTL-04: parameter yang dibawa `Paginasi` (semua kecuali `halaman`). */
export function paramsPaginasi(f: FilterTanpaHalaman): Record<string, string | string[]> {
  const hasil: Record<string, string | string[]> = {};
  for (const [k, v] of pasanganKatalog(f)) {
    if (k === "kategori_id") hasil[k] = [...((hasil[k] as string[] | undefined) ?? []), v];
    else hasil[k] = v;
  }
  return hasil;
}

/** ASUMSI(OQ-43, diperbarui OQ-44): kategori di beranda → `/katalog?kategori_id=<id>` (hasil tepat). */
export function tautanKategori(id: number): string {
  return urlKatalog({ kategori_id: [String(id)] });
}

/**
 * FR-KTL-03, OQ-23: X = `tersedia`, Y = `total` dari API apa adanya (judul tanpa eksemplar → "0 dari 0").
 * `ringkas` ("X dari Y tersedia", tanpa "eksemplar") hanya untuk kartu beranda yang sempit (keputusan
 * 2026-10-06); /katalog dan detail memakai bentuk lengkap.
 */
export function teksKetersediaan(
  j: Pick<JudulKatalog, "tersedia" | "total">,
  ringkas = false,
): string {
  const satuan = ringkas ? "" : " eksemplar";
  return `${formatAngka(j.tersedia)} dari ${formatAngka(j.total)}${satuan} tersedia`;
}

/** ASUMSI(OQ-22, OQ-08): satu rak = kode, ditambah lokasi bila ada. Urutan & keunikan dari API. */
export function teksRak(r: RakKatalog): string {
  return r.lokasi ? `${r.kode} (${r.lokasi})` : r.kode;
}

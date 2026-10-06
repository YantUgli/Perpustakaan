/**
 * Katalog publik (BR-01, FR-KTL-01..05, IR-UI-05). Klien hanya menyusun URL dan teks tampilan:
 * pencocokan kata kunci, ketersediaan X/Y, dan daftar rak semuanya dari backend.
 */
import type { components } from "./api-skema";
import { formatAngka } from "./format";
import { halamanDariParam } from "./halaman";

export type JudulKatalog = components["schemas"]["JudulKatalogKeluar"];
export type HalamanKatalog = components["schemas"]["HalamanKatalog"];
export type Kategori = components["schemas"]["KategoriKeluar"];
type RakKatalog = components["schemas"]["RakKatalogKeluar"];

type Param = string | string[] | undefined;
export type FilterKatalog = { q?: string; halaman: number };

/**
 * `?q=&halaman=` dari URL. ASUMSI(OQ-24): `q` diteruskan apa adanya (tanpa trim/normalisasi ISBN, OQ-13);
 * hanya string kosong yang dianggap tanpa kata kunci (backend memperlakukannya sama).
 */
export function filterKatalogDariParam(p: Record<string, Param>): FilterKatalog {
  const f: FilterKatalog = { halaman: halamanDariParam(p.halaman) };
  if (typeof p.q === "string" && p.q !== "") f.q = p.q;
  return f;
}

/** Query string untuk `GET /katalog/judul` (urutan tetap: q, halaman; `per_halaman` bawaan backend). */
export function queryKatalog(f: FilterKatalog): string {
  const q = new URLSearchParams();
  if (f.q !== undefined) q.set("q", f.q);
  q.set("halaman", String(f.halaman));
  return q.toString();
}

/** ASUMSI(OQ-43): kategori di beranda dicari lewat kata kunci `q` = nama kategori, tanpa `kategori_id`. */
export function tautanKategori(nama: string): string {
  return `/katalog?${new URLSearchParams({ q: nama }).toString()}`;
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

import type { NamaIkon } from "@/components/ui/Ikon";

/**
 * Ikon kartu kategori di beranda (hal-02): hanya tampilan, tidak memengaruhi data/tautan. Kategori dari API
 * (OQ-43) dicocokkan ke ikon lewat kata kunci pada namanya (tak peka huruf, cocok sebagian); nama yang tidak
 * dikenali, termasuk kategori baru atau yang diganti nama admin, memakai ikon buku generik. Urutan aturan
 * penting: "nonfiksi" diperiksa sebelum "fiksi".
 */
const ATURAN: [RegExp, NamaIkon][] = [
  [/non[\s-]?fiksi/, "bohlamIsi"],
  [/fiksi|novel|sastra|cerita/, "bukuIsi"],
  [/sejarah/, "gedungIsi"],
  [/sains|ilmu pengetahuan|fisika|kimia|biologi/, "atom"],
  [/komputer|teknologi|informatika|pemrograman/, "laptopIsi"],
  [/anak/, "beruangIsi"],
  [/biografi|tokoh/, "orangIsi"],
  [/agama|religi|spiritual/, "lenteraIsi"],
  [/referensi|kamus|ensiklopedia/, "bukuTutupIsi"],
];

export const IKON_KATEGORI_BAWAAN: NamaIkon = "bukuIsi";

export function ikonKategori(nama: string): NamaIkon {
  const n = nama.trim().toLocaleLowerCase("id-ID");
  return ATURAN.find(([pola]) => pola.test(n))?.[1] ?? IKON_KATEGORI_BAWAAN;
}

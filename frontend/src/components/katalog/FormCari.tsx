import { Ikon } from "@/components/ui/Ikon";
import { kelasTombol } from "@/components/ui/Tombol";

/**
 * IR-UI-05, FR-KTL-02: kolom cari katalog. Form GET biasa ke `/katalog?q=…` (tanpa `halaman`, jadi pencarian
 * baru selalu mulai dari halaman 1). Kata kunci dikirim apa adanya; pencocokan di backend (OQ-24).
 * Tampilan hal-02/03: kotak putih, ikon kaca pembesar dekoratif di kiri, tombol "Cari" menempel penuh di sisi kanan
 * (setinggi kotak, bukan tombol di dalam kotak). Fokus tombol ditandai outline form (`focus-within`).
 */
export function FormCari({ q = "" }: { q?: string }) {
  return (
    <form
      method="get"
      action="/katalog"
      role="search"
      aria-label="Cari buku"
      className="flex w-full items-stretch overflow-hidden rounded-xl border border-navy/30 bg-surface shadow-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-navy"
    >
      <Ikon nama="cari" className="ml-4 size-5 shrink-0 self-center text-navy/60" />
      <label htmlFor="cari-katalog" className="sr-only">
        Kata kunci
      </label>
      <input
        id="cari-katalog"
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Cari judul, penulis, ISBN, atau kategori"
        className="min-h-12 min-w-0 flex-1 bg-transparent px-3 py-2 text-navy placeholder:text-navy/50 focus:outline-none"
      />
      <button
        type="submit"
        className={kelasTombol(
          "primer",
          "min-h-12 shrink-0 rounded-none! border-0 px-6 sm:px-10 2xl:px-12",
        )}
      >
        Cari
      </button>
    </form>
  );
}

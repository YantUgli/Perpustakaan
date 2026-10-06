/**
 * IR-UI-05, FR-KTL-02: kolom cari katalog. Form GET biasa ke `/katalog?q=…` (tanpa `halaman`, jadi pencarian
 * baru selalu mulai dari halaman 1). Kata kunci dikirim apa adanya; pencocokan di backend (OQ-24).
 */
export function FormCari({ q = "" }: { q?: string }) {
  return (
    <form
      method="get"
      action="/katalog"
      role="search"
      aria-label="Cari buku"
      className="flex w-full overflow-hidden rounded-full border border-navy/40 bg-surface focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-navy"
    >
      <label htmlFor="cari-katalog" className="sr-only">
        Kata kunci
      </label>
      <input
        id="cari-katalog"
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Cari judul, penulis, ISBN, atau kategori"
        className="min-h-11 min-w-0 flex-1 bg-transparent px-5 py-2 text-navy placeholder:text-navy/50 focus:outline-none"
      />
      <button
        type="submit"
        className="min-h-11 shrink-0 bg-gold px-6 text-sm font-semibold text-navy hover:brightness-95"
      >
        Cari
      </button>
    </form>
  );
}

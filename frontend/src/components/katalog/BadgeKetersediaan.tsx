import { type JudulKatalog, teksKetersediaan } from "@/lib/katalog";

/**
 * FR-KTL-03: "X dari Y eksemplar tersedia" dari `tersedia`/`total` API (OQ-23: "0 dari 0" tetap tampil).
 * Satu gaya untuk semua nilai: teks gold-700 (catatan 5.4.1; gold hanya untuk titik dekoratif).
 */
export function BadgeKetersediaan({ judul }: { judul: Pick<JudulKatalog, "tersedia" | "total"> }) {
  return (
    <span className="angka inline-flex items-center gap-1.5 rounded-full border border-gold-700/30 bg-surface px-2.5 py-0.5 text-xs font-semibold text-gold-700">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-gold" />
      {teksKetersediaan(judul)}
    </span>
  );
}

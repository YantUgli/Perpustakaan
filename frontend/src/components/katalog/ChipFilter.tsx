import Link from "next/link";

/**
 * OQ-44 (hal-04): chip filter aktif. Setiap chip = tautan ke URL tanpa parameter itu saja (halaman 1);
 * label & URL disusun `chipFilter()` di `lib/katalog`.
 */
export function ChipFilter({ chip }: { chip: { label: string; href: string }[] }) {
  if (chip.length === 0) return null;
  return (
    <ul aria-label="Filter aktif" className="flex flex-wrap gap-2">
      {chip.map((c) => (
        <li key={c.href + c.label}>
          <Link
            href={c.href}
            aria-label={`Hapus filter ${c.label}`}
            className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border border-gold/50 bg-gold/10 px-3.5 text-sm text-navy hover:bg-gold/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            <span className="truncate">{c.label}</span>
            <span aria-hidden="true" className="text-base leading-none text-navy/70">
              ×
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import Link from "next/link";

import { formatRupiah } from "@/lib/format";
import { type JudulKatalog, teksRak } from "@/lib/katalog";

import { BadgeKetersediaan } from "./BadgeKetersediaan";
import { CoverBuku } from "./CoverBuku";

/**
 * FR-KTL-01: satu judul di katalog dengan SEMUA isian (cover, judul, penulis, penerbit, tahun, kategori, ISBN,
 * rak, harga, ketersediaan) dalam bentuk ringkas. Semua dari `JudulKatalogKeluar` apa adanya.
 */
export function KartuBuku({ judul: j }: { judul: JudulKatalog }) {
  return (
    <article className="flex gap-4 rounded-xl border border-line bg-surface p-4">
      <CoverBuku coverUrl={j.cover_url} className="aspect-5/8 w-22 shrink-0 self-start" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="self-start rounded-full bg-navy/5 px-2.5 py-0.5 text-xs text-navy/80">
          {j.kategori.nama}
        </span>
        <h3 className="font-display text-lg leading-snug">
          <Link href={`/katalog/${j.id}`} className="underline-offset-4 hover:underline">
            {j.judul}
          </Link>
        </h3>
        <p className="text-sm text-navy/80">{j.penulis}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-navy/80">
          <dt className="text-navy/60">Penerbit</dt>
          <dd>
            {j.penerbit} <span className="angka">· {j.tahun}</span>
          </dd>
          <dt className="text-navy/60">ISBN</dt>
          <dd className="angka break-all">{j.isbn}</dd>
          <dt className="text-navy/60">Rak</dt>
          <dd>{j.rak.length > 0 ? j.rak.map(teksRak).join(", ") : "—"}</dd>
          <dt className="text-navy/60">Harga</dt>
          <dd className="angka">{formatRupiah(j.harga)}</dd>
        </dl>
        <div className="mt-1">
          <BadgeKetersediaan judul={j} />
        </div>
      </div>
    </article>
  );
}

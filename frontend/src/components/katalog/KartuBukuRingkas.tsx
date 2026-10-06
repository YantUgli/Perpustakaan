import Link from "next/link";

import type { JudulKatalog } from "@/lib/katalog";

import { BadgeKetersediaan } from "./BadgeKetersediaan";
import { CoverBuku } from "./CoverBuku";

/**
 * FR-KTL-05, FR-KTL-03: kartu ringkas cuplikan koleksi di beranda saja (cover, judul, penulis, kategori,
 * ketersediaan X dari Y dari API). Isian lengkap FR-KTL-01 tetap di `/katalog` (`KartuBuku`) dan halaman detail.
 * Ringkas seperti hal-02 (6 sebaris di layar lebar): badge "X dari Y tersedia" (ringkas) di samping sampul.
 */
export function KartuBukuRingkas({ judul: j }: { judul: JudulKatalog }) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-line bg-surface p-2.5">
      <div className="flex min-w-0 flex-1 gap-2.5">
        <CoverBuku coverUrl={j.cover_url} className="aspect-5/8 w-18 shrink-0 self-start" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="line-clamp-3 font-display text-base leading-snug wrap-break-word">
            <Link
              href={`/katalog/${j.id}`}
              title={j.judul}
              className="underline-offset-4 hover:underline"
            >
              {j.judul}
            </Link>
          </h3>
          <p className="text-xs text-navy/80">{j.penulis}</p>
          <span className="mt-1 self-start rounded-full bg-navy/5 px-2.5 py-0.5 text-xs text-navy/80">
            {j.kategori.nama}
          </span>
          <div className="mt-auto pt-2">
            <BadgeKetersediaan judul={j} ringkas />
          </div>
        </div>
      </div>
    </article>
  );
}

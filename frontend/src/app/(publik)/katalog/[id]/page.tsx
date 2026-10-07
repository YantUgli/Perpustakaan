import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BadgeKetersediaan } from "@/components/katalog/BadgeKetersediaan";
import { CoverBuku } from "@/components/katalog/CoverBuku";
import { ambilServer } from "@/lib/api-server";
import { formatRupiah } from "@/lib/format";
import { GalatApi } from "@/lib/galat";
import { type JudulKatalog, teksRak } from "@/lib/katalog";
import { KONTAINER } from "@/lib/tata-letak";

export const metadata: Metadata = { title: "Detail Buku" };

/** `id` bukan bilangan bulat positif → 404 tanpa memanggil API; judul tak ada (404 backend) → 404. */
async function ambilJudulKatalog(id: string): Promise<JudulKatalog> {
  if (!/^[1-9][0-9]*$/.test(id)) notFound();
  try {
    return await ambilServer<JudulKatalog>(`/katalog/judul/${id}`);
  } catch (e) {
    if (e instanceof GalatApi && e.status === 404) notFound();
    throw e;
  }
}

/**
 * FR-KTL-01/03, BR-01, BR-07: detail judul tanpa login. Ketersediaan & rak dari API (OQ-22/23). Tanpa rating,
 * sinopsis, kutipan, dan buku terkait (∅API).
 */
export default async function DetailBuku({ params }: { params: Promise<{ id: string }> }) {
  const j = await ambilJudulKatalog((await params).id);
  return (
    <section className={`${KONTAINER} flex flex-col gap-6 py-10`}>
      <nav aria-label="Breadcrumb" className="text-sm text-navy/70">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:underline">
              Beranda
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <Link href="/katalog" className="hover:underline">
              Katalog Buku
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="text-navy">
            {j.judul}
          </li>
        </ol>
      </nav>

      <div className="flex max-w-5xl flex-col gap-8 sm:flex-row lg:gap-12">
        <CoverBuku coverUrl={j.cover_url} className="aspect-2/3 w-44 shrink-0 self-start sm:w-56" />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <span className="self-start rounded-full bg-navy/5 px-3 py-1 text-xs text-navy/80">
            {j.kategori.nama}
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-3xl leading-tight sm:text-4xl">{j.judul}</h1>
            <p className="text-navy/80">oleh {j.penulis}</p>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-y border-line py-4 text-sm">
            <dt className="text-navy/70">ISBN</dt>
            <dd className="angka break-all">{j.isbn}</dd>
            <dt className="text-navy/70">Penerbit</dt>
            <dd>{j.penerbit}</dd>
            <dt className="text-navy/70">Tahun</dt>
            <dd className="angka">{j.tahun}</dd>
            <dt className="text-navy/70">Kategori</dt>
            <dd>{j.kategori.nama}</dd>
            <dt className="text-navy/70">Lokasi rak</dt>
            <dd>
              {j.rak.length > 0 ? (
                <ul>
                  {j.rak.map((r) => (
                    <li key={r.kode}>{teksRak(r)}</li>
                  ))}
                </ul>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-navy/70">Harga</dt>
            <dd className="angka">{formatRupiah(j.harga)}</dd>
          </dl>

          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Ketersediaan</p>
            <div>
              <BadgeKetersediaan judul={j} />
            </div>
          </div>

          <p className="rounded-xl border border-line bg-surface p-4 text-sm text-navy/80">
            Peminjaman dilayani petugas di perpustakaan dengan menunjukkan QR anggota.
          </p>
        </div>
      </div>
    </section>
  );
}

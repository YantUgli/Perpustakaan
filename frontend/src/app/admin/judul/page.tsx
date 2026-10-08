import type { Metadata } from "next";
import Link from "next/link";

import { Isian } from "@/components/ui/Isian";
import { KosongState } from "@/components/ui/KosongState";
import { Paginasi } from "@/components/ui/Paginasi";
import { TautanTombol, Tombol } from "@/components/ui/Tombol";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { filterJudulDariParam, queryJudul } from "@/lib/data-admin";
import { formatRupiah } from "@/lib/format";

type HalamanJudul = components["schemas"]["HalamanJudul"];

export const metadata: Metadata = { title: "Data Buku & Eksemplar" };

/**
 * FR-BKU-02: daftar judul berhalaman (A–Z dari API) dengan satu kolom pencarian `q` (ASUMSI(OQ-45): aturan
 * katalog OQ-24, dicocokkan backend). Tanpa kolom stok: stok per judul hanya di detail judul (FR-BKU-09).
 * Eksemplar dikelola dari halaman judul (tidak ada daftar eksemplar lintas judul).
 */
export default async function DaftarJudul({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = filterJudulDariParam(await searchParams);
  const hasil = await ambilServer<HalamanJudul>(`/admin/judul?${queryJudul(filter)}`);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl sm:text-4xl">Data Buku &amp; Eksemplar</h1>
          <p className="text-navy/80">Judul koleksi perpustakaan. Eksemplar dikelola per judul.</p>
        </div>
        <TautanTombol href="/admin/judul/baru">Tambah Judul</TautanTombol>
      </header>

      <form
        method="get"
        action="/admin/judul"
        aria-label="Pencarian judul"
        className="grid grid-cols-1 items-end gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto]"
      >
        <Isian
          label="Cari judul"
          name="q"
          placeholder="Judul, penulis, ISBN, atau kategori"
          defaultValue={filter.q ?? ""}
          keterangan="Boleh sebagian kata; ISBN boleh dengan atau tanpa tanda hubung."
        />
        <div className="flex gap-2">
          <Tombol type="submit">Cari</Tombol>
          <TautanTombol href="/admin/judul" varian="sekunder">
            Reset
          </TautanTombol>
        </div>
      </form>

      <p className="angka text-sm text-navy/80">{hasil.total} judul</p>

      {hasil.data.length === 0 ? (
        filter.q ? (
          <KosongState
            judul="Judul tidak ditemukan"
            keterangan="Tidak ada judul yang cocok dengan pencarian ini. Coba kata kunci lain."
          />
        ) : (
          <KosongState
            judul="Belum ada judul"
            keterangan="Tambahkan judul buku, lalu tambahkan eksemplarnya."
          />
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-line text-navy/70">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Cover</span>
                </th>
                <th className="px-4 py-3 font-medium">Judul</th>
                <th className="px-4 py-3 font-medium">ISBN</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">Penerbit · Tahun</th>
                <th className="px-4 py-3 text-right font-medium">Harga</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {hasil.data.map((j) => (
                <tr key={j.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    {j.cover_url ? (
                      // Cover publik per judul (path dari DB, bukan dari klien); next/image tidak dipakai.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={j.cover_url} alt="" className="h-14 w-10 rounded object-cover" />
                    ) : (
                      <span aria-hidden="true" className="block h-14 w-10 rounded bg-navy/10" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-medium">{j.judul}</span>
                    <span className="text-navy/70">{j.penulis}</span>
                  </td>
                  <td className="angka px-4 py-3">{j.isbn}</td>
                  <td className="px-4 py-3">{j.kategori.nama}</td>
                  <td className="px-4 py-3">
                    {j.penerbit} <span className="angka text-navy/70">· {j.tahun}</span>
                  </td>
                  <td className="angka px-4 py-3 text-right">{formatRupiah(j.harga)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/judul/${j.id}`}
                      aria-label={`Kelola ${j.judul}`}
                      className="font-semibold text-gold-700 underline-offset-4 hover:underline"
                    >
                      Kelola
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Paginasi
        halaman={filter.halaman}
        total={hasil.total}
        perHalaman={hasil.per_halaman}
        path="/admin/judul"
        params={{ q: filter.q }}
      />
    </section>
  );
}

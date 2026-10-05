import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Kartu } from "@/components/ui/Kartu";
import { TautanTombol } from "@/components/ui/Tombol";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { formatRupiah } from "@/lib/format";
import { GalatApi } from "@/lib/galat";

import { ambilJudul, idJudulAtau404 } from "../ambil-judul";

import { HapusJudul } from "./HapusJudul";
import { PanelEksemplar } from "./PanelEksemplar";

type StokJudul = components["schemas"]["StokJudul"];
type Rak = components["schemas"]["RakKeluar"];

export const metadata: Metadata = { title: "Detail Judul" };

/**
 * FR-BKU-02..09: data judul, rekap stok (dari API), dan pengelolaan eksemplar. Eksemplar dikelola dari
 * halaman judul karena backend tidak punya daftar eksemplar lintas judul.
 */
export default async function DetailJudul({ params }: { params: Promise<{ id: string }> }) {
  const id = idJudulAtau404((await params).id);
  let judul, stok, rak;
  try {
    [judul, stok, rak] = await Promise.all([
      ambilJudul(id),
      ambilServer<StokJudul>(`/admin/judul/${id}/eksemplar`),
      ambilServer<Rak[]>("/admin/rak"),
    ]);
  } catch (e) {
    if (e instanceof GalatApi && e.status === 404) notFound();
    throw e;
  }

  return (
    <section className="flex flex-col gap-6">
      <Link href="/admin/judul" className="text-sm font-semibold text-gold-700">
        ← Kembali ke data buku
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          {judul.cover_url ? (
            // Cover publik per judul (path dari DB); next/image tidak dipakai.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={judul.cover_url}
              alt={`Cover ${judul.judul}`}
              className="h-36 w-26 shrink-0 rounded object-cover"
            />
          ) : (
            <span aria-hidden="true" className="block h-36 w-26 shrink-0 rounded bg-navy/10" />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-display text-3xl sm:text-4xl">{judul.judul}</h1>
            <p className="text-navy/80">{judul.penulis}</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-navy/70">ISBN</dt>
              <dd className="angka">{judul.isbn}</dd>
              <dt className="text-navy/70">Penerbit</dt>
              <dd>
                {judul.penerbit} <span className="angka text-navy/70">· {judul.tahun}</span>
              </dd>
              <dt className="text-navy/70">Kategori</dt>
              <dd>{judul.kategori.nama}</dd>
              <dt className="text-navy/70">Harga</dt>
              <dd className="angka">{formatRupiah(judul.harga)}</dd>
            </dl>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <TautanTombol href={`/admin/judul/${judul.id}/ubah`} varian="sekunder">
            Ubah
          </TautanTombol>
          <HapusJudul id={judul.id} judul={judul.judul} />
        </div>
      </header>

      <Kartu>
        <PanelEksemplar judul={{ id: judul.id, judul: judul.judul }} stok={stok} rak={rak} />
      </Kartu>
    </section>
  );
}

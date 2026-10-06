import type { Metadata } from "next";

import { FormCari } from "@/components/katalog/FormCari";
import { KartuBuku } from "@/components/katalog/KartuBuku";
import { KosongState } from "@/components/ui/KosongState";
import { Paginasi } from "@/components/ui/Paginasi";
import { TautanTombol } from "@/components/ui/Tombol";
import { ambilServer } from "@/lib/api-server";
import { formatAngka } from "@/lib/format";
import { type HalamanKatalog, filterKatalogDariParam, queryKatalog } from "@/lib/katalog";

export const metadata: Metadata = { title: "Katalog Buku" };

/**
 * FR-KTL-01/02/04, IR-UI-05, BR-01: katalog publik tanpa login, kolom cari di atas, berhalaman (A–Z dari API).
 * Tanpa filter samping & urutkan (∅API; OQ-24 hanya satu kata kunci `q`).
 */
export default async function Katalog({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = filterKatalogDariParam(await searchParams);
  const hasil = await ambilServer<HalamanKatalog>(`/katalog/judul?${queryKatalog(filter)}`);
  const awal = (hasil.halaman - 1) * hasil.per_halaman + 1;

  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl sm:text-4xl">Katalog Buku</h1>
          <p className="text-navy/80">
            Cari koleksi buku fisik perpustakaan berdasarkan judul, penulis, ISBN, atau kategori.
          </p>
        </div>
        <div className="max-w-2xl">
          <FormCari q={filter.q} />
        </div>
      </header>

      {filter.q !== undefined && (
        <p className="text-navy/80">
          Hasil pencarian untuk <span className="font-semibold">“{filter.q}”</span>
        </p>
      )}

      {hasil.data.length === 0 ? (
        <KosongState
          judul={
            hasil.total > 0
              ? "Halaman ini kosong"
              : filter.q !== undefined
                ? "Buku tidak ditemukan"
                : "Belum ada buku di katalog"
          }
          keterangan={
            hasil.total > 0
              ? "Nomor halaman melebihi jumlah halaman hasil."
              : filter.q !== undefined
                ? "Tidak ada buku yang cocok dengan kata kunci ini. Coba kata kunci lain."
                : undefined
          }
          aksi={
            filter.q !== undefined || hasil.total > 0 ? (
              <TautanTombol href="/katalog" varian="sekunder">
                Lihat semua buku
              </TautanTombol>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="angka text-sm text-navy/80">
            Menampilkan {formatAngka(awal)}–{formatAngka(awal + hasil.data.length - 1)} dari{" "}
            {formatAngka(hasil.total)} buku
          </p>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {hasil.data.map((j) => (
              <li key={j.id}>
                <KartuBuku judul={j} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Paginasi
        halaman={filter.halaman}
        total={hasil.total}
        perHalaman={hasil.per_halaman}
        path="/katalog"
        params={{ q: filter.q }}
      />
    </section>
  );
}

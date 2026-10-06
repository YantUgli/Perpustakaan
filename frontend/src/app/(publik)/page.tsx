import Link from "next/link";

import { FormCari } from "@/components/katalog/FormCari";
import { KartuBuku } from "@/components/katalog/KartuBuku";
import { KosongState } from "@/components/ui/KosongState";
import { TautanTombol } from "@/components/ui/Tombol";
import { ambilServer } from "@/lib/api-server";
import { type HalamanKatalog, type Kategori, tautanKategori } from "@/lib/katalog";

/** Jumlah judul cuplikan di beranda: halaman 1 katalog (urut A–Z dari API), bukan "terbaru"/"rekomendasi". */
const CUPLIKAN = 6;

/**
 * FR-KTL-05, BR-01, IR-UI-05: beranda tanpa login. Kategori dari `GET /katalog/kategori` (OQ-43), cuplikan
 * koleksi dari `GET /katalog/judul`. Teks statis hanya hal yang ada di Brief (BR-01, BR-03).
 */
export default async function Beranda() {
  const [kategori, koleksi] = await Promise.all([
    ambilServer<Kategori[]>("/katalog/kategori"),
    ambilServer<HalamanKatalog>(`/katalog/judul?halaman=1&per_halaman=${CUPLIKAN}`),
  ]);

  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-14 text-center sm:px-6 sm:py-20">
          <h1 className="font-display text-4xl leading-tight sm:text-5xl">
            Lebih Banyak Cerita, Lebih Luas Dunia.
          </h1>
          <p className="text-navy/80">
            Cari buku di katalog perpustakaan berdasarkan judul, penulis, ISBN, atau kategori.
          </p>
          <FormCari />
          <Link
            href="/katalog"
            className="text-sm font-semibold text-gold-700 underline-offset-4 hover:underline"
          >
            Atau jelajahi katalog lengkap →
          </Link>
        </div>
      </section>

      <section aria-labelledby="judul-kategori" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <h2 id="judul-kategori" className="mb-6 font-display text-2xl sm:text-3xl">
          Kategori
        </h2>
        {kategori.length === 0 ? (
          <KosongState judul="Belum ada kategori" />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {kategori.map((k) => (
              <li key={k.id}>
                <Link
                  href={tautanKategori(k.nama)}
                  className="flex min-h-14 items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium hover:border-gold"
                >
                  <span className="min-w-0 wrap-break-word">{k.nama}</span>
                  <span aria-hidden="true" className="text-gold-700">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="judul-koleksi" className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h2 id="judul-koleksi" className="font-display text-2xl sm:text-3xl">
            Koleksi Buku
          </h2>
          <Link
            href="/katalog"
            className="text-sm font-semibold text-gold-700 underline-offset-4 hover:underline"
          >
            Lihat semua buku →
          </Link>
        </div>
        {koleksi.data.length === 0 ? (
          <KosongState judul="Belum ada buku di katalog" />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {koleksi.data.map((j) => (
              <li key={j.id}>
                <KartuBuku judul={j} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-navy text-ivory">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="font-display text-2xl sm:text-3xl">Tentang Perpustakaan</h2>
            <p className="text-ivory/85">
              Katalog buku fisik perpustakaan terbuka untuk umum tanpa perlu masuk. Daftar sebagai
              anggota untuk meminjam buku; akun langsung aktif setelah pendaftaran.
            </p>
            <Link
              href="/tentang"
              className="self-start text-sm font-semibold text-gold underline-offset-4 hover:underline"
            >
              Selengkapnya tentang perpustakaan →
            </Link>
          </div>
          <TautanTombol href="/daftar" className="shrink-0">
            Daftar Sekarang
          </TautanTombol>
        </div>
      </section>
    </>
  );
}

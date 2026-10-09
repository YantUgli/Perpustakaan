import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BadgeKetersediaan } from "@/components/katalog/BadgeKetersediaan";
import { CoverBuku } from "@/components/katalog/CoverBuku";
import { KartuBukuRingkas } from "@/components/katalog/KartuBukuRingkas";
import { Ikon, type NamaIkon } from "@/components/ui/Ikon";
import { ambilServer } from "@/lib/api-server";
import { formatRupiah } from "@/lib/format";
import { GalatApi } from "@/lib/galat";
import {
  type HalamanKatalog,
  type JudulKatalog,
  type JudulKatalogDetail,
  tautanKategori,
  teksRak,
} from "@/lib/katalog";
import { KONTAINER } from "@/lib/tata-letak";

export const metadata: Metadata = { title: "Detail Buku" };

/** ASUMSI(OQ-47): jumlah judul lain sekategori yang ditampilkan; diminta satu lebih untuk membuang judul ini. */
const MAKS_SEKATEGORI = 6;

/** `id` bukan bilangan bulat positif → 404 tanpa memanggil API; judul tak ada (404 backend) → 404. */
async function ambilJudulKatalog(id: string): Promise<JudulKatalogDetail> {
  if (!/^[1-9][0-9]*$/.test(id)) notFound();
  try {
    return await ambilServer<JudulKatalogDetail>(`/katalog/judul/${id}`);
  } catch (e) {
    if (e instanceof GalatApi && e.status === 404) notFound();
    throw e;
  }
}

/**
 * ASUMSI(OQ-47): judul lain dalam kategori yang sama, halaman 1 katalog (`kategori_id`, OQ-44; urutan bawaan
 * A–Z), tanpa judul ini, maks 6. Bagian pelengkap: galat apa pun → bagian tidak dirender, detail tetap tampil.
 * Butuh `kategori.id` dari detail, jadi dipanggil sesudahnya (tidak paralel).
 */
async function ambilSekategori(j: JudulKatalogDetail): Promise<JudulKatalog[]> {
  try {
    const hasil = await ambilServer<HalamanKatalog>(
      `/katalog/judul?kategori_id=${j.kategori.id}&per_halaman=${MAKS_SEKATEGORI + 1}`,
    );
    return hasil.data.filter((x) => x.id !== j.id).slice(0, MAKS_SEKATEGORI);
  } catch {
    return [];
  }
}

const kelasTautanTeks =
  "inline-flex items-center gap-1.5 text-sm font-semibold text-gold-700 underline-offset-4 hover:underline";

/**
 * FR-KTL-01/03, BR-01, BR-07: detail judul tanpa login, tata letak hal-05. Ketersediaan & rak dari API
 * (OQ-22/23), sinopsis dari `deskripsi` (OQ-46; tidak dirender bila null), dan "Buku Lain dalam Kategori"
 * (OQ-47). Tanpa rating, kutipan, dan bookmark (∅API / di luar lingkup).
 */
export default async function DetailBuku({ params }: { params: Promise<{ id: string }> }) {
  const j = await ambilJudulKatalog((await params).id);
  const sekategori = await ambilSekategori(j);

  const metadataJudul: { ikon: NamaIkon; label: string; isi: ReactNode; angka?: boolean }[] = [
    { ikon: "buku", label: "ISBN", isi: <span className="break-all">{j.isbn}</span>, angka: true },
    { ikon: "gedung", label: "Penerbit", isi: j.penerbit },
    { ikon: "kalender", label: "Tahun Terbit", isi: j.tahun, angka: true },
    { ikon: "label", label: "Kategori", isi: j.kategori.nama },
    {
      ikon: "rak",
      label: "Lokasi Rak",
      isi:
        j.rak.length > 0 ? (
          <ul>
            {j.rak.map((r) => (
              <li key={r.kode}>{teksRak(r)}</li>
            ))}
          </ul>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-12 pb-14">
      <section className={`${KONTAINER} flex flex-col gap-8 pt-8 lg:pt-10`}>
        <nav aria-label="Breadcrumb" className="text-sm text-navy/70">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="inline-flex items-center gap-1.5 hover:underline">
                <Ikon nama="beranda" className="size-4" />
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
            <li aria-current="page" className="font-semibold text-navy">
              Detail Buku
            </li>
          </ol>
        </nav>

        <div className="grid gap-8 sm:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)] xl:gap-12 2xl:grid-cols-[22rem_minmax(0,1fr)]">
          <CoverBuku
            coverUrl={j.cover_url}
            className="aspect-2/3 w-44 shrink-0 self-start justify-self-center shadow-xl shadow-navy/20 sm:w-full sm:justify-self-start"
          />

          <div className="flex min-w-0 flex-col gap-8">
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:gap-0">
              <div className="flex min-w-0 flex-col gap-5 xl:pr-10">
                <span className="self-start rounded-full bg-gold/15 px-3 py-1 text-xs font-medium text-gold-700">
                  {j.kategori.nama}
                </span>
                <div className="flex flex-col gap-2">
                  <h1 className="font-display text-3xl leading-tight wrap-break-word lining-nums sm:text-4xl xl:text-5xl">
                    {j.judul}
                  </h1>
                  <p className="font-display text-xl text-navy/85">{j.penulis}</p>
                </div>

                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 sm:gap-x-8">
                  {metadataJudul.map((m) => (
                    <div key={m.label} className="contents">
                      <dt className="flex items-center gap-3 self-start text-navy/70">
                        <Ikon nama={m.ikon} className="size-5 shrink-0 text-gold-700" />
                        {m.label}
                      </dt>
                      <dd className={`flex min-w-0 gap-2 ${m.angka ? "angka" : ""}`}>
                        <span aria-hidden="true" className="text-navy/50">
                          :
                        </span>
                        <div className="min-w-0">{m.isi}</div>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="flex min-w-0 flex-col gap-6 xl:border-l xl:border-line xl:pl-10">
                <BadgeKetersediaan judul={j} besar />

                <div className="flex items-center gap-4 border-t border-line pt-6">
                  <Ikon nama="koin" className="size-9 shrink-0 text-gold-700" />
                  <div className="flex flex-col">
                    <span className="text-sm text-navy/70">Harga</span>
                    <span className="font-display text-3xl font-semibold tabular-nums lining-nums">
                      {formatRupiah(j.harga)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 rounded-xl bg-navy/5 p-5">
                  <Ikon nama="info" className="size-7 shrink-0 text-navy" />
                  <div className="flex flex-col gap-1">
                    <h2 className="font-display text-lg font-semibold">
                      Peminjaman melalui petugas perpustakaan
                    </h2>
                    <p className="text-sm text-navy/80">
                      Kunjungi perpustakaan dan tunjukkan QR anggota kepada petugas. Peminjaman
                      tidak dapat dilakukan secara online.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {j.deskripsi && (
              <section
                aria-labelledby="judul-sinopsis"
                className="flex flex-col gap-3 border-t border-line pt-6"
              >
                <h2 id="judul-sinopsis" className="font-display text-2xl font-semibold">
                  Sinopsis
                </h2>
                <p className="max-w-[75ch] leading-relaxed whitespace-pre-line text-navy/85">
                  {j.deskripsi}
                </p>
              </section>
            )}
          </div>
        </div>
      </section>

      {sekategori.length > 0 && (
        <section aria-labelledby="judul-sekategori" className={KONTAINER}>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2
                id="judul-sekategori"
                className="font-display text-2xl sm:text-3xl lg:text-4xl lg:font-semibold"
              >
                Buku Lain dalam Kategori {j.kategori.nama}
              </h2>
              <p className="text-sm text-navy/80">Judul lain dari kategori yang sama, urut A–Z.</p>
            </div>
            <Link href={tautanKategori(j.kategori.id)} className={kelasTautanTeks}>
              Lihat semua
              <Ikon nama="panah" className="size-4" />
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 min-[112rem]:grid-cols-6">
            {sekategori.map((s) => (
              <li key={s.id}>
                <KartuBukuRingkas judul={s} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

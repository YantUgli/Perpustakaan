import type { Metadata } from "next";

import { ChipFilter } from "@/components/katalog/ChipFilter";
import { FormCari } from "@/components/katalog/FormCari";
import { KartuBuku } from "@/components/katalog/KartuBuku";
import { PanelFilter } from "@/components/katalog/PanelFilter";
import { PilihUrutan } from "@/components/katalog/PilihUrutan";
import { KosongState } from "@/components/ui/KosongState";
import { Paginasi } from "@/components/ui/Paginasi";
import { Pesan } from "@/components/ui/Pesan";
import { TautanTombol } from "@/components/ui/Tombol";
import { ambilServer } from "@/lib/api-server";
import { formatAngka } from "@/lib/format";
import { GalatApi } from "@/lib/galat";
import {
  type HalamanKatalog,
  type Kategori,
  OPSI_URUT,
  type Urut,
  adaFilter,
  chipFilter,
  filterKatalogDariParam,
  paramsPaginasi,
  pasanganKatalog,
  queryKatalog,
  teksJudulHasil,
  urlReset,
  urlUrutan,
} from "@/lib/katalog";
import { KONTAINER } from "@/lib/tata-letak";

export const metadata: Metadata = { title: "Katalog Buku" };

/**
 * FR-KTL-01/02/04, IR-UI-05, BR-01: katalog publik tanpa login, kolom cari di atas, berhalaman.
 * OQ-44 (hal-03/04): judul "Ditemukan N buku untuk “kata kunci, filter…”" bila ada kata kunci/filter;
 * panel filter (kategori, tersedia, tahun), chip filter aktif, urutan; semua keputusan (pencocokan, batas,
 * urutan) di backend. Galat 422 → `pesan` backend apa adanya (IR-UI-04), panel tetap tampil.
 */
export default async function Katalog({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = filterKatalogDariParam(await searchParams);
  const [hasil, kategori] = await Promise.all([
    ambilJudul(`/katalog/judul?${queryKatalog(filter)}`),
    ambilServer<Kategori[]>("/katalog/kategori"),
  ]);
  const dgnFilter = adaFilter(filter);
  const judulHasil = teksJudulHasil(filter, kategori);
  const reset = urlReset(filter);
  const tautanUrut = Object.fromEntries(
    OPSI_URUT.map((o) => [o.nilai, urlUrutan(filter, o.nilai)]),
  ) as Record<Urut, string>;
  // Tanpa `q` (sudah di kolom isian) dan tanpa `halaman`: pencarian baru → halaman 1.
  const tersembunyi = pasanganKatalog({ ...filter, q: undefined });

  return (
    <section className={`${KONTAINER} flex flex-col gap-8 py-10`}>
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl lg:font-semibold">
            Katalog Buku
          </h1>
          <p className="text-navy/80">
            Cari koleksi buku fisik perpustakaan berdasarkan judul, penulis, ISBN, atau kategori.
          </p>
        </div>
        <div className="max-w-3xl">
          <FormCari q={filter.q} tersembunyi={tersembunyi} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <PanelFilter filter={filter} kategori={kategori} />

        <div className="flex min-w-0 flex-col gap-5">
          {judulHasil !== undefined && "data" in hasil && (
            <h2 className="font-display text-2xl break-words lining-nums lg:text-3xl lg:font-semibold">
              Ditemukan{" "}
              <span className="text-gold-700 lining-nums tabular-nums">
                {formatAngka(hasil.total)}
              </span>{" "}
              buku untuk “{judulHasil}”
            </h2>
          )}

          <ChipFilter chip={chipFilter(filter, kategori)} />

          {/* hal-03: ringkasan jumlah (kiri) dan "Urutkan" (kanan) dalam satu baris. */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            {"data" in hasil && hasil.data.length > 0 ? (
              <p className="angka text-sm text-navy/80">
                Menampilkan {formatAngka((hasil.halaman - 1) * hasil.per_halaman + 1)}–
                {formatAngka((hasil.halaman - 1) * hasil.per_halaman + hasil.data.length)} dari{" "}
                {formatAngka(hasil.total)} buku
              </p>
            ) : (
              <span />
            )}
            <PilihUrutan nilai={filter.urut ?? "judul_az"} tautan={tautanUrut} />
          </div>

          {!("data" in hasil) ? (
            <Pesan jenis="galat">{hasil.galat}</Pesan>
          ) : hasil.data.length === 0 ? (
            <KosongState
              judul={
                hasil.total > 0
                  ? "Halaman ini kosong"
                  : dgnFilter
                    ? "Tidak ada buku yang cocok dengan filter"
                    : filter.q !== undefined
                      ? "Buku tidak ditemukan"
                      : "Belum ada buku di katalog"
              }
              keterangan={
                hasil.total > 0
                  ? "Nomor halaman melebihi jumlah halaman hasil."
                  : dgnFilter
                    ? "Ubah atau hapus filter untuk melihat buku lain."
                    : filter.q !== undefined
                      ? "Tidak ada buku yang cocok dengan kata kunci ini. Coba kata kunci lain."
                      : undefined
              }
              aksi={
                hasil.total === 0 && dgnFilter ? (
                  <TautanTombol href={reset} varian="sekunder">
                    Reset Semua
                  </TautanTombol>
                ) : filter.q !== undefined || hasil.total > 0 ? (
                  <TautanTombol href="/katalog" varian="sekunder">
                    Lihat semua buku
                  </TautanTombol>
                ) : undefined
              }
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 min-[105rem]:grid-cols-4">
              {hasil.data.map((j) => (
                <li key={j.id}>
                  <KartuBuku judul={j} />
                </li>
              ))}
            </ul>
          )}

          {"data" in hasil && (
            <Paginasi
              halaman={filter.halaman}
              total={hasil.total}
              perHalaman={hasil.per_halaman}
              path="/katalog"
              params={paramsPaginasi(filter)}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/** Hanya penolakan validasi (422) yang ditampilkan di halaman; galat lain diteruskan ke `error.tsx`. */
async function ambilJudul(path: string): Promise<HalamanKatalog | { galat: string }> {
  try {
    return await ambilServer<HalamanKatalog>(path);
  } catch (e) {
    if (e instanceof GalatApi && e.status === 422) return { galat: e.pesan };
    throw e;
  }
}

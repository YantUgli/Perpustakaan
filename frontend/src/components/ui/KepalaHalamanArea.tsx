import type { StaticImageData } from "next/image";
import type { ReactNode } from "react";

import { PanelHero } from "@/components/ui/PanelHero";

/**
 * Menarik kepala berfoto ke tepi area konten agar foto menempel ke tepi kanan & atas <main>. Nilainya terikat
 * padding <main> di `app/admin/layout.tsx` dan `app/anggota/layout.tsx` (`px-4 py-6 sm:px-8`); ubah bersama.
 */
const OFFSET_MAIN = "-mx-4 -mt-6 px-4 pt-6 sm:-mx-8 sm:px-8";

/**
 * Kolom teks berfoto: tepi kanannya tepat di tepi kiri foto (foto 57% dari lebar PENUH header, kolom dihitung dari
 * lebar isi header). 0.28rem = 0,14 × padding `lg` (2rem, `sm:px-8` di OFFSET_MAIN) = 2rem − 0,43 × 4rem; ubah
 * bersama OFFSET_MAIN dan lebar `PanelHero`.
 */
const KOLOM_TEKS = "lg:max-w-[calc(43%-0.28rem)]";

/**
 * Kepala halaman area anggota & admin (decisions §B "Kepala halaman area"): judul, subjudul, aksi opsional.
 * Dengan `foto`: foto dekoratif kanan mulai `lg` (`PanelHero`, tanpa teks di atas foto); kolom teks dibatasi agar
 * tidak masuk area foto dan `aksi` selalu di kolom teks, pada baris tersendiri setelah subjudul. `padat`
 * (sirkulasi, IR-UI-01): `aksi` sebaris dengan h1, di bawah `lg` h1 `text-2xl`, subjudul disembunyikan, dan tinggi
 * kepala sama dengan tanpa foto.
 */
export function KepalaHalamanArea({
  judul,
  subjudul,
  aksi,
  foto,
  padat = false,
}: {
  judul: ReactNode;
  subjudul?: ReactNode;
  aksi?: ReactNode;
  foto?: StaticImageData;
  padat?: boolean;
}) {
  if (!foto) {
    return (
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl sm:text-4xl">{judul}</h1>
          {subjudul && <p className="text-navy/80">{subjudul}</p>}
        </div>
        {aksi}
      </header>
    );
  }

  const h1 = (
    <h1
      className={`font-display leading-tight break-words ${
        padat ? "text-2xl lg:text-4xl xl:text-5xl" : "text-3xl sm:text-4xl xl:text-5xl"
      }`}
    >
      {judul}
    </h1>
  );

  return (
    <header
      className={`relative overflow-hidden lg:min-h-52 lg:pt-10 ${OFFSET_MAIN} ${padat ? "lg:pb-2" : "pb-2"}`}
    >
      <PanelHero foto={foto} />
      <div className={`relative flex flex-col gap-3 ${KOLOM_TEKS}`}>
        {padat ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {h1}
            {aksi}
          </div>
        ) : (
          h1
        )}
        {subjudul && <p className={`text-navy/80 ${padat ? "hidden lg:block" : ""}`}>{subjudul}</p>}
        {!padat && aksi && <div>{aksi}</div>}
      </div>
    </header>
  );
}

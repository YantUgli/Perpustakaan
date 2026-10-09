import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Kartu } from "@/components/ui/Kartu";
import { ambilSesiAtauTamu } from "@/lib/api-server";
import { berandaRole } from "@/lib/sesi";
import { KONTAINER } from "@/lib/tata-letak";

import { FormDaftar } from "./FormDaftar";
import { ManfaatAnggota } from "./ManfaatAnggota";

export const metadata: Metadata = { title: "Daftar Anggota" };

/**
 * FR-AKN-01..04 untuk pengunjung (UC-05), hal-08 (spec `design/specs/daftar.md`). Keputusan tim (decisions §B):
 * pengguna yang sudah login diarahkan ke dashboard role-nya; admin tidak menambah anggota lewat sistem.
 * Mulai `lg`: kolom kiri (breadcrumb, judul, form ±2/3), kolom kanan foto di pojok kanan atas (menempel header &
 * tepi layar) lalu manfaat; di bawah `lg` hanya kolom kiri.
 */
export default async function HalamanDaftar() {
  const sesi = await ambilSesiAtauTamu();
  if (sesi) redirect(berandaRole(sesi.role));

  return (
    // overflow-x-clip: foto kolom kanan menembus gutter KONTAINER sampai tepi layar (hal-08) tanpa gulir horizontal.
    <section className={`${KONTAINER} overflow-x-clip py-10 lg:py-12`}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="flex min-w-0 flex-col gap-6">
          {/* lg:pr-28 (breadcrumb & kepala) = SELIPAN foto + 1rem (ManfaatAnggota.tsx): teks tak di atas foto. */}
          <nav aria-label="Breadcrumb" className="text-sm text-navy/70 lg:pr-28">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="hover:underline">
                  Beranda
                </Link>
              </li>
              <li aria-hidden="true">›</li>
              <li aria-current="page" className="text-navy">
                Daftar Anggota
              </li>
            </ol>
          </nav>
          <header className="flex flex-col gap-3 lg:pr-28">
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              Daftar Menjadi Anggota Naratif
            </h1>
            <p className="max-w-3xl text-navy/80">
              Daftar untuk meminjam buku fisik di Perpustakaan Naratif. Akun langsung aktif setelah
              pendaftaran.
            </p>
          </header>
          {/* relative z-10: kartu opak di atas foto yang menyelip dari kolom kanan. */}
          <Kartu className="relative z-10 rounded-2xl! p-6 sm:p-8">
            <FormDaftar />
          </Kartu>
        </div>
        <ManfaatAnggota />
      </div>
    </section>
  );
}

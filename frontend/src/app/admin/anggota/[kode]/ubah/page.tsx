import type { Metadata } from "next";
import Link from "next/link";

import { Kartu } from "@/components/ui/Kartu";

import { ambilAnggota } from "../../ambil-anggota";

import { FormUbahAnggota } from "./FormUbahAnggota";

export const metadata: Metadata = { title: "Ubah Anggota" };

/** FR-AKN-11, K-03: ubah data anggota selain NIK dan foto, termasuk menetapkan password baru. */
export default async function UbahAnggota({ params }: { params: Promise<{ kode: string }> }) {
  const a = await ambilAnggota((await params).kode);
  return (
    <section className="flex flex-col gap-6">
      <Link href={`/admin/anggota/${a.kode}`} className="text-sm font-semibold text-gold-700">
        ← Kembali ke detail anggota
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl sm:text-4xl">Ubah Data Anggota</h1>
        <p className="text-navy/80">
          Untuk anggota yang lupa password, isi &ldquo;Password baru&rdquo; dan sampaikan kepada
          anggota.
        </p>
      </header>
      <Kartu>
        <FormUbahAnggota awal={a} />
      </Kartu>
    </section>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Kartu } from "@/components/ui/Kartu";
import { ambilSesiAtauTamu } from "@/lib/api-server";
import { berandaRole } from "@/lib/sesi";

import { FormDaftar } from "./FormDaftar";

export const metadata: Metadata = { title: "Daftar Anggota" };

/**
 * FR-AKN-01..04 untuk pengunjung (UC-05). Keputusan tim (decisions §B): pengguna yang sudah login
 * diarahkan ke dashboard role-nya; admin tidak menambah anggota lewat sistem.
 */
export default async function HalamanDaftar() {
  const sesi = await ambilSesiAtauTamu();
  if (sesi) redirect(berandaRole(sesi.role));

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl sm:text-4xl">Daftar Menjadi Anggota</h1>
        <p className="text-navy/80">Lengkapi data diri Anda. Isian bertanda * wajib diisi.</p>
      </header>
      <Kartu className="p-6 sm:p-8">
        <FormDaftar />
      </Kartu>
    </section>
  );
}

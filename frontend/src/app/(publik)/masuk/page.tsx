import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Kartu } from "@/components/ui/Kartu";
import { ambilSesiAtauTamu } from "@/lib/api-server";
import { berandaRole } from "@/lib/sesi";

import { FormMasuk } from "./FormMasuk";

export const metadata: Metadata = { title: "Masuk" };

/** FR-AKN-05. Pengguna yang sudah login langsung diarahkan ke dashboard role-nya. */
export default async function HalamanMasuk() {
  const sesi = await ambilSesiAtauTamu();
  if (sesi) redirect(berandaRole(sesi.role));

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-16">
      <div className="hidden lg:block">
        <p className="font-display text-5xl leading-tight italic">
          Lebih Banyak Cerita, Lebih Luas Dunia.
        </p>
        <span aria-hidden="true" className="mt-6 block h-0.5 w-20 bg-gold" />
      </div>
      <Kartu className="mx-auto w-full max-w-md p-6 sm:p-8">
        <h1 className="mb-6 text-center font-display text-3xl">Masuk ke Akun Anda</h1>
        <FormMasuk />
      </Kartu>
    </section>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Kartu } from "@/components/ui/Kartu";
import { Logo } from "@/components/ui/Logo";
import { PanelHero } from "@/components/ui/PanelHero";
import { fotoHeroBeranda } from "@/assets/foto";
import { ambilSesiAtauTamu } from "@/lib/api-server";
import { berandaRole } from "@/lib/sesi";
import { KONTAINER } from "@/lib/tata-letak";

import { FormMasuk } from "./FormMasuk";

export const metadata: Metadata = { title: "Masuk" };

/**
 * FR-AKN-05 (hal-07). Pengguna yang sudah login langsung diarahkan ke dashboard role-nya. Mulai `lg`: foto
 * dekoratif di kiri (`PanelHero sisi="kiri"`, foto beranda dipakai ulang; tanpa teks di atasnya, decisions §B),
 * kartu di kanan dalam `KONTAINER` (tepi kanan sejajar header). Di bawah `lg` hanya kartu.
 */
export default async function HalamanMasuk() {
  const sesi = await ambilSesiAtauTamu();
  if (sesi) redirect(berandaRole(sesi.role));

  return (
    // flex-1: section (dan foto absolutnya) memanjang sampai footer bila layar lebih tinggi dari kartu.
    <section className="relative flex-1 overflow-hidden">
      <PanelHero foto={fotoHeroBeranda} sisi="kiri" />
      <div className={`${KONTAINER} relative flex py-10 lg:justify-end lg:py-12`}>
        <Kartu className="mx-auto w-full max-w-xl rounded-2xl! p-6 sm:p-10 lg:mx-0">
          <div aria-hidden="true" className="mb-5 flex justify-center">
            <Logo ukuran="besar" />
          </div>
          <h1 className="text-center font-display text-3xl font-bold sm:text-4xl">
            Masuk ke Akun Anda
          </h1>
          <p className="mt-3 mb-8 text-center text-navy/80">
            Jelajahi lebih banyak pengetahuan bersama Perpustakaan Naratif.
          </p>
          <FormMasuk />
        </Kartu>
      </div>
    </section>
  );
}

import type { Metadata } from "next";

import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";

import { DaftarMaster } from "../_komponen/DaftarMaster";

export const metadata: Metadata = { title: "Rak" };

/** FR-BKU-01, DR-04, OQ-08: kelola rak (kode wajib, lokasi opsional). Daftar penuh dari API. */
export default async function HalamanRak() {
  const data = await ambilServer<components["schemas"]["RakKeluar"][]>("/admin/rak");
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl sm:text-4xl">Rak</h1>
        <p className="text-navy/80">Lokasi penyimpanan eksemplar.</p>
      </header>
      <DaftarMaster jenis="rak" data={data} />
    </section>
  );
}

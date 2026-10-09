import type { Metadata } from "next";

import { fotoHeroBeranda } from "@/assets/foto";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";

import { DaftarMaster } from "../_komponen/DaftarMaster";

export const metadata: Metadata = { title: "Rak" };

/** FR-BKU-01, DR-04, OQ-08: kelola rak (kode wajib, lokasi opsional). Daftar penuh dari API. */
export default async function HalamanRak() {
  const data = await ambilServer<components["schemas"]["RakKeluar"][]>("/admin/rak");
  return (
    <section className="flex flex-col gap-6">
      <KepalaHalamanArea
        judul="Rak"
        subjudul="Kelola lokasi rak tempat eksemplar disimpan."
        foto={fotoHeroBeranda}
      />
      <DaftarMaster jenis="rak" data={data} />
    </section>
  );
}

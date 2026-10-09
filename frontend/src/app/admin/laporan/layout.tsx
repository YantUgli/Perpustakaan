import type { ReactNode } from "react";

import { fotoHeroBeranda } from "@/assets/foto";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";

import { TabLaporan } from "./_komponen/TabLaporan";

/** FR-LAP-02/03: kerangka laporan; satu menu "Laporan", dua jenis laporan sebagai tab di dalam halaman. */
export default function LayoutLaporan({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <KepalaHalamanArea
        judul="Laporan"
        subjudul="Cetak atau unduh laporan sesuai filter yang aktif."
        foto={fotoHeroBeranda}
      />
      <TabLaporan />
      {children}
    </section>
  );
}

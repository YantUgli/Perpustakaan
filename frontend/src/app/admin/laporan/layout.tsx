import type { ReactNode } from "react";

import { TabLaporan } from "./_komponen/TabLaporan";

/** FR-LAP-02/03: kerangka laporan; satu menu "Laporan", dua jenis laporan sebagai tab di dalam halaman. */
export default function LayoutLaporan({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl sm:text-4xl">Laporan</h1>
        <p className="text-navy/80">Cetak atau unduh laporan sesuai filter yang aktif.</p>
      </header>
      <TabLaporan />
      {children}
    </section>
  );
}

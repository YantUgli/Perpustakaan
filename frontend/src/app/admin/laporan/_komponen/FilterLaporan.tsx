import type { ReactNode } from "react";

import { Isian } from "@/components/ui/Isian";
import { TautanTombol, Tombol } from "@/components/ui/Tombol";

type Props = {
  /** Path halaman laporan; juga tujuan tombol Reset. */
  action: string;
  dari?: string;
  sampai?: string;
  /** Dasar rentang tanggal (OQ-07 tanggal pinjam, OQ-11 tanggal dibentuk). */
  keterangan: string;
  /** Pilihan tambahan khusus laporan (status, jenis, metode). */
  children?: ReactNode;
};

/**
 * Filter laporan (metode GET, nilai di URL). Rentang `dari`/`sampai` inklusif; urutan tanggal yang salah
 * diputuskan backend (OQ-38), bukan klien.
 */
export function FilterLaporan({ action, dari, sampai, keterangan, children }: Props) {
  return (
    <form
      method="get"
      action={action}
      aria-label="Filter laporan"
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
    >
      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <Isian label="Dari" name="dari" type="date" defaultValue={dari ?? ""} />
        <Isian label="Sampai" name="sampai" type="date" defaultValue={sampai ?? ""} />
        {children}
        <div className="flex gap-2">
          <Tombol type="submit">Terapkan</Tombol>
          <TautanTombol href={action} varian="sekunder">
            Reset
          </TautanTombol>
        </div>
      </div>
      <p className="text-xs text-navy/70">{keterangan}</p>
    </form>
  );
}

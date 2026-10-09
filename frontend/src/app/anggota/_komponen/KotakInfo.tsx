import type { ReactNode } from "react";

import { Ikon } from "@/components/ui/Ikon";

/**
 * Kotak keterangan statis area anggota (hal-10, hal-11): ikon info dalam lingkaran, judul opsional, isi. Bukan
 * umpan balik, jadi tanpa `role` (berbeda dengan `Pesan`).
 */
export function KotakInfo({ judul, children }: { judul?: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-status-dipinjam/30 bg-status-dipinjam-bg p-5 text-status-dipinjam">
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface"
      >
        <Ikon nama="info" className="size-6" />
      </span>
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        {judul && <p className="font-display text-lg font-semibold">{judul}</p>}
        <p>{children}</p>
      </div>
    </div>
  );
}

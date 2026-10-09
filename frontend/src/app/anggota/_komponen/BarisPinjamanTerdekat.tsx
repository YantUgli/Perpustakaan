import { Ikon } from "@/components/ui/Ikon";
import type { components } from "@/lib/api-skema";
import { formatTanggal } from "@/lib/format";

import { PilSisaHari } from "./PilSisaHari";

type Pinjaman = components["schemas"]["PinjamanAktifKeluar"];

/**
 * Satu baris "Pinjaman Terdekat Jatuh Tempo" di dashboard (hal-09, FR-AGT-02, OQ-34): judul, kode eksemplar,
 * jatuh tempo, dan `PilSisaHari`. Tanpa cover/penulis/kategori (∅API). Halaman Pinjaman Saya memakai
 * `TabelPinjaman` (mulai `xl`) dan `KartuPinjaman`.
 */
export function BarisPinjamanTerdekat({ p }: { p: Pinjaman }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-xl border border-line p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-status-dipinjam-bg text-navy"
      >
        <Ikon nama="bukuIsi" className="size-6" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-display text-lg leading-snug wrap-break-word">{p.judul}</p>
        <p className="angka text-sm text-navy/70">{p.kode_eksemplar}</p>
      </div>
      <div className="col-start-2 flex items-center gap-2 sm:col-start-auto">
        <Ikon nama="kalender" className="size-6 shrink-0 text-gold-700" />
        <div className="flex flex-col">
          <span className="text-xs text-navy/70">Jatuh Tempo</span>
          <span className="angka text-sm">{formatTanggal(p.jatuh_tempo)}</span>
        </div>
      </div>
      <PilSisaHari
        p={p}
        className="col-start-2 justify-self-start sm:col-start-auto sm:justify-self-end"
      />
    </li>
  );
}

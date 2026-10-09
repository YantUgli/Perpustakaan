import { Ikon } from "@/components/ui/Ikon";
import type { components } from "@/lib/api-skema";
import { teksSisaHari } from "@/lib/area-anggota";
import { formatTanggal } from "@/lib/format";

type Pinjaman = components["schemas"]["PinjamanAktifKeluar"];

// Keputusan 1 (Ayen 09/10/2026): dua nada saja, dari field `terlambat` API; tanpa ambang hari lain.
const NADA_PIL = {
  terlambat: "bg-status-terlambat-bg text-status-terlambat border-status-terlambat/30",
  normal: "bg-status-dipinjam-bg text-status-dipinjam border-status-dipinjam/30",
};

/**
 * Satu baris "Pinjaman Terdekat Jatuh Tempo" di dashboard (hal-09, FR-AGT-02, OQ-34): judul, kode eksemplar,
 * jatuh tempo, dan pil `teksSisaHari()`. Tanpa cover/penulis/kategori (∅API). Halaman Pinjaman Saya tetap
 * memakai `KartuPinjaman`.
 */
export function BarisPinjamanTerdekat({ p }: { p: Pinjaman }) {
  const nada = p.terlambat ? "terlambat" : "normal";
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
      <span
        data-nada={nada}
        className={`col-start-2 justify-self-start rounded-lg border px-3 py-1.5 text-sm font-semibold whitespace-nowrap sm:col-start-auto sm:justify-self-end ${NADA_PIL[nada]}`}
      >
        {teksSisaHari(p)}
      </span>
    </li>
  );
}

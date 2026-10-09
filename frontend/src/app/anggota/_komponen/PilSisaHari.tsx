import type { components } from "@/lib/api-skema";
import { teksSisaHari } from "@/lib/area-anggota";

type Pinjaman = Pick<
  components["schemas"]["PinjamanAktifKeluar"],
  "sisa_hari" | "terlambat" | "hari_terlambat"
>;

// Keputusan 1 (Ayen 09/10/2026): dua nada saja, dari field `terlambat` API; tanpa ambang hari lain.
const NADA_PIL = {
  terlambat: "bg-status-terlambat-bg text-status-terlambat border-status-terlambat/30",
  normal: "bg-status-dipinjam-bg text-status-dipinjam border-status-dipinjam/30",
};

/**
 * Pil sisa hari (hal-09, hal-11; FR-AGT-02, OQ-34): teks `teksSisaHari()`, nada terlambat atau dipinjam (termasuk
 * "Jatuh tempo hari ini"). Dipakai dashboard (`BarisPinjamanTerdekat`) dan tabel Pinjaman Saya.
 */
export function PilSisaHari({ p, className = "" }: { p: Pinjaman; className?: string }) {
  const nada = p.terlambat ? "terlambat" : "normal";
  return (
    <span
      data-nada={nada}
      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${NADA_PIL[nada]} ${className}`}
    >
      {teksSisaHari(p)}
    </span>
  );
}

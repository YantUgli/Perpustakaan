import type { components } from "@/lib/api-skema";
import { teksSisaHari } from "@/lib/area-anggota";
import { formatTanggal } from "@/lib/format";

import { KartuRingkas } from "@/components/ui/KartuRingkas";

type Pinjaman = components["schemas"]["PinjamanAktifKeluar"];

/**
 * Kartu "Jatuh Tempo Terdekat" (hal-09 dashboard bertaut, hal-11 Pinjaman Saya tanpa tautan; FR-AGT-02, OQ-34):
 * `pertama` = `pinjaman[0]` (backend urut jatuh tempo lalu id). Teks dari `teksSisaHari()`; tanpa ambang
 * "segera jatuh tempo". Tanpa pinjaman: "—" + "Tidak ada pinjaman".
 */
export function KartuJatuhTempoTerdekat({
  pertama,
  href,
}: {
  pertama: Pinjaman | undefined;
  href?: string;
}) {
  return (
    <KartuRingkas
      href={href}
      label="Jatuh Tempo Terdekat"
      ikon="kalender"
      nada="gold"
      nilai={
        !pertama ? (
          <span className="font-display text-3xl leading-none">—</span>
        ) : pertama.terlambat || pertama.sisa_hari === 0 ? (
          <span
            className={`text-lg font-semibold ${pertama.terlambat ? "text-status-terlambat" : "text-navy"}`}
          >
            {teksSisaHari(pertama)}
          </span>
        ) : (
          pertama.sisa_hari
        )
      }
      satuan={pertama && !pertama.terlambat && pertama.sisa_hari > 0 ? "hari lagi" : undefined}
      keterangan={pertama ? formatTanggal(pertama.jatuh_tempo) : "Tidak ada pinjaman"}
    />
  );
}

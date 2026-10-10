import { Ikon } from "@/components/ui/Ikon";
import type { components } from "@/lib/api-skema";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { LABEL_JENIS_TAGIHAN } from "@/lib/label";

import { PanelDashboard } from "@/components/ui/PanelDashboard";

type Tagihan = components["schemas"]["TagihanAnggotaKeluar"];

/**
 * Panel "Tagihan Aktif" (hal-09, FR-AGT-04, keputusan Ayen 09/10/2026): maks 3 tagihan `BELUM_LUNAS` dari
 * `tagihanAktif()` (urutan API). Hanya informasi: tanpa tombol bayar (penyelesaian oleh admin, FR-TGH).
 */
export function PanelTagihanAktif({ tagihan }: { tagihan: Tagihan[] }) {
  return (
    <PanelDashboard id="judul-tagihan-aktif" judul="Tagihan Aktif" lihatSemua="/anggota/tagihan">
      {tagihan.length === 0 ? (
        <div className="flex items-center gap-4 rounded-xl bg-status-tersedia-bg p-4">
          <span
            aria-hidden="true"
            data-ikon-kosong="struk-centang"
            className="relative flex size-14 shrink-0 items-center justify-center rounded-full bg-surface text-status-tersedia"
          >
            {/* hal-09: struk dengan lencana centang di pojok kanan bawah. */}
            <Ikon nama="struk" className="size-7" />
            <span className="absolute right-0.5 bottom-0.5 flex size-5 items-center justify-center rounded-full bg-status-tersedia text-white ring-2 ring-surface">
              <Ikon nama="centang" className="size-3.5" />
            </span>
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="font-display text-lg">Tidak ada tagihan</p>
            <p className="text-sm text-navy/80">Tidak ada tagihan yang belum lunas.</p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {tagihan.slice(0, 3).map((t) => (
            <li
              key={t.id}
              className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="font-display leading-snug wrap-break-word">{t.judul}</p>
                <p className="text-sm text-navy/70">
                  {LABEL_JENIS_TAGIHAN[t.jenis]} ·{" "}
                  <span className="angka">{formatTanggal(t.tanggal_dibentuk)}</span>
                </p>
              </div>
              <p className="angka shrink-0 font-semibold">{formatRupiah(t.nominal)}</p>
            </li>
          ))}
        </ul>
      )}
    </PanelDashboard>
  );
}

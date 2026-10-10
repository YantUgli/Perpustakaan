import { LabelStatus } from "@/components/ui/LabelStatus";
import type { components } from "@/lib/api-skema";
import { formatTanggal } from "@/lib/format";

import { PanelDashboard } from "@/components/ui/PanelDashboard";

type ItemRiwayat = components["schemas"]["ItemRiwayatKeluar"];

/**
 * Panel "Riwayat Terbaru" (hal-09 "Aktivitas Terbaru" disesuaikan, keputusan Ayen 09/10/2026): cuplikan FR-AGT-03,
 * yaitu halaman 1 riwayat apa adanya (urutan API: tanggal pinjam terbaru, OQ-35). Bukan log aktivitas: tanpa jam,
 * tanpa menyusun/mengurutkan peristiwa. Terlambat dari field `terlambat` (IR-UI-03).
 */
export function PanelRiwayatTerbaru({ riwayat }: { riwayat: ItemRiwayat[] }) {
  return (
    <PanelDashboard
      id="judul-riwayat-terbaru"
      judul="Riwayat Terbaru"
      lihatSemua="/anggota/riwayat"
    >
      {riwayat.length === 0 ? (
        <p className="text-sm text-navy/70">Belum ada riwayat peminjaman.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {riwayat.map((r, i) => (
            <li
              key={`${i}-${r.kode_eksemplar}`}
              className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-display leading-snug wrap-break-word">{r.judul}</p>
                <LabelStatus status={r.status} terlambat={r.terlambat} className="shrink-0" />
              </div>
              <p className="angka text-sm text-navy/70">
                Dipinjam {formatTanggal(r.tanggal_pinjam)}
                {r.tanggal_kembali && <> · Kembali {formatTanggal(r.tanggal_kembali)}</>}
                {r.tanggal_kejadian && <> · Kejadian {formatTanggal(r.tanggal_kejadian)}</>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PanelDashboard>
  );
}

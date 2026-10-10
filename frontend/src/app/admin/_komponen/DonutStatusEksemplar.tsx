import { LabelStatus } from "@/components/ui/LabelStatus";
import { PanelDashboard } from "@/components/ui/PanelDashboard";
import { formatAngka } from "@/lib/format";
import { type NadaStatus, labelStatus } from "@/lib/label";
import { type RingkasanEksemplar, segmenDonut } from "@/lib/laporan-admin";

// Geometri dalam satuan viewBox 120 × 120 (tampil 160 px → 1 satuan ≈ 1,33 px).
const JARI = 48;
const TEBAL = 16;
const KELILING = 2 * Math.PI * JARI;
/** Celah pemisah antarsegmen ±2 px (dataviz: 2px surface gap). */
const CELAH = 1.5;

// Kelas ditulis utuh agar terbaca Tailwind. Warna = token status yang sama dengan `LabelStatus` (IR-UI-03).
const GARIS: Partial<Record<NadaStatus, string>> = {
  tersedia: "stroke-status-tersedia",
  dipinjam: "stroke-status-dipinjam",
  hilang: "stroke-status-hilang",
  rusak: "stroke-status-rusak",
};
const TITIK: Partial<Record<NadaStatus, string>> = {
  tersedia: "bg-status-tersedia",
  dipinjam: "bg-status-dipinjam",
  hilang: "bg-status-hilang",
  rusak: "bg-status-rusak",
};

/**
 * Panel "Status Eksemplar" dashboard admin (hal-31, FR-LAP-01, keputusan Ayen 10/10/2026). Donut SVG statis tanpa
 * library, `aria-hidden`: identitas segmen tidak bergantung pada warna karena **legenda** (label `LabelStatus`,
 * jumlah, persen) adalah alternatif teksnya. Token Hilang ↔ Rusak gagal uji pembeda warna (ΔE 12,4); diterima
 * dengan legenda teks + celah antarsegmen (spec `design/specs/dashboard-admin.md`, Q1 opsi a).
 */
export function DonutStatusEksemplar({ ringkasan }: { ringkasan: RingkasanEksemplar }) {
  const { total, baris } = ringkasan;
  const segmen = segmenDonut(
    baris.map((b) => b.jumlah),
    KELILING,
    CELAH,
  );

  return (
    <PanelDashboard
      id="judul-status-eksemplar"
      judul="Status Eksemplar"
      subjudul="Distribusi status seluruh eksemplar buku."
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
        <div aria-hidden="true" data-donut className="relative size-40 shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r={JARI}
              fill="none"
              strokeWidth={TEBAL}
              className="stroke-line"
            />
            {segmen.map((s) => (
              <circle
                key={baris[s.indeks].status}
                cx="60"
                cy="60"
                r={JARI}
                fill="none"
                strokeWidth={TEBAL}
                strokeDasharray={`${s.panjang} ${KELILING - s.panjang}`}
                strokeDashoffset={-s.mulai}
                className={GARIS[labelStatus(baris[s.indeks].status).nada]}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl leading-none tabular-nums lining-nums">
              {total === null ? "—" : formatAngka(total)}
            </span>
            <span className="text-xs text-navy/70">eksemplar</span>
          </div>
        </div>

        <ul
          aria-label="Rincian status eksemplar"
          className="flex w-full flex-col gap-3 sm:max-w-sm"
        >
          {baris.map((b) => (
            <li
              key={b.status}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto_3.5rem] items-center gap-3"
            >
              <span
                aria-hidden="true"
                className={`size-3 rounded-full ${TITIK[labelStatus(b.status).nada]}`}
              />
              <LabelStatus status={b.status} className="justify-self-start" />
              <span className="angka text-right">
                {b.jumlah === null ? "—" : formatAngka(b.jumlah)}
              </span>
              <span className="angka text-right text-sm text-navy/70">
                {b.persen === null ? "—" : `${b.persen}%`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </PanelDashboard>
  );
}

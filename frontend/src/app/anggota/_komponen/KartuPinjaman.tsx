import { LabelStatus } from "@/components/ui/LabelStatus";
import type { components } from "@/lib/api-skema";
import { teksSisaHari } from "@/lib/area-anggota";
import { formatTanggal } from "@/lib/format";

type Pinjaman = components["schemas"]["PinjamanAktifKeluar"];

/** Satu pinjaman aktif (FR-AGT-02): jatuh tempo, sisa hari, dan penanda Terlambat dari field `terlambat`. */
export function KartuPinjaman({ p }: { p: Pinjaman }) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-display text-lg leading-snug">{p.judul}</p>
        <p className="angka text-sm text-navy/70">{p.kode_eksemplar}</p>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
          <dt className="text-navy/70">Tanggal pinjam</dt>
          <dd className="angka">{formatTanggal(p.tanggal_pinjam)}</dd>
          <dt className="text-navy/70">Jatuh tempo</dt>
          <dd className="angka">{formatTanggal(p.jatuh_tempo)}</dd>
        </dl>
      </div>
      <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end">
        <LabelStatus status="DIPINJAM" terlambat={p.terlambat} />
        <span
          className={`text-sm font-semibold ${p.terlambat ? "text-status-terlambat" : "text-navy"}`}
        >
          {teksSisaHari(p)}
        </span>
      </div>
    </li>
  );
}

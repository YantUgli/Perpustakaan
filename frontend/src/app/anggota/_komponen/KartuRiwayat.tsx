import { LabelStatus } from "@/components/ui/LabelStatus";
import type { components } from "@/lib/api-skema";
import { tanggalAkhir } from "@/lib/area-anggota";
import { formatTanggal } from "@/lib/format";

type Item = components["schemas"]["ItemRiwayatKeluar"];

/**
 * Satu item riwayat sebagai kartu (FR-AGT-03, OQ-35), dipakai di bawah `xl`; markup sama dengan sebelum hal-13.
 * Keterangan & admin pencatat tidak ditampilkan (catatan internal admin).
 */
export function KartuRiwayat({ item }: { item: Item }) {
  const akhir = tanggalAkhir(item);
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-display text-lg leading-snug">{item.judul}</p>
        <p className="angka text-sm text-navy/70">{item.kode_eksemplar}</p>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
          <dt className="text-navy/70">Tanggal pinjam</dt>
          <dd className="angka">{formatTanggal(item.tanggal_pinjam)}</dd>
          <dt className="text-navy/70">Jatuh tempo</dt>
          <dd className="angka">{formatTanggal(item.jatuh_tempo)}</dd>
          <dt className="text-navy/70">{akhir.label}</dt>
          <dd className="angka">{akhir.tanggal ? formatTanggal(akhir.tanggal) : akhir.kosong}</dd>
        </dl>
      </div>
      <LabelStatus status={item.status} terlambat={item.terlambat} className="self-start" />
    </li>
  );
}

import { LabelStatus } from "@/components/ui/LabelStatus";
import type { components } from "@/lib/api-skema";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { LABEL_CARA_PENYELESAIAN, LABEL_JENIS_TAGIHAN } from "@/lib/label";

type Tagihan = components["schemas"]["TagihanAnggotaKeluar"];

/**
 * Satu tagihan sebagai kartu (FR-AGT-04, OQ-36), dipakai di bawah `xl`; markup sama dengan sebelum hal-14.
 * Admin pengonfirmasi & nominal dibayar tidak ditampilkan.
 */
export function KartuTagihan({ t }: { t: Tagihan }) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-semibold text-navy/80">{LABEL_JENIS_TAGIHAN[t.jenis]}</p>
        <p className="angka font-display text-2xl">{formatRupiah(t.nominal)}</p>
        <p className="text-sm">
          {t.judul} <span className="angka text-navy/70">· {t.kode_eksemplar}</span>
        </p>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
          <dt className="text-navy/70">Tanggal dibentuk</dt>
          <dd className="angka">{formatTanggal(t.tanggal_dibentuk)}</dd>
          <dt className="text-navy/70">Cara penyelesaian</dt>
          <dd>{t.cara_penyelesaian ? LABEL_CARA_PENYELESAIAN[t.cara_penyelesaian] : "—"}</dd>
          {t.tanggal_penyelesaian && (
            <>
              <dt className="text-navy/70">Tanggal penyelesaian</dt>
              <dd className="angka">{formatTanggal(t.tanggal_penyelesaian)}</dd>
            </>
          )}
        </dl>
      </div>
      <LabelStatus status={t.status} className="self-start" />
    </li>
  );
}

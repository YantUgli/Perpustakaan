import type { Metadata } from "next";
import Link from "next/link";

import { KosongState } from "@/components/ui/KosongState";
import { Pesan } from "@/components/ui/Pesan";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { GalatApi } from "@/lib/galat";
import { LABEL_PER_HALAMAN, idLabelDariParam, queryLabel } from "@/lib/label-cetak";

import { LembarLabel } from "./LembarLabel";
import { TombolCetak } from "./TombolCetak";

type Label = components["schemas"]["LabelEksemplar"];

export const metadata: Metadata = { title: "Cetak Label" };

/**
 * FR-BKU-06, IR-HW-02: cetak label QR eksemplar (`?id=` berulang) pada kertas A4, beberapa label per
 * halaman. Data dari `GET /admin/eksemplar/label`; gambar QR dan tata letak dibuat di klien (decisions §B).
 */
export default async function CetakLabel({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ids = idLabelDariParam(await searchParams);

  let label: Label[] = [];
  let galat: string | null = null;
  if (ids.length > 0) {
    try {
      label = await ambilServer<Label[]>(`/admin/eksemplar/label?${queryLabel(ids)}`);
    } catch (e) {
      // Penolakan backend (mis. batas jumlah, id tak ada) tampil apa adanya; galat sistem tetap dilempar.
      if (e instanceof GalatApi && !e.sistem) galat = e.pesan;
      else throw e;
    }
  }

  return (
    <section className="flex flex-col gap-6 print:gap-0">
      <div className="flex flex-col gap-4 print:hidden">
        <Link href="/admin/judul" className="text-sm font-semibold text-gold-700">
          ← Kembali ke data buku
        </Link>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-3xl sm:text-4xl">Cetak Label</h1>
            {label.length > 0 && (
              <p className="angka text-navy/80">
                {label.length} label · {LABEL_PER_HALAMAN} per halaman A4
              </p>
            )}
          </div>
          {label.length > 0 && <TombolCetak />}
        </header>
        <p className="print:hidden rounded-lg border border-line bg-surface px-4 py-3 text-sm text-navy/90">
          Cetak dengan skala 100% (jangan pilih &ldquo;fit to page&rdquo; atau &ldquo;sesuaikan
          dengan halaman&rdquo;), kertas A4, orientasi potret. Label dipotong mengikuti garis
          putus-putus.
        </p>
        {galat && <Pesan jenis="galat">{galat}</Pesan>}
      </div>

      {ids.length === 0 && (
        <KosongState
          judul="Belum ada eksemplar dipilih"
          keterangan="Pilih eksemplar di halaman judul, lalu pilih Cetak Label."
        />
      )}
      {label.length > 0 && <LembarLabel label={label} />}
    </section>
  );
}

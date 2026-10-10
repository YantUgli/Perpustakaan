import Link from "next/link";

import { Ikon } from "@/components/ui/Ikon";
import { PanelDashboard } from "@/components/ui/PanelDashboard";
import { Pesan } from "@/components/ui/Pesan";
import type { components } from "@/lib/api-skema";
import { formatRupiah } from "@/lib/format";
import { LABEL_JENIS_TAGIHAN } from "@/lib/label";

type Tagihan = components["schemas"]["TagihanKeluar"];

/**
 * Panel "Tagihan Belum Lunas" dashboard admin (hal-31, FR-TGH-01, keputusan Ayen 10/10/2026): 5 baris pertama
 * `GET /admin/tagihan?status=BELUM_LUNAS`, urutan API (tanggal dibentuk terbaru dulu). Anggota, jenis, nominal;
 * tiap baris menaut ke detail tagihan. Tanpa keterangan keterlambatan (dipisah dari panel Item Terlambat).
 */
export function PanelTagihanBelumLunas({
  tagihan,
  galat,
}: {
  tagihan: Tagihan[];
  galat: string | null;
}) {
  const ada = galat === null && tagihan.length > 0;
  return (
    <PanelDashboard
      id="judul-tagihan-belum-lunas"
      judul="Tagihan Belum Lunas"
      subjudul="Tagihan terbaru yang menunggu penyelesaian."
      lihatSemua={ada ? "/admin/tagihan?status=BELUM_LUNAS" : undefined}
    >
      {galat !== null ? (
        <Pesan jenis="galat">{galat}</Pesan>
      ) : tagihan.length === 0 ? (
        <p className="text-sm text-navy/70">Tidak ada tagihan Belum Lunas.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {tagihan.map((t) => (
            <li key={t.id} className="py-1 first:pt-0 last:pb-0">
              <Link
                href={`/admin/tagihan/${t.id}`}
                className="group flex items-center justify-between gap-4 rounded-lg py-2"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold wrap-break-word group-hover:underline">
                    {t.anggota.nama}{" "}
                    <span className="angka font-normal text-navy/70">({t.anggota.kode})</span>
                  </span>
                  <span className="text-sm text-navy/80">{LABEL_JENIS_TAGIHAN[t.jenis]}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="angka font-semibold">{formatRupiah(t.nominal)}</span>
                  <Ikon nama="panah" className="size-4 text-navy/40 group-hover:text-gold-700" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelDashboard>
  );
}

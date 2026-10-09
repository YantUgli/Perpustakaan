import type { Metadata } from "next";

import { fotoHeroBeranda } from "@/assets/foto";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";
import { KosongState } from "@/components/ui/KosongState";
import { LabelStatus } from "@/components/ui/LabelStatus";
import { Paginasi } from "@/components/ui/Paginasi";
import { Pesan } from "@/components/ui/Pesan";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { halamanDariParam } from "@/lib/halaman";
import { LABEL_CARA_PENYELESAIAN, LABEL_JENIS_TAGIHAN } from "@/lib/label";

type HalamanTagihan = components["schemas"]["HalamanTagihanAnggota"];

export const metadata: Metadata = { title: "Tagihan" };

/**
 * FR-AGT-04, OQ-36: jenis, nominal, status, cara penyelesaian (+ tanggal & buku sebagai konteks).
 * Admin pengonfirmasi & nominal dibayar tidak ditampilkan. Pembayaran hanya di perpustakaan (tanpa payment gateway).
 */
export default async function HalamanTagihan({
  searchParams,
}: {
  searchParams: Promise<{ halaman?: string | string[] }>;
}) {
  const halaman = halamanDariParam((await searchParams).halaman);
  const tagihan = await ambilServer<HalamanTagihan>(`/anggota/tagihan?halaman=${halaman}`);

  return (
    <section className="flex flex-col gap-6">
      <KepalaHalamanArea
        judul="Tagihan"
        subjudul="Ringkasan denda dan penggantian buku atas nama Anda."
        foto={fotoHeroBeranda}
      />

      <Pesan jenis="info" judul="Pembayaran tagihan">
        Tagihan diselesaikan langsung di perpustakaan, secara tunai atau transfer dengan konfirmasi
        petugas. Tidak ada pembayaran online.
      </Pesan>

      {tagihan.data.length === 0 ? (
        <KosongState judul="Tidak ada tagihan" />
      ) : (
        <ul className="flex flex-col gap-3">
          {tagihan.data.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-start sm:justify-between"
            >
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
                  <dd>
                    {t.cara_penyelesaian ? LABEL_CARA_PENYELESAIAN[t.cara_penyelesaian] : "—"}
                  </dd>
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
          ))}
        </ul>
      )}

      <Paginasi
        halaman={halaman}
        total={tagihan.total}
        perHalaman={tagihan.per_halaman}
        path="/anggota/tagihan"
      />
    </section>
  );
}

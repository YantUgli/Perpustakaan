import type { Metadata } from "next";

import { KosongState } from "@/components/ui/KosongState";
import { LabelStatus } from "@/components/ui/LabelStatus";
import { Paginasi } from "@/components/ui/Paginasi";
import { Pesan } from "@/components/ui/Pesan";
import { Pilihan } from "@/components/ui/Pilihan";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { GalatApi } from "@/lib/galat";
import { LABEL_CARA_PENYELESAIAN, LABEL_JENIS_TAGIHAN } from "@/lib/label";
import {
  OPSI_CARA_LAPORAN,
  OPSI_JENIS_LAPORAN,
  OPSI_STATUS_TAGIHAN_LAPORAN,
  filterTagihanDariParam,
  paramsPaginasi,
  queryTagihan,
  urlEksporTagihan,
} from "@/lib/laporan-admin";

import { AksiEkspor } from "../_komponen/AksiEkspor";
import { FilterLaporan } from "../_komponen/FilterLaporan";

type Laporan = components["schemas"]["LaporanTagihanKeluar"];

export const metadata: Metadata = { title: "Laporan Denda & Penggantian" };

/**
 * FR-LAP-03, FR-LAP-04, OQ-11, OQ-38, OQ-39: laporan tagihan berhalaman. **Total nominal dari
 * `total_nominal` API** (seluruh baris yang lolos filter, bukan halaman); klien tidak menjumlahkan. Tabel,
 * total, dan tautan ekspor hanya tampil bila respons laporan berhasil.
 */
export default async function LaporanTagihan({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = filterTagihanDariParam(await searchParams);

  let hasil: Laporan | null = null;
  let galat: string | null = null;
  try {
    hasil = await ambilServer<Laporan>(`/admin/laporan/tagihan?${queryTagihan(filter)}`);
  } catch (e) {
    if (e instanceof GalatApi) galat = e.pesan;
    else throw e;
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterLaporan
        action="/admin/laporan/tagihan"
        dari={filter.dari}
        sampai={filter.sampai}
        keterangan="Rentang tanggal dihitung dari tanggal dibentuk tagihan (batas awal dan akhir ikut dihitung)."
      >
        <Pilihan
          label="Jenis"
          name="jenis"
          opsi={OPSI_JENIS_LAPORAN}
          defaultValue={filter.jenis ?? ""}
        />
        <Pilihan
          label="Status"
          name="status"
          opsi={OPSI_STATUS_TAGIHAN_LAPORAN}
          defaultValue={filter.status ?? ""}
        />
        <Pilihan
          label="Metode penyelesaian"
          name="cara"
          opsi={OPSI_CARA_LAPORAN}
          defaultValue={filter.cara ?? ""}
        />
      </FilterLaporan>

      {galat !== null && <Pesan jenis="galat">{galat}</Pesan>}

      {hasil && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-navy/80">
              <span className="angka">{hasil.total} baris</span>
              <span aria-hidden="true"> · </span>
              Total nominal:{" "}
              <strong className="angka font-semibold text-navy">
                {formatRupiah(hasil.total_nominal)}
              </strong>
            </p>
            <AksiEkspor
              urlPdf={urlEksporTagihan(filter, "pdf")}
              urlXlsx={urlEksporTagihan(filter, "xlsx")}
            />
          </div>

          {hasil.data.length === 0 ? (
            <KosongState
              judul="Tidak ada data"
              keterangan="Tidak ada tagihan yang cocok dengan filter ini."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[72rem] text-left text-sm">
                <thead className="border-b border-line text-navy/70">
                  <tr>
                    <th className="px-4 py-3 font-medium">Tanggal dibentuk</th>
                    <th className="px-4 py-3 font-medium">Anggota</th>
                    <th className="px-4 py-3 font-medium">Buku</th>
                    <th className="px-4 py-3 font-medium">Jenis</th>
                    <th className="px-4 py-3 text-right font-medium">Nominal</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Cara penyelesaian</th>
                    <th className="px-4 py-3 font-medium">Tanggal penyelesaian</th>
                    <th className="px-4 py-3 font-medium">Admin pengonfirmasi</th>
                  </tr>
                </thead>
                <tbody>
                  {hasil.data.map((b) => (
                    <tr key={b.id} className="border-b border-line last:border-0">
                      <td className="angka px-4 py-3">{formatTanggal(b.tanggal_dibentuk)}</td>
                      <td className="px-4 py-3">
                        <span className="angka block font-medium">{b.anggota_kode}</span>
                        <span className="text-navy/80">{b.anggota_nama}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block">{b.judul}</span>
                        <span className="angka text-navy/70">{b.kode_eksemplar}</span>
                      </td>
                      <td className="px-4 py-3">{LABEL_JENIS_TAGIHAN[b.jenis]}</td>
                      <td className="angka px-4 py-3 text-right">{formatRupiah(b.nominal)}</td>
                      <td className="px-4 py-3">
                        <LabelStatus status={b.status} />
                      </td>
                      <td className="px-4 py-3">
                        {b.cara_penyelesaian ? LABEL_CARA_PENYELESAIAN[b.cara_penyelesaian] : "—"}
                      </td>
                      <td className="angka px-4 py-3">
                        {b.tanggal_penyelesaian ? formatTanggal(b.tanggal_penyelesaian) : "—"}
                      </td>
                      <td className="px-4 py-3">{b.admin_pengonfirmasi ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Paginasi
            halaman={filter.halaman}
            total={hasil.total}
            perHalaman={hasil.per_halaman}
            path="/admin/laporan/tagihan"
            params={paramsPaginasi(filter)}
          />
        </>
      )}
    </div>
  );
}

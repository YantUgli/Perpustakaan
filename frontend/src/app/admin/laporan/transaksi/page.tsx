import type { Metadata } from "next";

import { KosongState } from "@/components/ui/KosongState";
import { LabelStatus } from "@/components/ui/LabelStatus";
import { Paginasi } from "@/components/ui/Paginasi";
import { Pesan } from "@/components/ui/Pesan";
import { Pilihan } from "@/components/ui/Pilihan";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { formatTanggal } from "@/lib/format";
import { GalatApi } from "@/lib/galat";
import {
  OPSI_STATUS_TRANSAKSI,
  filterTransaksiDariParam,
  paramsPaginasi,
  queryTransaksi,
  urlEksporTransaksi,
} from "@/lib/laporan-admin";

import { AksiEkspor } from "../_komponen/AksiEkspor";
import { FilterLaporan } from "../_komponen/FilterLaporan";

type Laporan = components["schemas"]["LaporanTransaksiKeluar"];

export const metadata: Metadata = { title: "Laporan Transaksi" };

/**
 * FR-LAP-02, FR-LAP-04, OQ-07, OQ-37, OQ-38, OQ-41: laporan per item, berhalaman, urutan dari API. Status
 * `Terlambat` hanya dari field `terlambat` (lewat `LabelStatus`). Tabel dan tautan ekspor tampil hanya bila
 * filter lolos parse DAN respons laporan berhasil; galat apa pun menampilkan `pesan` dan menyembunyikan keduanya.
 */
export default async function LaporanTransaksi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = filterTransaksiDariParam(await searchParams);

  let hasil: Laporan | null = null;
  let galat: string | null = null;
  try {
    hasil = await ambilServer<Laporan>(`/admin/laporan/transaksi?${queryTransaksi(filter)}`);
  } catch (e) {
    if (e instanceof GalatApi) galat = e.pesan;
    else throw e;
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterLaporan
        action="/admin/laporan/transaksi"
        dari={filter.dari}
        sampai={filter.sampai}
        keterangan="Rentang tanggal dihitung dari tanggal pinjam (batas awal dan akhir ikut dihitung). Dipinjam = belum lewat jatuh tempo; Terlambat dipisahkan."
      >
        <Pilihan
          label="Status"
          name="status"
          opsi={OPSI_STATUS_TRANSAKSI}
          defaultValue={filter.status ?? ""}
        />
      </FilterLaporan>

      {galat !== null && <Pesan jenis="galat">{galat}</Pesan>}

      {hasil && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="angka text-sm text-navy/80">{hasil.total} baris</p>
            <AksiEkspor
              urlPdf={urlEksporTransaksi(filter, "pdf")}
              urlXlsx={urlEksporTransaksi(filter, "xlsx")}
            />
          </div>

          {hasil.data.length === 0 ? (
            <KosongState
              judul="Tidak ada data"
              keterangan="Tidak ada transaksi yang cocok dengan filter ini."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[60rem] text-left text-sm">
                <thead className="border-b border-line text-navy/70">
                  <tr>
                    <th className="px-4 py-3 font-medium">Anggota</th>
                    <th className="px-4 py-3 font-medium">Judul</th>
                    <th className="px-4 py-3 font-medium">Kode eksemplar</th>
                    <th className="px-4 py-3 font-medium">Tanggal pinjam</th>
                    <th className="px-4 py-3 font-medium">Jatuh tempo</th>
                    <th className="px-4 py-3 font-medium">Tanggal kembali</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hasil.data.map((b) => (
                    <tr
                      key={`${b.kode_eksemplar}-${b.tanggal_pinjam}`}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-4 py-3">
                        <span className="angka block font-medium">{b.anggota_kode}</span>
                        <span className="text-navy/80">{b.anggota_nama}</span>
                      </td>
                      <td className="px-4 py-3">{b.judul}</td>
                      <td className="angka px-4 py-3">{b.kode_eksemplar}</td>
                      <td className="angka px-4 py-3">{formatTanggal(b.tanggal_pinjam)}</td>
                      <td className="angka px-4 py-3">{formatTanggal(b.jatuh_tempo)}</td>
                      <td className="angka px-4 py-3">
                        {b.tanggal_kembali ? formatTanggal(b.tanggal_kembali) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <LabelStatus status={b.status} terlambat={b.terlambat} />
                      </td>
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
            path="/admin/laporan/transaksi"
            params={paramsPaginasi(filter)}
          />
        </>
      )}
    </div>
  );
}

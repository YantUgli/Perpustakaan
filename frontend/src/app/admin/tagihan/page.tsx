import type { Metadata } from "next";
import Link from "next/link";

import { Isian } from "@/components/ui/Isian";
import { KosongState } from "@/components/ui/KosongState";
import { LabelStatus } from "@/components/ui/LabelStatus";
import { Paginasi } from "@/components/ui/Paginasi";
import { Pilihan } from "@/components/ui/Pilihan";
import { TautanTombol, Tombol } from "@/components/ui/Tombol";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { LABEL_CARA_PENYELESAIAN, LABEL_JENIS_TAGIHAN } from "@/lib/label";
import { filterDariParam, queryDaftar } from "@/lib/tagihan-admin";

type HalamanTagihan = components["schemas"]["HalamanTagihan"];

export const metadata: Metadata = { title: "Tagihan" };

const OPSI_STATUS = [
  { nilai: "", label: "Semua status" },
  { nilai: "BELUM_LUNAS", label: "Belum Lunas" },
  { nilai: "LUNAS", label: "Lunas" },
];
const OPSI_JENIS = [
  { nilai: "", label: "Semua jenis" },
  { nilai: "DENDA", label: "Denda" },
  { nilai: "PENGGANTIAN", label: "Penggantian" },
];

/**
 * FR-TGH-01: daftar tagihan dengan filter status, jenis, dan anggota (kode, OQ-29). Hanya baca:
 * tidak ada tambah/ubah/hapus tagihan (FR-TGH-06); penyelesaian dari halaman detail.
 */
export default async function DaftarTagihan({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = filterDariParam(await searchParams);
  const hasil = await ambilServer<HalamanTagihan>(`/admin/tagihan?${queryDaftar(filter)}`);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl sm:text-4xl">Tagihan</h1>
        <p className="text-navy/80">Denda keterlambatan dan penggantian buku seluruh anggota.</p>
      </header>

      <form
        method="get"
        action="/admin/tagihan"
        aria-label="Filter tagihan"
        className="grid grid-cols-1 items-end gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <Pilihan
          label="Status"
          name="status"
          opsi={OPSI_STATUS}
          defaultValue={filter.status ?? ""}
        />
        <Pilihan label="Jenis" name="jenis" opsi={OPSI_JENIS} defaultValue={filter.jenis ?? ""} />
        <Isian
          label="Kode anggota"
          name="anggota"
          placeholder="AGT-000001"
          defaultValue={filter.anggota ?? ""}
          keterangan="Cocok persis dengan ID anggota."
        />
        <div className="flex gap-2">
          <Tombol type="submit">Terapkan</Tombol>
          <TautanTombol href="/admin/tagihan" varian="sekunder">
            Reset
          </TautanTombol>
        </div>
      </form>

      <p className="angka text-sm text-navy/80">{hasil.total} tagihan</p>

      {hasil.data.length === 0 ? (
        <KosongState
          judul="Tidak ada tagihan"
          keterangan="Tidak ada tagihan yang cocok dengan filter ini."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-line text-navy/70">
              <tr>
                <th className="px-4 py-3 font-medium">Tanggal dibentuk</th>
                <th className="px-4 py-3 font-medium">Anggota</th>
                <th className="px-4 py-3 font-medium">Buku</th>
                <th className="px-4 py-3 font-medium">Jenis</th>
                <th className="px-4 py-3 text-right font-medium">Nominal</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Cara penyelesaian</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {hasil.data.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="angka px-4 py-3">{formatTanggal(t.tanggal_dibentuk)}</td>
                  <td className="px-4 py-3">
                    <span className="angka block font-medium">{t.anggota.kode}</span>
                    <span className="text-navy/80">{t.anggota.nama}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block">{t.eksemplar.judul}</span>
                    <span className="angka text-navy/70">{t.eksemplar.kode}</span>
                  </td>
                  <td className="px-4 py-3">{LABEL_JENIS_TAGIHAN[t.jenis]}</td>
                  <td className="angka px-4 py-3 text-right">{formatRupiah(t.nominal)}</td>
                  <td className="px-4 py-3">
                    <LabelStatus status={t.status} />
                  </td>
                  <td className="px-4 py-3">
                    {t.cara_penyelesaian ? LABEL_CARA_PENYELESAIAN[t.cara_penyelesaian] : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/tagihan/${t.id}`}
                      className="font-semibold text-gold-700 underline-offset-4 hover:underline"
                    >
                      {t.status === "BELUM_LUNAS" ? "Selesaikan" : "Detail"}
                    </Link>
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
        path="/admin/tagihan"
        params={{ status: filter.status, jenis: filter.jenis, anggota: filter.anggota }}
      />
    </section>
  );
}

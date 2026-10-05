import type { Metadata } from "next";
import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import { Isian } from "@/components/ui/Isian";
import { KosongState } from "@/components/ui/KosongState";
import { Paginasi } from "@/components/ui/Paginasi";
import { TautanTombol, Tombol } from "@/components/ui/Tombol";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { filterAnggotaDariParam, queryAnggota } from "@/lib/data-admin";
import { formatTanggal } from "@/lib/format";

type HalamanAnggota = components["schemas"]["HalamanAnggota"];

export const metadata: Metadata = { title: "Data Anggota" };

const TAUTAN = "font-semibold text-gold-700 underline-offset-4 hover:underline";

/**
 * FR-AKN-10, OQ-33: daftar anggota berhalaman dengan satu kolom pencarian `q` (ID, NIK, atau nama).
 * NIK sengaja tidak ada di tabel (hanya di detail & ubah). Tanpa tambah/hapus/nonaktif anggota
 * (FR-AKN-01, domain-rules §13); foto menunggu endpoint OQ-42 → avatar inisial.
 */
export default async function DaftarAnggota({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filter = filterAnggotaDariParam(await searchParams);
  const hasil = await ambilServer<HalamanAnggota>(`/admin/anggota?${queryAnggota(filter)}`);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl sm:text-4xl">Data Anggota</h1>
        <p className="text-navy/80">
          Cari anggota dan ubah datanya. Anggota mendaftar sendiri lewat halaman pendaftaran.
        </p>
      </header>

      <form
        method="get"
        action="/admin/anggota"
        aria-label="Pencarian anggota"
        className="grid grid-cols-1 items-end gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto]"
      >
        <Isian
          label="Cari anggota"
          name="q"
          placeholder="ID anggota, NIK, atau nama"
          defaultValue={filter.q ?? ""}
          keterangan="ID dan NIK harus cocok persis; nama boleh sebagian."
        />
        <div className="flex gap-2">
          <Tombol type="submit">Cari</Tombol>
          <TautanTombol href="/admin/anggota" varian="sekunder">
            Reset
          </TautanTombol>
        </div>
      </form>

      <p className="angka text-sm text-navy/80">{hasil.total} anggota</p>

      {hasil.data.length === 0 ? (
        <KosongState
          judul="Anggota tidak ditemukan"
          keterangan="Tidak ada anggota yang cocok dengan pencarian ini."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-line text-navy/70">
              <tr>
                <th className="px-4 py-3 font-medium">ID Anggota</th>
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Telepon</th>
                <th className="px-4 py-3 font-medium">Tanggal daftar</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {hasil.data.map((a) => (
                <tr key={a.kode} className="border-b border-line last:border-0">
                  <td className="angka px-4 py-3 font-medium">{a.kode}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <Avatar nama={a.nama} ukuran="kecil" />
                      <span>{a.nama}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">{a.email}</td>
                  <td className="angka px-4 py-3">{a.telepon}</td>
                  <td className="angka px-4 py-3">{formatTanggal(a.tanggal_daftar)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link
                      href={`/admin/anggota/${a.kode}`}
                      aria-label={`Lihat ${a.nama}`}
                      className={TAUTAN}
                    >
                      Lihat
                    </Link>
                    <span aria-hidden="true" className="px-2 text-navy/40">
                      ·
                    </span>
                    <Link
                      href={`/admin/anggota/${a.kode}/ubah`}
                      aria-label={`Ubah ${a.nama}`}
                      className={TAUTAN}
                    >
                      Ubah
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
        path="/admin/anggota"
        params={{ q: filter.q }}
      />
    </section>
  );
}

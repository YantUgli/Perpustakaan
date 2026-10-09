import type { Metadata } from "next";
import Link from "next/link";

import { fotoHeroBeranda } from "@/assets/foto";
import { Kartu } from "@/components/ui/Kartu";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";
import { LabelStatus } from "@/components/ui/LabelStatus";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { formatAngka, formatRupiah } from "@/lib/format";
import { urutkanEksemplar } from "@/lib/laporan-admin";

type Dashboard = components["schemas"]["DashboardKeluar"];

export const metadata: Metadata = { title: "Dashboard" };

const TAUTAN = "text-sm font-semibold text-gold-700 underline-offset-4 hover:underline";

// Tata letak isi kartu; bingkai kartu dari komponen `Kartu` bersama.
const ISI = "flex min-w-0 flex-col gap-2";

/** `null` = angka tidak dikirim API (bug kontrak, OQ-40): tampil "—", bukan 0. */
const Angka = ({ n }: { n: number | null }) => (
  <p className="angka font-display text-3xl">{n === null ? "—" : formatAngka(n)}</p>
);

/**
 * FR-LAP-01, OQ-40, IR-UI-02: ringkasan admin. Semua angka dari `GET /admin/dashboard`; klien tidak
 * menjumlahkan atau menurunkan angka apa pun. "Item dipinjam" sudah termasuk yang terlambat dan tidak
 * ditautkan (filter laporan `DIPINJAM` berarti belum lewat jatuh tempo, OQ-37). Tanpa grafik dan tanpa
 * "transaksi aktif" (FR-LAP-01 tidak memuatnya).
 */
export default async function DashboardAdmin() {
  const d = await ambilServer<Dashboard>("/admin/dashboard");

  return (
    <section className="flex flex-col gap-8">
      <KepalaHalamanArea
        judul="Dashboard"
        subjudul="Ringkasan koleksi, anggota, sirkulasi, dan tagihan."
        foto={fotoHeroBeranda}
      />

      <section aria-labelledby="h-koleksi" className="flex flex-col gap-4">
        <h2 id="h-koleksi" className="font-display text-xl">
          Koleksi dan anggota
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Kartu role="group" aria-label="Judul" className={ISI}>
            <p className="text-sm text-navy/70">Judul</p>
            <Angka n={d.jumlah_judul} />
            <Link href="/admin/judul" className={TAUTAN}>
              Kelola judul
            </Link>
          </Kartu>
          <Kartu role="group" aria-label="Anggota" className={ISI}>
            <p className="text-sm text-navy/70">Anggota</p>
            <Angka n={d.jumlah_anggota} />
            <Link href="/admin/anggota" className={TAUTAN}>
              Lihat anggota
            </Link>
          </Kartu>
        </div>
        <h3 className="text-sm font-medium text-navy/70">Eksemplar menurut status</h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {urutkanEksemplar(d.eksemplar_per_status).map(({ status, jumlah }) => (
            <Kartu
              key={status}
              role="group"
              aria-label={`Eksemplar ${status.charAt(0) + status.slice(1).toLowerCase()}`}
              className={ISI}
            >
              <LabelStatus status={status} className="self-start" />
              <Angka n={jumlah} />
            </Kartu>
          ))}
        </div>
      </section>

      <section aria-labelledby="h-sirkulasi" className="flex flex-col gap-4">
        <h2 id="h-sirkulasi" className="font-display text-xl">
          Sirkulasi
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Kartu role="group" aria-label="Item dipinjam" className={ISI}>
            <p className="text-sm text-navy/70">Item dipinjam</p>
            <Angka n={d.item_dipinjam} />
            <p className="text-xs text-navy/70">Termasuk yang terlambat.</p>
          </Kartu>
          <Kartu role="group" aria-label="Item terlambat" className={ISI}>
            <p className="text-sm text-navy/70">Item terlambat</p>
            <Angka n={d.item_terlambat} />
            <Link href="/admin/laporan/transaksi?status=TERLAMBAT" className={TAUTAN}>
              Lihat laporan
            </Link>
          </Kartu>
        </div>
      </section>

      <section aria-labelledby="h-tagihan" className="flex flex-col gap-4">
        <h2 id="h-tagihan" className="font-display text-xl">
          Tagihan
        </h2>
        <Kartu role="group" aria-label="Tagihan Belum Lunas" className={ISI}>
          <p className="text-sm text-navy/70">Tagihan Belum Lunas</p>
          <div className="flex flex-wrap gap-x-10 gap-y-2">
            <div>
              <p className="text-xs text-navy/70">Jumlah</p>
              <Angka n={d.tagihan_belum_lunas_jumlah} />
            </div>
            <div>
              <p className="text-xs text-navy/70">Total nominal</p>
              <p className="angka font-display text-3xl">
                {formatRupiah(d.tagihan_belum_lunas_total)}
              </p>
            </div>
          </div>
          <Link href="/admin/tagihan?status=BELUM_LUNAS" className={TAUTAN}>
            Lihat tagihan
          </Link>
        </Kartu>
      </section>
    </section>
  );
}

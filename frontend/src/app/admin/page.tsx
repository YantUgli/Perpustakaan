import type { Metadata } from "next";

import { fotoHeroBeranda } from "@/assets/foto";
import { KartuRingkas } from "@/components/ui/KartuRingkas";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";
import { ambilServer, ambilSesiServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { formatRupiah } from "@/lib/format";
import { GalatApi } from "@/lib/galat";
import { ringkasEksemplar } from "@/lib/laporan-admin";

import { DonutStatusEksemplar } from "./_komponen/DonutStatusEksemplar";
import { PanelItemTerlambat } from "./_komponen/PanelItemTerlambat";
import { PanelTagihanBelumLunas } from "./_komponen/PanelTagihanBelumLunas";

type Dashboard = components["schemas"]["DashboardKeluar"];
type Laporan = components["schemas"]["LaporanTransaksiKeluar"];
type HalamanTagihan = components["schemas"]["HalamanTagihan"];

export const metadata: Metadata = { title: "Dashboard" };

/** Jumlah baris cuplikan di dua panel daftar (keputusan Ayen 10/10/2026). */
const CUPLIKAN = 5;

/** Galat API satu daftar hanya ditampilkan di panelnya (IR-UI-04); galat lain diteruskan ke `error.tsx`. */
async function ambilDaftar<T>(path: string): Promise<{ data: T[]; galat: string | null }> {
  try {
    return { data: (await ambilServer<{ data: T[] }>(path)).data, galat: null };
  } catch (e) {
    if (e instanceof GalatApi) return { data: [], galat: e.pesan };
    throw e;
  }
}

/**
 * Dashboard admin (hal-31, spec `design/specs/dashboard-admin.md`, keputusan Ayen 10/10/2026). FR-LAP-01: tujuh
 * angka dari `GET /admin/dashboard`. Satu-satunya turunan klien adalah **total & persen eksemplar, hanya tampilan**
 * (`ringkasEksemplar`). "Dipinjam" termasuk yang terlambat dan tanpa tautan (filter `DIPINJAM` = belum lewat jatuh
 * tempo, OQ-37/40). Dua panel cuplikan dari endpoint yang ada; keterlambatan dan nominal tidak pernah digabung
 * (denda baru terbentuk saat kembali). Tanpa tren, grafik bulanan, aktivitas, atau ringkasan harian (∅API).
 */
export default async function DashboardAdmin() {
  const [sesi, d, terlambat, tagihan] = await Promise.all([
    ambilSesiServer(),
    ambilServer<Dashboard>("/admin/dashboard"),
    ambilDaftar<Laporan["data"][number]>(
      `/admin/laporan/transaksi?status=TERLAMBAT&halaman=1&per_halaman=${CUPLIKAN}`,
    ),
    ambilDaftar<HalamanTagihan["data"][number]>(
      `/admin/tagihan?status=BELUM_LUNAS&halaman=1&per_halaman=${CUPLIKAN}`,
    ),
  ]);
  const eksemplar = ringkasEksemplar(d.eksemplar_per_status);
  const sapaan = sesi ? `Selamat datang, ${sesi.nama}. ` : "";

  return (
    <section className="flex flex-col gap-6">
      <KepalaHalamanArea
        judul="Dashboard"
        subjudul={`${sapaan}Ringkasan koleksi, anggota, sirkulasi, dan tagihan perpustakaan.`}
        foto={fotoHeroBeranda}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KartuRingkas
          href="/admin/judul"
          label="Judul Buku"
          ikon="bukuIsi"
          nada="gold"
          nilai={d.jumlah_judul}
        />
        <KartuRingkas
          label="Eksemplar"
          ikon="rakIsi"
          nada="hijau"
          nilai={eksemplar.total}
          keterangan="Semua status, termasuk Hilang dan Rusak"
        />
        <KartuRingkas
          href="/admin/anggota"
          label="Anggota"
          ikon="grupOrangIsi"
          nada="gold"
          nilai={d.jumlah_anggota}
        />
        <KartuRingkas
          label="Dipinjam"
          ikon="bukuKeluarIsi"
          nada="biru"
          nilai={d.item_dipinjam}
          satuan="item"
          keterangan="Termasuk yang terlambat"
        />
        <KartuRingkas
          href="/admin/laporan/transaksi?status=TERLAMBAT"
          label="Terlambat"
          ikon="jamIsi"
          nada="oranye"
          nilai={d.item_terlambat}
          satuan="item"
        />
        <KartuRingkas
          href="/admin/tagihan?status=BELUM_LUNAS"
          label="Tagihan Belum Lunas"
          ikon="strukIsi"
          nada="merah"
          nilai={d.tagihan_belum_lunas_jumlah}
          satuan="tagihan"
          keterangan={`Total ${formatRupiah(d.tagihan_belum_lunas_total)}`}
        />
      </div>

      <DonutStatusEksemplar ringkasan={eksemplar} />

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <PanelItemTerlambat baris={terlambat.data} galat={terlambat.galat} />
        <PanelTagihanBelumLunas tagihan={tagihan.data} galat={tagihan.galat} />
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";
import { KosongState } from "@/components/ui/KosongState";
import { TautanTombol } from "@/components/ui/Tombol";
import { fotoHeroBeranda } from "@/assets/foto";
import { ambilServer, ambilSesiServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { pinjamanTerdekat, tagihanAktif, teksSisaHari } from "@/lib/area-anggota";
import { formatTanggal } from "@/lib/format";

import { BannerKelayakan } from "./_komponen/BannerKelayakan";
import { BarisPinjamanTerdekat } from "./_komponen/BarisPinjamanTerdekat";
import { KartuRingkas } from "./_komponen/KartuRingkas";
import { PanelDashboard } from "./_komponen/PanelDashboard";
import { PanelRiwayatTerbaru } from "./_komponen/PanelRiwayatTerbaru";
import { PanelTagihanAktif } from "./_komponen/PanelTagihanAktif";

type Kelayakan = components["schemas"]["KelayakanKeluar"];
type Pinjaman = components["schemas"]["PinjamanAktifKeluar"];
type HalamanRiwayat = components["schemas"]["HalamanRiwayat"];
type HalamanTagihan = components["schemas"]["HalamanTagihanAnggota"];

export const metadata: Metadata = { title: "Dashboard Anggota" };

/**
 * Dashboard anggota (hal-09, spec `design/specs/dashboard-anggota.md`): status kelayakan + alasannya (FR-AGT-05),
 * kartu ringkas pinjaman, jatuh tempo terdekat, tagihan aktif, dan riwayat (FR-AGT-02..04).
 * Kartu "Tagihan Aktif" ditampilkan sejak D1 (Ayen 08/10/2026, menggantikan keputusan P2): angkanya hanya tampilan;
 * banner kelayakan tetap dari `/anggota/kelayakan`. Panel (keputusan Ayen 09/10/2026): Pinjaman Terdekat Jatuh Tempo
 * (FR-AGT-02), Tagihan Aktif (FR-AGT-04, daftar dari permintaan yang sama dengan kartu), dan Riwayat Terbaru
 * (cuplikan FR-AGT-03, halaman 1 `per_halaman=3`; `total`-nya juga mengisi kartu Riwayat Peminjaman).
 */
export default async function DashboardAnggota() {
  const [sesi, kelayakan, pinjaman, riwayat, tagihan] = await Promise.all([
    ambilSesiServer(),
    ambilServer<Kelayakan>("/anggota/kelayakan"),
    ambilServer<Pinjaman[]>("/anggota/pinjaman"),
    ambilServer<HalamanRiwayat>("/anggota/riwayat?halaman=1&per_halaman=3"),
    tagihanAktif((path) => ambilServer<HalamanTagihan>(path)),
  ]);
  const terdekat = pinjamanTerdekat(pinjaman);
  // Backend mengurutkan pinjaman menurut jatuh tempo lalu id: yang pertama = terdekat.
  const pertama = pinjaman[0];

  return (
    <section className="flex flex-col gap-6">
      {/* Kepala halaman area (decisions §B, menggantikan D3): foto dekoratif kanan mulai lg. */}
      <KepalaHalamanArea
        judul={`Selamat Datang, ${sesi?.nama ?? ""}`}
        subjudul="Terima kasih telah menjadi bagian dari Perpustakaan Naratif. Teruslah membaca, belajar, dan menjelajahi lebih banyak pengetahuan setiap hari."
        foto={fotoHeroBeranda}
      />

      <BannerKelayakan kelayakan={kelayakan} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <KartuRingkas
          href="/anggota/pinjaman"
          label="Jumlah Pinjaman Aktif"
          ikon="bukuIsi"
          nada="biru"
          nilai={pinjaman.length}
          satuan="buku"
        />
        <KartuRingkas
          href="/anggota/pinjaman"
          label="Jatuh Tempo Terdekat"
          ikon="kalender"
          nada="gold"
          nilai={
            !pertama ? (
              <span className="font-display text-3xl leading-none">—</span>
            ) : pertama.terlambat || pertama.sisa_hari === 0 ? (
              <span
                className={`text-lg font-semibold ${pertama.terlambat ? "text-status-terlambat" : "text-navy"}`}
              >
                {teksSisaHari(pertama)}
              </span>
            ) : (
              pertama.sisa_hari
            )
          }
          satuan={pertama && !pertama.terlambat && pertama.sisa_hari > 0 ? "hari lagi" : undefined}
          keterangan={pertama ? formatTanggal(pertama.jatuh_tempo) : "Tidak ada pinjaman"}
        />
        <KartuRingkas
          href="/anggota/tagihan"
          label="Tagihan Aktif"
          ikon="strukIsi"
          nada="merah"
          nilai={tagihan.length}
          satuan="tagihan"
        />
        <KartuRingkas
          href="/anggota/riwayat"
          label="Riwayat Peminjaman"
          ikon="riwayat"
          nada="abu"
          nilai={riwayat.total}
          satuan="buku"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        <PanelDashboard
          id="judul-pinjaman-terdekat"
          judul="Pinjaman Terdekat Jatuh Tempo"
          subjudul="Buku yang sedang Anda pinjam, diurutkan dari jatuh tempo terdekat."
          lihatSemua={terdekat.length > 0 ? "/anggota/pinjaman" : undefined}
        >
          {terdekat.length === 0 ? (
            <KosongState
              judul="Belum ada pinjaman aktif"
              keterangan="Buku yang Anda pinjam akan tampil di sini beserta jatuh temponya."
              aksi={<TautanTombol href="/katalog">Lihat Katalog Buku</TautanTombol>}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {terdekat.map((p) => (
                <BarisPinjamanTerdekat key={p.kode_eksemplar} p={p} />
              ))}
            </ul>
          )}
        </PanelDashboard>

        <div className="flex min-w-0 flex-col gap-6">
          <PanelTagihanAktif tagihan={tagihan} />
          <PanelRiwayatTerbaru riwayat={riwayat.data} />
        </div>
      </div>
    </section>
  );
}

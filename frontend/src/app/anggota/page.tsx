import type { Metadata } from "next";
import Link from "next/link";

import { PanelHero } from "@/components/publik/PanelHero";
import { Ikon } from "@/components/ui/Ikon";
import { KosongState } from "@/components/ui/KosongState";
import { TautanTombol } from "@/components/ui/Tombol";
import { fotoHeroBeranda } from "@/assets/foto";
import { ambilServer, ambilSesiServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { hitungTagihanAktif, pinjamanTerdekat, teksSisaHari } from "@/lib/area-anggota";
import { formatTanggal } from "@/lib/format";

import { BannerKelayakan } from "./_komponen/BannerKelayakan";
import { KartuPinjaman } from "./_komponen/KartuPinjaman";
import { KartuRingkas } from "./_komponen/KartuRingkas";

type Kelayakan = components["schemas"]["KelayakanKeluar"];
type Pinjaman = components["schemas"]["PinjamanAktifKeluar"];
type HalamanRiwayat = components["schemas"]["HalamanRiwayat"];
type HalamanTagihan = components["schemas"]["HalamanTagihanAnggota"];

export const metadata: Metadata = { title: "Dashboard Anggota" };

/**
 * Dashboard anggota (hal-09, spec `design/specs/dashboard-anggota.md`): status kelayakan + alasannya (FR-AGT-05),
 * kartu ringkas pinjaman, jatuh tempo terdekat, tagihan aktif, dan riwayat (FR-AGT-02..04).
 * Kartu "Tagihan Aktif" ditampilkan sejak D1 (Ayen 08/10/2026, menggantikan keputusan P2): angkanya hanya tampilan;
 * banner kelayakan tetap dari `/anggota/kelayakan`.
 */
export default async function DashboardAnggota() {
  const [sesi, kelayakan, pinjaman, riwayat, tagihanAktif] = await Promise.all([
    ambilSesiServer(),
    ambilServer<Kelayakan>("/anggota/kelayakan"),
    ambilServer<Pinjaman[]>("/anggota/pinjaman"),
    ambilServer<HalamanRiwayat>("/anggota/riwayat?per_halaman=1"),
    hitungTagihanAktif((path) => ambilServer<HalamanTagihan>(path)),
  ]);
  const terdekat = pinjamanTerdekat(pinjaman);
  // Backend mengurutkan pinjaman menurut jatuh tempo lalu id: yang pertama = terdekat.
  const pertama = pinjaman[0];

  return (
    <section className="flex flex-col gap-6">
      {/* D3: foto dekoratif kanan mulai lg; kolom teks dibatasi 43% agar tidak menimpa foto (57%). */}
      {/* -mx-4 -mt-6 sm:-mx-8 mengimbangi padding <main> di layout.tsx (px-4 py-6 sm:px-8); ubah bersama. */}
      <header className="relative -mx-4 -mt-6 overflow-hidden px-4 pt-6 pb-2 sm:-mx-8 sm:px-8 lg:min-h-52 lg:pt-10">
        <PanelHero foto={fotoHeroBeranda} />
        <div className="relative flex flex-col gap-3 lg:max-w-[43%]">
          <h1 className="font-display text-4xl leading-tight break-words xl:text-5xl">
            Selamat Datang, {sesi?.nama}
          </h1>
          <p className="text-navy/80">
            Terima kasih telah menjadi bagian dari Perpustakaan Naratif. Teruslah membaca, belajar,
            dan menjelajahi lebih banyak pengetahuan setiap hari.
          </p>
        </div>
      </header>

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
          nilai={tagihanAktif}
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

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl">Pinjaman Terdekat Jatuh Tempo</h2>
          {terdekat.length > 0 && (
            <Link
              href="/anggota/pinjaman"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-gold-700"
            >
              Lihat Semua
              <Ikon nama="panah" className="size-4" />
            </Link>
          )}
        </div>
        {terdekat.length === 0 ? (
          <KosongState
            judul="Belum ada pinjaman aktif"
            keterangan="Buku yang Anda pinjam akan tampil di sini beserta jatuh temponya."
            aksi={<TautanTombol href="/katalog">Lihat Katalog Buku</TautanTombol>}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {terdekat.map((p) => (
              <KartuPinjaman key={p.kode_eksemplar} p={p} />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

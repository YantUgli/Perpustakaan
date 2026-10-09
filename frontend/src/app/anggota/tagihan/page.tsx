import type { Metadata } from "next";

import { fotoHeroBeranda } from "@/assets/foto";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";
import { KosongState } from "@/components/ui/KosongState";
import { Paginasi } from "@/components/ui/Paginasi";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { PER_HALAMAN_KLIEN, ambilSemuaHalaman, potongHalaman } from "@/lib/area-anggota";
import { formatRupiah } from "@/lib/format";
import { halamanDariParam } from "@/lib/halaman";

import { KartuRingkas } from "../_komponen/KartuRingkas";
import { KartuTagihan } from "../_komponen/KartuTagihan";
import { KotakInfo } from "../_komponen/KotakInfo";
import { TabelTagihan } from "../_komponen/TabelTagihan";

type HalamanTagihan = components["schemas"]["HalamanTagihanAnggota"];
type Tagihan = components["schemas"]["TagihanAnggotaKeluar"];

export const metadata: Metadata = { title: "Tagihan" };

/**
 * FR-AGT-04, OQ-36: jenis, nominal, status, cara penyelesaian (+ tanggal & buku sebagai konteks). Admin
 * pengonfirmasi & nominal dibayar tidak ditampilkan. Pembayaran hanya di perpustakaan (tanpa payment gateway).
 * Tata letak hal-14 (keputusan Ayen 09/10/2026, spec `design/specs/tagihan.md`): semua halaman diambil, lalu
 * kartu dan paginasi 20/halaman di klien — hanya tampilan, tidak dipakai untuk kelayakan. Rupiah hanya untuk
 * Belum Lunas (Lunas bisa lewat Buku Pengganti, bukan uang). Detail tagihan (hal-15) tidak dibuat.
 */
export default async function HalamanTagihan({
  searchParams,
}: {
  searchParams: Promise<{ halaman?: string | string[] }>;
}) {
  const halaman = halamanDariParam((await searchParams).halaman);
  const semua = await ambilSemuaHalaman<Tagihan>("/anggota/tagihan", (path) =>
    ambilServer<HalamanTagihan>(path),
  );
  const belumLunas = semua.filter((t) => t.status === "BELUM_LUNAS");
  const lunas = semua.filter((t) => t.status === "LUNAS").length;
  const nominalBelumLunas = belumLunas.reduce((jumlah, t) => jumlah + t.nominal, 0);
  const tampil = potongHalaman(semua, halaman);

  return (
    <section className="flex flex-col gap-6">
      <KepalaHalamanArea
        judul="Tagihan"
        subjudul="Ringkasan denda dan penggantian buku atas nama Anda."
        foto={fotoHeroBeranda}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KartuRingkas
          label="Total Tagihan"
          ikon="strukIsi"
          nada="biru"
          nilai={semua.length}
          satuan="tagihan"
        />
        <KartuRingkas
          label="Belum Lunas"
          ikon="jamIsi"
          nada="merah"
          nilai={
            <span className="font-display text-3xl leading-none tabular-nums lining-nums">
              {formatRupiah(nominalBelumLunas)}
            </span>
          }
          keterangan={`${belumLunas.length} tagihan`}
        />
        <KartuRingkas label="Lunas" ikon="centang" nada="abu" nilai={lunas} satuan="tagihan" />
      </div>

      <KotakInfo judul="Informasi Pembayaran Tagihan">
        Tagihan diselesaikan langsung di perpustakaan dengan konfirmasi petugas, secara tunai atau
        transfer sebesar nominal tagihan (tidak dapat dicicil). Tagihan penggantian juga dapat
        diselesaikan dengan menyerahkan buku pengganti. Tidak ada pembayaran online.
      </KotakInfo>

      {semua.length === 0 ? (
        <KosongState judul="Tidak ada tagihan" />
      ) : tampil.length === 0 ? (
        <KosongState judul="Tidak ada tagihan di halaman ini." />
      ) : (
        <section
          aria-labelledby="judul-daftar-tagihan"
          className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5"
        >
          <div className="flex flex-col gap-1">
            <h2 id="judul-daftar-tagihan" className="font-display text-2xl">
              Daftar Tagihan
            </h2>
            <p className="text-sm text-navy/70">
              Denda dan penggantian buku yang tercatat pada akun Anda, terbaru lebih dulu.
            </p>
          </div>
          <div className="hidden xl:block">
            <TabelTagihan tagihan={tampil} idJudul="judul-daftar-tagihan" />
          </div>
          <ul aria-labelledby="judul-daftar-tagihan" className="flex flex-col gap-3 xl:hidden">
            {tampil.map((t) => (
              <KartuTagihan key={t.id} t={t} />
            ))}
          </ul>
        </section>
      )}

      <Paginasi
        halaman={halaman}
        total={semua.length}
        perHalaman={PER_HALAMAN_KLIEN}
        path="/anggota/tagihan"
      />
    </section>
  );
}

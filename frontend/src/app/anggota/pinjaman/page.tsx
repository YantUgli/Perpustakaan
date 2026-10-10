import type { Metadata } from "next";

import { fotoHeroBeranda } from "@/assets/foto";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";
import { KosongState } from "@/components/ui/KosongState";
import { TautanTombol } from "@/components/ui/Tombol";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";

import { KartuJatuhTempoTerdekat } from "../_komponen/KartuJatuhTempoTerdekat";
import { KartuPinjaman } from "../_komponen/KartuPinjaman";
import { KartuRingkas } from "@/components/ui/KartuRingkas";
import { KotakInfo } from "../_komponen/KotakInfo";
import { TabelPinjaman } from "../_komponen/TabelPinjaman";

type Pinjaman = components["schemas"]["PinjamanAktifKeluar"];

export const metadata: Metadata = { title: "Pinjaman Saya" };

/**
 * FR-AGT-02: pinjaman aktif dengan jatuh tempo, sisa hari, penanda Terlambat (OQ-34). Tanpa perpanjangan
 * (FR-PJM-13). Tata letak hal-11 (keputusan Ayen 09/10/2026, spec `design/specs/pinjaman-saya.md`): tiga kartu
 * ringkas tanpa tautan, kotak info, tabel mulai `xl` dan `KartuPinjaman` di bawahnya. Hitungan "Terlambat" hanya
 * tampilan dari field `terlambat`; kelayakan tetap dari backend.
 */
export default async function HalamanPinjaman() {
  const pinjaman = await ambilServer<Pinjaman[]>("/anggota/pinjaman");
  const terlambat = pinjaman.filter((p) => p.terlambat).length;

  return (
    <section className="flex flex-col gap-6">
      <KepalaHalamanArea
        judul="Pinjaman Saya"
        subjudul="Buku yang sedang Anda pinjam. Pastikan dikembalikan tepat waktu."
        foto={fotoHeroBeranda}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KartuRingkas
          label="Total Pinjaman Aktif"
          ikon="bukuIsi"
          nada="biru"
          nilai={pinjaman.length}
          satuan="buku"
        />
        <KartuJatuhTempoTerdekat pertama={pinjaman[0]} />
        <KartuRingkas
          label="Terlambat"
          ikon="peringatanIsi"
          nada="merah"
          nilai={terlambat}
          satuan="buku"
        />
      </div>

      <KotakInfo judul="Perpanjangan pinjaman tidak tersedia">
        Buku dikembalikan langsung kepada petugas perpustakaan sebelum jatuh tempo.
      </KotakInfo>

      {pinjaman.length === 0 ? (
        <KosongState
          judul="Belum ada pinjaman aktif"
          aksi={<TautanTombol href="/katalog">Lihat Katalog Buku</TautanTombol>}
        />
      ) : (
        <section
          aria-labelledby="judul-daftar-pinjaman"
          className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5"
        >
          <h2 id="judul-daftar-pinjaman" className="font-display text-2xl">
            Daftar Buku Pinjaman Aktif
          </h2>
          <div className="hidden xl:block">
            <TabelPinjaman pinjaman={pinjaman} idJudul="judul-daftar-pinjaman" />
          </div>
          <ul aria-labelledby="judul-daftar-pinjaman" className="flex flex-col gap-3 xl:hidden">
            {pinjaman.map((p) => (
              <KartuPinjaman key={p.kode_eksemplar} p={p} />
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

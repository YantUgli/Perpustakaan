import type { Metadata } from "next";

import { Kartu } from "@/components/ui/Kartu";
import { KosongState } from "@/components/ui/KosongState";
import { Pesan } from "@/components/ui/Pesan";
import { TautanTombol } from "@/components/ui/Tombol";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";

import { KartuPinjaman } from "../_komponen/KartuPinjaman";

type Pinjaman = components["schemas"]["PinjamanAktifKeluar"];

export const metadata: Metadata = { title: "Pinjaman Saya" };

/** FR-AGT-02: pinjaman aktif dengan jatuh tempo, sisa hari, penanda Terlambat (OQ-34). Tanpa perpanjangan (FR-PJM-13). */
export default async function HalamanPinjaman() {
  const pinjaman = await ambilServer<Pinjaman[]>("/anggota/pinjaman");
  const terlambat = pinjaman.filter((p) => p.terlambat).length;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl sm:text-4xl">Pinjaman Saya</h1>
        <p className="text-navy/80">Buku yang sedang Anda pinjam.</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Kartu>
          <p className="text-sm text-navy/70">Pinjaman aktif</p>
          <p className="angka font-display text-3xl">{pinjaman.length}</p>
        </Kartu>
        <Kartu>
          <p className="text-sm text-navy/70">Terlambat</p>
          <p className="angka font-display text-3xl">{terlambat}</p>
        </Kartu>
      </div>

      <Pesan jenis="info" judul="Perpanjangan pinjaman tidak tersedia">
        Buku dikembalikan langsung kepada petugas perpustakaan sebelum jatuh tempo.
      </Pesan>

      {pinjaman.length === 0 ? (
        <KosongState
          judul="Belum ada pinjaman aktif"
          aksi={<TautanTombol href="/katalog">Lihat Katalog Buku</TautanTombol>}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {pinjaman.map((p) => (
            <KartuPinjaman key={p.kode_eksemplar} p={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

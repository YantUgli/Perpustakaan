import type { Metadata } from "next";
import Link from "next/link";

import { Kartu } from "@/components/ui/Kartu";
import { KosongState } from "@/components/ui/KosongState";
import { Pesan } from "@/components/ui/Pesan";
import { TautanTombol } from "@/components/ui/Tombol";
import { ambilServer, ambilSesiServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { judulAlasan, pinjamanTerdekat } from "@/lib/area-anggota";

import { KartuPinjaman } from "./_komponen/KartuPinjaman";

type Kelayakan = components["schemas"]["KelayakanKeluar"];
type Pinjaman = components["schemas"]["PinjamanAktifKeluar"];
type HalamanRiwayat = components["schemas"]["HalamanRiwayat"];

export const metadata: Metadata = { title: "Dashboard Anggota" };

/**
 * Dashboard anggota: status kelayakan meminjam + alasannya (FR-AGT-05), ringkasan pinjaman & riwayat.
 * Kartu "Tagihan Aktif" sengaja tidak ada (keputusan P2): tagihan Belum Lunas tercermin di alasan blokir.
 */
export default async function DashboardAnggota() {
  const [sesi, kelayakan, pinjaman, riwayat] = await Promise.all([
    ambilSesiServer(),
    ambilServer<Kelayakan>("/anggota/kelayakan"),
    ambilServer<Pinjaman[]>("/anggota/pinjaman"),
    ambilServer<HalamanRiwayat>("/anggota/riwayat?per_halaman=1"),
  ]);
  const terdekat = pinjamanTerdekat(pinjaman);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-3xl sm:text-4xl">Selamat datang, {sesi?.nama}</h1>

      {kelayakan.layak ? (
        <Pesan jenis="sukses" judul="Anda dapat meminjam buku">
          Tidak ada buku yang terlambat dan tidak ada tagihan yang belum lunas.
        </Pesan>
      ) : (
        <Pesan jenis="peringatan" judul="Anda belum dapat meminjam buku">
          <ul className="mt-2 flex flex-col gap-2">
            {kelayakan.alasan.map((a) => (
              <li key={a.kode}>
                <p className="font-semibold">{judulAlasan(a.kode)}</p>
                <p>{a.pesan}</p>
              </li>
            ))}
          </ul>
        </Pesan>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Kartu>
          <p className="text-sm text-navy/70">Pinjaman aktif</p>
          <p className="angka font-display text-3xl">{pinjaman.length}</p>
          <Link href="/anggota/pinjaman" className="text-sm font-semibold text-gold-700">
            Lihat pinjaman
          </Link>
        </Kartu>
        <Kartu>
          <p className="text-sm text-navy/70">Riwayat peminjaman</p>
          <p className="angka font-display text-3xl">{riwayat.total}</p>
          <Link href="/anggota/riwayat" className="text-sm font-semibold text-gold-700">
            Lihat riwayat
          </Link>
        </Kartu>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">Pinjaman terdekat jatuh tempo</h2>
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

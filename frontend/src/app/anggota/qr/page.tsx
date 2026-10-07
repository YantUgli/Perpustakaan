import type { Metadata } from "next";

import { Avatar } from "@/components/ui/Avatar";
import { Kartu } from "@/components/ui/Kartu";
import { KodeQr } from "@/components/ui/KodeQr";
import { Pesan } from "@/components/ui/Pesan";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";

type Qr = components["schemas"]["QrKeluar"];

export const metadata: Metadata = { title: "QR Anggota" };

/**
 * FR-AGT-01, BR-04: QR identifikasi (isi = ID anggota) beserta ID & nama, cukup besar untuk dipindai dari
 * layar ponsel. NIK tidak ditampilkan di sini (P3). Avatar inisial (OQ-42).
 */
export default async function HalamanQr() {
  const qr = await ambilServer<Qr>("/anggota/qr");
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl sm:text-4xl">QR Anggota</h1>
        <p className="text-navy/80">
          Tunjukkan QR ini kepada petugas perpustakaan saat meminjam buku.
        </p>
      </header>

      <Kartu className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 p-4 sm:p-6">
        <div className="rounded-lg bg-white p-2">
          <KodeQr isi={qr.isi_qr} ukuran={256} judul={`QR anggota ${qr.kode}`} />
        </div>
        <div className="flex items-center gap-3">
          <Avatar nama={qr.nama} />
          <div className="flex flex-col">
            <span className="font-display text-xl">{qr.nama}</span>
            <span className="text-sm text-navy/70">
              ID Anggota <span className="angka font-semibold text-navy">{qr.kode}</span>
            </span>
          </div>
        </div>
      </Kartu>

      <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
        <Pesan jenis="info" judul="Cara menggunakan">
          <ol className="list-decimal pl-5">
            <li>Buka halaman ini saat meminjam buku.</li>
            <li>Tunjukkan QR kepada petugas perpustakaan.</li>
            <li>Petugas memindai QR untuk memproses peminjaman.</li>
          </ol>
        </Pesan>
        <Pesan jenis="info">
          Bila QR tidak dapat dipindai, petugas dapat mencari data Anda secara manual dengan ID
          Anggota.
        </Pesan>
      </div>
    </section>
  );
}

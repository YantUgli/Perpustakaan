import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";

import { fotoHeroBeranda } from "@/assets/foto";
import { Ikon } from "@/components/ui/Ikon";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";

import { KotakInfo } from "../_komponen/KotakInfo";
import { InformasiAnggota } from "./InformasiAnggota";
import { KartuAnggotaDigital } from "./KartuAnggotaDigital";

type Qr = components["schemas"]["QrKeluar"];
type Profil = components["schemas"]["ProfilKeluar"];

export const metadata: Metadata = { title: "QR Anggota" };

const LANGKAH = [
  "Buka halaman ini saat meminjam buku.",
  "Tunjukkan QR kepada petugas perpustakaan.",
  "Petugas memindai QR untuk memproses peminjaman.",
];

/** Profil pelengkap (foto, tanggal daftar, Informasi Anggota): galat → `null`, kartu QR tetap tampil. */
async function ambilProfil(): Promise<Profil | null> {
  try {
    return await ambilServer<Profil>("/anggota/profil");
  } catch (e) {
    unstable_rethrow(e);
    console.error("Profil tidak dapat dibaca; halaman QR tampil tanpa data profil.", e);
    return null;
  }
}

/**
 * FR-AGT-01, BR-04: QR identifikasi (isi = ID anggota) beserta ID & nama, cukup besar untuk dipindai dari
 * layar ponsel; tata letak hal-10 (keputusan Ayen 09/10/2026, spec `design/specs/qr-anggota.md`). `/anggota/qr`
 * wajib (galat → `error.tsx`); `/anggota/profil` pelengkap, dipanggil paralel. NIK tidak ditampilkan (P3).
 * Foto hanya bila `ada_foto` (OQ-42), selain itu avatar inisial.
 */
export default async function HalamanQr() {
  const [qr, profil] = await Promise.all([ambilServer<Qr>("/anggota/qr"), ambilProfil()]);
  return (
    <section className="flex flex-col gap-6">
      <KepalaHalamanArea
        judul="QR Anggota"
        subjudul="Tunjukkan QR ini kepada petugas perpustakaan saat meminjam buku."
        foto={fotoHeroBeranda}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
        <KartuAnggotaDigital qr={qr} profil={profil} />

        <div className="flex min-w-0 flex-col gap-6">
          <KotakInfo>
            Bila QR tidak dapat dipindai, petugas dapat mencari data Anda secara manual dengan ID
            Anggota.
          </KotakInfo>

          <section
            aria-labelledby="judul-cara-qr"
            className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5"
          >
            <h2 id="judul-cara-qr" className="flex items-center gap-3 font-display text-xl">
              <Ikon nama="bukuIsi" className="size-6 shrink-0 text-gold-700" />
              Cara Menggunakan QR Anggota
            </h2>
            <ol className="flex flex-col gap-3 text-sm">
              {LANGKAH.map((teks, i) => (
                <li key={teks} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="angka flex size-7 shrink-0 items-center justify-center rounded-full bg-gold-700 text-xs font-semibold text-white"
                  >
                    {i + 1}
                  </span>
                  {teks}
                </li>
              ))}
            </ol>
          </section>

          {profil && <InformasiAnggota profil={profil} />}
        </div>
      </div>
    </section>
  );
}

import Image from "next/image";

import { fotoHeroBeranda } from "@/assets/foto";
import { Ikon, type NamaIkon } from "@/components/ui/Ikon";
import { KETENTUAN_PINJAM } from "@/lib/info-perpustakaan";
import { GUTTER_LG_LAYAR } from "@/lib/tata-letak";

/**
 * Manfaat keanggotaan hal-08, disesuaikan dengan SRS (keputusan Ayen 09/10/2026, spec daftar #16–19):
 * "Akses Koleksi Lengkap" → buku fisik (BR-08, BR-11; "digital" di luar lingkup), "Ikut Kegiatan Literasi" → QR
 * anggota (BR-04, FR-AGT-01), "Rekomendasi Personal" → area anggota (FR-AGT-02..04); "Komunitas" dibuang.
 */
const MANFAAT: { ikon: NamaIkon; judul: string; teks: string }[] = [
  {
    ikon: "bukuIsi",
    judul: "Pinjam Buku Fisik",
    teks: KETENTUAN_PINJAM.charAt(0).toUpperCase() + KETENTUAN_PINJAM.slice(1),
  },
  {
    ikon: "qrIsi",
    judul: "Pinjam dengan QR Anggota",
    teks: "Tunjukkan QR anggota dari ponsel Anda, tanpa kartu anggota fisik.",
  },
  {
    ikon: "strukIsi",
    judul: "Pantau Pinjaman & Tagihan",
    teks: "Lihat jatuh tempo, riwayat peminjaman, dan tagihan Anda di area anggota.",
  },
];

/**
 * Lebar foto yang menyelip di belakang tepi kanan kartu form (hal-08). Terikat dua nilai lain:
 * - `GAP_GRID` = `lg:gap-10` grid di `page.tsx` (foto melewati celah grid lebih dulu);
 * - kepala halaman `lg:pr-28` di `page.tsx` = SELIPAN + 1rem, agar teks kepala selalu di kiri foto & area pudarnya.
 * Ubah salah satu → ubah ketiganya.
 */
const SELIPAN = "6rem";
const GAP_GRID = "2.5rem";

/**
 * Kolom kanan `/daftar` mulai `lg` (di bawahnya `display:none`; foto lazy tidak diunduh): foto di pojok kanan atas,
 * di belakang kartu form, lalu manfaat. Foto dipakai ulang dari beranda, tanpa teks di atasnya (decisions §B
 * "Foto dekoratif publik").
 */
export function ManfaatAnggota() {
  return (
    <aside data-kolom-manfaat className="hidden flex-col gap-8 lg:flex">
      {/*
       * -mt-12 = `lg:py-12` section (menempel header). Kanan: minus gutter KONTAINER (menempel tepi layar; kelebihan
       * 100vw dipotong `overflow-x-clip` section). Kiri: minus (GAP_GRID + SELIPAN), menyelip di belakang kartu yang
       * `relative z-10`. Mask: tepi kiri memudar ke ivory hanya selebar SELIPAN, sehingga area pudar tertutup kartu.
       * Margin inline aman: kolom ini `display:none` di bawah `lg`.
       */}
      <div
        aria-hidden="true"
        data-foto-daftar
        className="relative aspect-4/3 overflow-hidden rounded-bl-3xl mask-l-from-[calc(100%-6rem)] mask-l-to-100% lg:-mt-12"
        style={{
          marginRight: `calc(-1 * ${GUTTER_LG_LAYAR})`,
          marginLeft: `calc(-1 * (${GAP_GRID} + ${SELIPAN}))`,
        }}
      >
        <Image
          src={fotoHeroBeranda}
          alt=""
          fill
          sizes="(min-width: 1024px) 45vw, 1px"
          className="object-cover"
        />
      </div>
      <div>
        <h2 id="judul-manfaat" className="sr-only">
          Keuntungan menjadi anggota
        </h2>
        <ul aria-labelledby="judul-manfaat" className="flex flex-col gap-6">
          {MANFAAT.map((m) => (
            <li key={m.judul} className="flex items-start gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-700">
                <Ikon nama={m.ikon} className="size-7" />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="font-display text-xl font-semibold text-navy">{m.judul}</h3>
                <p className="text-navy/80">{m.teks}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

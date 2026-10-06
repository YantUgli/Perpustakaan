import Link from "next/link";

import { FormCari } from "@/components/katalog/FormCari";
import { ikonKategori } from "@/components/katalog/ikon-kategori";
import { KartuBukuRingkas } from "@/components/katalog/KartuBukuRingkas";
import { Ikon, type NamaIkon } from "@/components/ui/Ikon";
import { KosongState } from "@/components/ui/KosongState";
import { IkonLogo } from "@/components/ui/Logo";
import { TautanTombol } from "@/components/ui/Tombol";
import { ambilServer } from "@/lib/api-server";
import { bagianTentang } from "@/lib/info-perpustakaan";
import { type HalamanKatalog, type Kategori, tautanKategori } from "@/lib/katalog";
import { KONTAINER } from "@/lib/tata-letak";

/** Jumlah judul cuplikan di beranda: halaman 1 katalog (urut A–Z dari API), bukan "terbaru"/"rekomendasi". */
const CUPLIKAN = 6;
// 6 kolom (hal-02) mulai 112rem (1792 px; rem agar urut setelah `lg`): di bawahnya ruang di samping sampul
// < ±150 px dan badge ringkas "10 dari 12 tersedia" akan terlipat.

/** Keunggulan di samping ringkasan Tentang (D5): diturunkan dari "Fasilitas & Layanan" halaman Tentang. */
const KEUNGGULAN: { ikon: NamaIkon; teks: string }[] = [
  { ikon: "bukuIsi", teks: "Katalog Daring Tanpa Login" },
  { ikon: "qrIsi", teks: "Pinjam dengan QR Anggota" },
  { ikon: "kursiIsi", teks: "Ruang Baca di Tempat" },
];

const kelasTautanTeks =
  "inline-flex items-center gap-1.5 text-sm font-semibold text-gold-700 underline-offset-4 hover:underline";

/**
 * FR-KTL-05, BR-01, IR-UI-05: beranda tanpa login, tata letak hal-02. Hero dua kolom (judul "Temukan Buku,
 * Jelajahi Pengetahuan" + subjudul fungsional + kolom cari; panel kanan dekoratif CSS, tanpa foto). Kategori dari
 * `GET /katalog/kategori` (OQ-43; judul "Kategori Populer" hanya label, isi tetap semua kategori A–Z; ikon dari
 * kata kunci nama, cadangan ikon buku), cuplikan koleksi dari `GET /katalog/judul` dengan kartu
 * ringkas. Ringkasan Tentang memakai paragraf Profil dari `lib/info-perpustakaan`; CTA daftar berdasar BR-03.
 */
export default async function Beranda() {
  const [kategori, koleksi] = await Promise.all([
    ambilServer<Kategori[]>("/katalog/kategori"),
    ambilServer<HalamanKatalog>(`/katalog/judul?halaman=1&per_halaman=${CUPLIKAN}`),
  ]);
  const profil = bagianTentang("Profil")?.paragraf?.[0];

  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div className={`${KONTAINER} py-12 sm:py-16 lg:py-20`}>
          <div className="relative z-10 flex flex-col gap-5 lg:w-1/2 lg:pr-12">
            <h1 className="font-display text-4xl leading-tight sm:text-5xl 2xl:text-6xl">
              Temukan Buku, <span className="block">Jelajahi Pengetahuan</span>
            </h1>
            <p className="text-navy/80 sm:text-lg">
              Cari buku di katalog perpustakaan berdasarkan judul, penulis, ISBN, atau kategori.
            </p>
            <FormCari />
            <Link href="/katalog" className={`${kelasTautanTeks} self-start`}>
              Atau jelajahi katalog lengkap
              <Ikon nama="panah" className="size-4" />
            </Link>
          </div>
        </div>
        <PanelHero />
      </section>

      <section
        aria-labelledby="judul-kategori"
        className={`${KONTAINER} grid gap-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:items-start`}
      >
        <div className="flex flex-col gap-1 lg:pt-4">
          <h2 id="judul-kategori" className="font-display text-2xl sm:text-3xl lg:text-4xl">
            Kategori Populer
          </h2>
          <p className="text-sm text-navy/80">Jelajahi koleksi berdasarkan kategori.</p>
        </div>
        {kategori.length === 0 ? (
          <KosongState judul="Belum ada kategori" />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
            {kategori.map((k) => (
              <li key={k.id}>
                <Link
                  href={tautanKategori(k.nama)}
                  className="group flex h-full items-center gap-3 rounded-xl border border-line bg-surface p-4 hover:border-gold"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <Ikon nama={ikonKategori(k.nama)} className="size-11 text-gold" />
                    <span className="text-base font-medium wrap-break-word">{k.nama}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-700 group-hover:bg-gold/25"
                  >
                    <Ikon nama="panah" className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="judul-koleksi" className={`${KONTAINER} pb-12`}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="judul-koleksi" className="font-display text-2xl sm:text-3xl lg:text-4xl">
              Koleksi Buku
            </h2>
            <p className="text-sm text-navy/80">
              Sebagian koleksi buku fisik perpustakaan. Lihat katalog untuk semua judul.
            </p>
          </div>
          <Link href="/katalog" className={kelasTautanTeks}>
            Lihat semua buku
            <Ikon nama="panah" className="size-4" />
          </Link>
        </div>
        {koleksi.data.length === 0 ? (
          <KosongState judul="Belum ada buku di katalog" />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 min-[112rem]:grid-cols-6">
            {koleksi.data.map((j) => (
              <li key={j.id}>
                <KartuBukuRingkas judul={j} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div
        className={`${KONTAINER} grid gap-8 pb-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)] lg:items-center`}
      >
        <section aria-labelledby="judul-tentang" className="flex flex-col gap-3">
          <h2 id="judul-tentang" className="font-display text-2xl sm:text-3xl lg:text-4xl">
            Tentang Perpustakaan Naratif
          </h2>
          {profil && <p className="text-sm leading-relaxed text-navy/80">{profil}</p>}
          <TautanTombol href="/tentang" className="self-start">
            Pelajari Lebih Lanjut
            <Ikon nama="panah" className="size-4" />
          </TautanTombol>
        </section>

        <ul className="grid grid-cols-3 gap-4 border-line text-center lg:border-l lg:pl-8">
          {KEUNGGULAN.map((k) => (
            <li key={k.teks} className="flex flex-col items-center gap-2">
              <Ikon nama={k.ikon} className="size-11 text-gold" />
              <span className="text-sm leading-snug">{k.teks}</span>
            </li>
          ))}
        </ul>

        <section
          aria-labelledby="judul-cta"
          className="relative overflow-hidden rounded-2xl bg-navy p-6 text-ivory sm:p-8"
        >
          <span aria-hidden="true" className="absolute -right-10 -bottom-8 text-ivory opacity-10">
            <IkonLogo className="h-40" />
          </span>
          <div className="relative flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">
              Jadi Bagian dari Naratif
            </p>
            <h2 id="judul-cta" className="font-display text-2xl sm:text-3xl lg:text-4xl">
              Daftar Sekarang, Mulai Perjalanan Membaca Anda
            </h2>
            <p className="text-sm text-ivory/85">
              Daftar secara online dan akun anggota langsung aktif, lalu pinjam buku fisik di
              perpustakaan.
            </p>
            <TautanTombol href="/daftar" className="mt-2 self-start">
              Daftar Anggota
              <Ikon nama="panah" className="size-4" />
            </TautanTombol>
          </div>
        </section>
      </div>
    </>
  );
}

/**
 * Panel kanan hero (D1a diperhalus: dekoratif CSS, tanpa foto). Bidang ±57% lebar layar di belakang ujung kolom
 * cari: gradasi dari ivory (sama dengan latar hero) makin pekat ke kanan + pendaran lembut, tepi kirinya dipudarkan
 * dengan mask sehingga gradasi, watermark, dan tagline menyatu tanpa garis pemisah. Hanya `lg` ke atas.
 */
function PanelHero() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-y-0 right-0 hidden w-[57%] bg-linear-to-r from-ivory via-line/30 to-line/60 mask-l-from-65% mask-l-to-100% lg:block"
    >
      <div className="absolute inset-0 bg-radial-[at_70%_35%] from-surface/70 to-transparent to-60%" />
      <div className="absolute inset-0 bg-radial-[at_90%_85%] from-gold/15 to-transparent to-55%" />
      <IkonLogo className="absolute right-12 bottom-10 h-56 text-navy opacity-[0.06]" />
      <div className="absolute top-1/2 right-[10%] flex -translate-y-1/2 flex-col gap-4">
        <p className="font-display text-4xl leading-snug text-navy italic 2xl:text-5xl">
          Lebih Banyak Cerita,
          <span className="block">Lebih Luas Dunia.</span>
        </p>
        <span className="block h-0.5 w-16 bg-gold" />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar } from "@/components/ui/Avatar";
import { Ikon } from "@/components/ui/Ikon";
import { Logo } from "@/components/ui/Logo";
import { TautanTombol } from "@/components/ui/Tombol";
import { type Sesi, berandaRole } from "@/lib/sesi";
import { KONTAINER } from "@/lib/tata-letak";

import { TombolKeluar } from "./TombolKeluar";

const MENU = [
  { href: "/", label: "Beranda" },
  { href: "/katalog", label: "Katalog Buku" },
  { href: "/tentang", label: "Tentang Perpustakaan" },
];

/** Mulai `lg` tombol header ikut skala menu: teks 16 px, tinggi & padding proporsional. */
const TOMBOL_LG = "lg:min-h-12 lg:px-7 lg:text-base";

function aktif(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Header situs publik (Brief §9.1, hal-02..06). Mulai `lg`: tiga zona (logo | menu di tengah | aksi); di bawahnya
 * menu turun ke baris kedua. `sesi` null = pengunjung umum; nama pengguna panjang dipotong (`title` = nama utuh).
 */
export function HeaderPublik({ sesi }: { sesi: Sesi | null }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-ivory">
      <div
        className={`${KONTAINER} flex flex-wrap items-center gap-x-8 gap-y-3 py-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:py-4`}
      >
        <Link href="/" aria-label="Naratif Perpustakaan, Beranda" className="justify-self-start">
          <Logo ukuran="responsif" />
        </Link>
        <nav aria-label="Menu utama" className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex gap-5 overflow-x-auto text-sm lg:gap-10 lg:text-base">
            {MENU.map((m) => (
              <li key={m.href}>
                <Link
                  href={m.href}
                  aria-current={aktif(pathname, m.href) ? "page" : undefined}
                  className="inline-block border-b-2 border-transparent py-1.5 whitespace-nowrap hover:border-line aria-[current=page]:border-gold aria-[current=page]:font-semibold"
                >
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex min-w-0 items-center justify-end gap-3 lg:ml-0">
          <Link href="/katalog" aria-label="Cari buku di katalog" className="p-2 text-navy">
            <Ikon nama="cari" className="size-5" />
          </Link>
          {sesi ? (
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href={berandaRole(sesi.role)}
                title={sesi.nama}
                className="flex min-w-0 items-center gap-2 text-sm font-medium"
              >
                <Avatar nama={sesi.nama} ukuran="kecil" />
                <span className="hidden max-w-40 truncate sm:inline xl:max-w-56">{sesi.nama}</span>
              </Link>
              <TombolKeluar />
            </div>
          ) : (
            <>
              <TautanTombol href="/masuk" varian="sekunder" className={TOMBOL_LG}>
                Masuk
              </TautanTombol>
              <TautanTombol href="/daftar" className={TOMBOL_LG}>
                Daftar
              </TautanTombol>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

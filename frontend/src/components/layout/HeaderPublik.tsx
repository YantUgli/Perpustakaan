"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { TautanTombol } from "@/components/ui/Tombol";
import { type Sesi, berandaRole } from "@/lib/sesi";

import { TombolKeluar } from "./TombolKeluar";

const MENU = [
  { href: "/", label: "Beranda" },
  { href: "/katalog", label: "Katalog Buku" },
  { href: "/tentang", label: "Tentang Perpustakaan" },
];

function aktif(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Header situs publik (Brief §9.1). `sesi` null = pengunjung umum. */
export function HeaderPublik({ sesi }: { sesi: Sesi | null }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-ivory">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Naratif — Beranda">
          <Logo />
        </Link>
        <nav aria-label="Menu utama" className="order-3 w-full sm:order-none sm:w-auto">
          <ul className="flex gap-5 overflow-x-auto text-sm">
            {MENU.map((m) => (
              <li key={m.href}>
                <Link
                  href={m.href}
                  aria-current={aktif(pathname, m.href) ? "page" : undefined}
                  className="inline-block border-b-2 border-transparent py-1 whitespace-nowrap aria-[current=page]:border-gold aria-[current=page]:font-semibold"
                >
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/katalog" aria-label="Cari buku di katalog" className="p-2 text-navy">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </Link>
          {sesi ? (
            <div className="flex items-center gap-3">
              <Link
                href={berandaRole(sesi.role)}
                className="flex items-center gap-2 text-sm font-medium"
              >
                <Avatar nama={sesi.nama} ukuran="kecil" />
                <span className="hidden sm:inline">{sesi.nama}</span>
              </Link>
              <TombolKeluar />
            </div>
          ) : (
            <>
              <TautanTombol href="/masuk" varian="sekunder">
                Masuk
              </TautanTombol>
              <TautanTombol href="/daftar">Daftar</TautanTombol>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

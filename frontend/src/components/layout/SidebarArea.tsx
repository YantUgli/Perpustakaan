"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Ikon } from "@/components/ui/Ikon";
import { Logo } from "@/components/ui/Logo";

import { MENU_ADMIN, MENU_ANGGOTA, itemAktif } from "./menu";
import { TombolKeluar } from "./TombolKeluar";

type Props = {
  nama: string;
  /** Admin: navy + aksen gold (K8). Anggota: ivory + aksen gold (hal-09..17). Menu aktif: gold-700 + putih (D2). */
  varian: "admin" | "anggota";
};

// Sama dengan header publik: logo membawa pengguna yang sudah login kembali ke beranda (D4, 08/10/2026).
const LABEL_LOGO = "Naratif Perpustakaan, Beranda";

/**
 * Navigasi area terautentikasi. ≥ lg: sidebar tetap. < lg: bilah atas + laci menu, agar halaman sirkulasi
 * admin tetap dapat dipakai satu tangan di lebar 360 px (IR-UI-01). Ikon menu dekoratif: garis saat tidak aktif,
 * solid saat aktif; penanda aktif bagi pembaca layar tetap `aria-current="page"`.
 */
export function SidebarArea({ nama, varian }: Props) {
  const pathname = usePathname();
  const menu = varian === "admin" ? MENU_ADMIN : MENU_ANGGOTA;
  const judul = varian === "admin" ? "Menu Admin" : "Menu Anggota";
  const [laciTerbuka, setLaciTerbuka] = useState(false);
  const gelap = varian === "admin";
  const warna = gelap ? "bg-navy text-ivory" : "bg-ivory text-navy border-r border-line";
  // D2 (08/10/2026): aktif = latar gold-700 + teks putih (5,51, AA); gold + putih hanya ±3:1.
  const kelasItem = `${gelap ? "text-ivory/90 hover:bg-ivory/10" : "text-navy hover:bg-navy/5"} aria-[current=page]:bg-gold-700 aria-[current=page]:text-white`;

  const isi = (
    <div className="flex h-full flex-col gap-6 p-5">
      <Link href="/" aria-label={LABEL_LOGO} className="hidden self-start lg:block">
        <span aria-hidden="true">
          <Logo latar={gelap ? "gelap" : "terang"} />
        </span>
      </Link>
      <nav aria-label={judul} className="flex-1">
        <p
          className={`mb-2 text-xs font-semibold tracking-wide uppercase ${gelap ? "text-gold" : "text-gold-700"}`}
        >
          {judul}
        </p>
        <ul className="flex flex-col gap-1">
          {menu.map((item) => {
            const aktif = itemAktif(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setLaciTerbuka(false)}
                  aria-current={aktif ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${kelasItem}`}
                >
                  <Ikon nama={aktif ? `${item.ikon}Isi` : item.ikon} className="size-5 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div
        className={`flex items-center gap-3 border-t pt-4 ${gelap ? "border-ivory/20" : "border-line"}`}
      >
        <Avatar nama={nama} ukuran="kecil" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{nama}</span>
          <TombolKeluar className={gelap ? "text-gold" : "text-gold-700"} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Bilah atas untuk layar < lg */}
      <div
        className={`sticky top-0 z-30 flex items-center justify-between px-4 py-3 lg:hidden ${warna}`}
      >
        <Link href="/" aria-label={LABEL_LOGO}>
          <span aria-hidden="true">
            <Logo latar={gelap ? "gelap" : "terang"} />
          </span>
        </Link>
        <button
          type="button"
          aria-expanded={laciTerbuka}
          aria-controls="laci-menu"
          onClick={() => setLaciTerbuka((b) => !b)}
          className="min-h-11 min-w-11 rounded-lg px-3 text-sm font-medium"
        >
          {laciTerbuka ? "Tutup" : "Menu"}
        </button>
      </div>
      <aside
        id="laci-menu"
        className={`${laciTerbuka ? "block" : "hidden"} fixed inset-x-0 top-[3.75rem] bottom-0 z-20 overflow-y-auto lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 ${warna}`}
      >
        {isi}
      </aside>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TAB = [
  { href: "/admin/laporan/transaksi", label: "Transaksi" },
  { href: "/admin/laporan/tagihan", label: "Denda & Penggantian" },
];

/** Tab jenis laporan; yang aktif ditandai `aria-current="page"` (tidak hanya lewat warna). */
export function TabLaporan() {
  const pathname = usePathname();
  return (
    <nav aria-label="Jenis laporan" className="flex gap-2 border-b border-line">
      {TAB.map((t) => {
        const aktif = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={aktif ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold ${
              aktif ? "border-gold text-navy" : "border-transparent text-navy/70 hover:text-navy"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

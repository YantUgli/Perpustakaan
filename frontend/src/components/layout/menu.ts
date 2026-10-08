/** Menu area terautentikasi (Brief §9.1). Modul biasa (bukan "use client") agar bisa dipakai server & klien. */

import type { IkonBerpasangan } from "@/components/ui/Ikon";

export type ItemMenu = {
  href: string;
  label: string;
  /** Awalan path yang dianggap aktif; bawaan = `href`. Halaman beranda area hanya aktif bila persis. */
  awalan?: string;
  persis?: boolean;
  /** Ikon garis saat tidak aktif; varian `<ikon>Isi` (solid) saat aktif (susulan 5.4.1, 08/10/2026). */
  ikon: IkonBerpasangan;
};

export const MENU_ANGGOTA: ItemMenu[] = [
  { href: "/anggota", label: "Dashboard", persis: true, ikon: "beranda" },
  { href: "/anggota/qr", label: "QR Anggota", ikon: "qr" },
  { href: "/anggota/pinjaman", label: "Pinjaman Saya", ikon: "buku" },
  { href: "/anggota/riwayat", label: "Riwayat", ikon: "jam" },
  { href: "/anggota/tagihan", label: "Tagihan", ikon: "struk" },
  { href: "/anggota/profil", label: "Profil", ikon: "orang" },
];

// Brief §9.1 "Menu Admin"; eksemplar dikelola dari halaman judul (tidak ada daftar eksemplar lintas judul).
export const MENU_ADMIN: ItemMenu[] = [
  { href: "/admin", label: "Dashboard", persis: true, ikon: "beranda" },
  { href: "/admin/judul", label: "Data Buku & Eksemplar", awalan: "/admin/judul", ikon: "buku" },
  { href: "/admin/anggota", label: "Data Anggota", ikon: "grupOrang" },
  { href: "/admin/kategori", label: "Kategori", ikon: "label" },
  { href: "/admin/rak", label: "Rak", ikon: "rak" },
  { href: "/admin/peminjaman", label: "Peminjaman", ikon: "bukuKeluar" },
  { href: "/admin/pengembalian", label: "Pengembalian", ikon: "bukuMasuk" },
  { href: "/admin/hilang-rusak", label: "Hilang / Rusak", ikon: "peringatan" },
  { href: "/admin/tagihan", label: "Tagihan", ikon: "struk" },
  { href: "/admin/laporan/transaksi", label: "Laporan", awalan: "/admin/laporan", ikon: "grafik" },
];

export function itemAktif(pathname: string, item: ItemMenu): boolean {
  if (item.persis) return pathname === item.href;
  const awalan = item.awalan ?? item.href;
  return pathname === awalan || pathname.startsWith(`${awalan}/`);
}

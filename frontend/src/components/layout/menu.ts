/** Menu area terautentikasi (Brief §9.1). Modul biasa (bukan "use client") agar bisa dipakai server & klien. */

export type ItemMenu = {
  href: string;
  label: string;
  /** Awalan path yang dianggap aktif; bawaan = `href`. Halaman beranda area hanya aktif bila persis. */
  awalan?: string;
  persis?: boolean;
};

export const MENU_ANGGOTA: ItemMenu[] = [
  { href: "/anggota", label: "Dashboard", persis: true },
  { href: "/anggota/qr", label: "QR Anggota" },
  { href: "/anggota/pinjaman", label: "Pinjaman Saya" },
  { href: "/anggota/riwayat", label: "Riwayat" },
  { href: "/anggota/tagihan", label: "Tagihan" },
  { href: "/anggota/profil", label: "Profil" },
  { href: "/anggota/password", label: "Ubah Password" },
];

// Brief §9.1 "Menu Admin"; eksemplar dikelola dari halaman judul (tidak ada daftar eksemplar lintas judul).
export const MENU_ADMIN: ItemMenu[] = [
  { href: "/admin", label: "Dashboard", persis: true },
  { href: "/admin/judul", label: "Data Buku & Eksemplar", awalan: "/admin/judul" },
  { href: "/admin/anggota", label: "Data Anggota" },
  { href: "/admin/kategori", label: "Kategori" },
  { href: "/admin/rak", label: "Rak" },
  { href: "/admin/peminjaman", label: "Peminjaman" },
  { href: "/admin/pengembalian", label: "Pengembalian" },
  { href: "/admin/hilang-rusak", label: "Hilang / Rusak" },
  { href: "/admin/tagihan", label: "Tagihan" },
  { href: "/admin/laporan/transaksi", label: "Laporan", awalan: "/admin/laporan" },
];

export function itemAktif(pathname: string, item: ItemMenu): boolean {
  if (item.persis) return pathname === item.href;
  const awalan = item.awalan ?? item.href;
  return pathname === awalan || pathname.startsWith(`${awalan}/`);
}

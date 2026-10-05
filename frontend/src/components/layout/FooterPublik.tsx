import Link from "next/link";

import { Logo } from "@/components/ui/Logo";

/** Footer minimal (P6): logo, tagline, tautan cepat, ©. Data kontak menunggu pemilik perpustakaan. */
export function FooterPublik() {
  return (
    <footer className="mt-auto bg-navy text-ivory">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-1">
          <Logo latar="gelap" />
          <p className="text-sm text-ivory/80">Lebih Banyak Cerita, Lebih Luas Dunia.</p>
        </div>
        <nav aria-label="Tautan cepat">
          <ul className="flex flex-wrap gap-5 text-sm">
            <li>
              <Link href="/" className="hover:text-gold">
                Beranda
              </Link>
            </li>
            <li>
              <Link href="/katalog" className="hover:text-gold">
                Katalog Buku
              </Link>
            </li>
            <li>
              <Link href="/tentang" className="hover:text-gold">
                Tentang Perpustakaan
              </Link>
            </li>
          </ul>
        </nav>
        <p className="text-xs text-ivory/70">© {new Date().getFullYear()} Naratif.</p>
      </div>
    </footer>
  );
}

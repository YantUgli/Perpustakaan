import Link from "next/link";

import { Logo } from "@/components/ui/Logo";
import { bagianTentang } from "@/lib/info-perpustakaan";
import { KONTAINER } from "@/lib/tata-letak";

const TAUTAN = [
  { href: "/", label: "Beranda" },
  { href: "/katalog", label: "Katalog Buku" },
  { href: "/tentang", label: "Tentang Perpustakaan" },
];

/**
 * Footer publik (hal-02): logo + tagline | Tautan Cepat | Kontak | ©. Alamat & kontak dari sumber yang sama
 * dengan halaman Tentang (`lib/info-perpustakaan`), tidak ditulis ulang. Tanpa "Bantuan" dan media sosial:
 * halamannya tidak ada dan SRS tidak memuatnya.
 */
export function FooterPublik() {
  const alamat = bagianTentang("Alamat")?.paragraf ?? [];
  const kontak = bagianTentang("Kontak")?.daftar ?? [];
  return (
    <footer className="mt-auto bg-navy text-ivory">
      <div
        className={`${KONTAINER} grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.6fr_auto]`}
      >
        <div className="flex flex-col gap-2">
          <Logo latar="gelap" className="self-start" />
          <p className="text-sm text-ivory/80">Lebih Banyak Cerita, Lebih Luas Dunia.</p>
        </div>
        <nav aria-labelledby="footer-tautan" className="flex flex-col gap-3">
          <h2 id="footer-tautan" className="text-sm font-semibold">
            Tautan Cepat
          </h2>
          <ul className="flex flex-col gap-2 text-sm text-ivory/85">
            {TAUTAN.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="hover:text-gold">
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <section aria-labelledby="footer-kontak" className="flex flex-col gap-3">
          <h2 id="footer-kontak" className="text-sm font-semibold">
            Kontak
          </h2>
          <address className="flex flex-col gap-2 text-sm text-ivory/85 not-italic">
            {alamat.map((t) => (
              <p key={t}>{t}</p>
            ))}
            {kontak.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </address>
        </section>
        <p className="text-xs text-ivory/70 lg:self-end">© {new Date().getFullYear()} Naratif.</p>
      </div>
    </footer>
  );
}

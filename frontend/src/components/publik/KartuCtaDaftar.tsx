import { Ikon } from "@/components/ui/Ikon";
import { IkonLogo } from "@/components/ui/Logo";
import { TautanTombol } from "@/components/ui/Tombol";

/**
 * BR-03: kartu navy ajakan mendaftar (beranda hal-02, Tentang hal-06). Pendaftaran online, akun langsung aktif.
 * `className` hanya untuk penempatan oleh halaman pemakai; isi kartu sama di semua halaman.
 */
export function KartuCtaDaftar({ className = "" }: { className?: string }) {
  return (
    <section
      aria-labelledby="judul-cta"
      className={`relative overflow-hidden rounded-2xl bg-navy p-6 text-ivory sm:p-8 ${className}`}
    >
      <span aria-hidden="true" className="absolute -right-10 -bottom-8 text-ivory opacity-10">
        <IkonLogo className="h-40" />
      </span>
      <div className="relative flex flex-col gap-3">
        <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">
          Jadi Bagian dari Naratif
        </p>
        <h2
          id="judul-cta"
          className="font-display text-2xl sm:text-3xl lg:text-4xl lg:font-semibold"
        >
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
  );
}

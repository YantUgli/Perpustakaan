import { Logo } from "@/components/ui/Logo";
import { TautanTombol } from "@/components/ui/Tombol";

/**
 * 404 umum (NFR-USA-02: UI berbahasa Indonesia), menggantikan 404 bawaan Next.js. Dipakai untuk URL tak dikenal dan
 * `notFound()` di area admin/anggota; dirender di root layout saja (tanpa header/footer publik maupun sidebar).
 * `notFound()` di detail buku ditangani `(publik)/katalog/[id]/not-found.tsx`.
 */
export default function TidakDitemukan() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span aria-hidden="true">
        <Logo ukuran="besar" />
      </span>
      <h1 className="font-display text-3xl sm:text-4xl">Halaman tidak ditemukan</h1>
      <p className="max-w-md text-navy/80">
        Alamat yang Anda buka tidak ada atau sudah tidak tersedia.
      </p>
      <TautanTombol href="/">Kembali ke Beranda</TautanTombol>
    </section>
  );
}

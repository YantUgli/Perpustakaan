import { TautanTombol } from "@/components/ui/Tombol";

/**
 * 404 detail buku (NFR-USA-02): boundary khusus `/katalog/[id]` saat `notFound()` dipanggil (id tidak sah atau
 * judul tidak ada; detail judul FR-KTL-01). Header & footer tetap dari layout publik. Halaman publik lain memakai
 * root `not-found.tsx`. `flex-1` mengisi `<main>` (flex kolom) sampai footer; akar ber-`mx-auto` wajib `w-full`.
 */
export default function BukuTidakDitemukan() {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-display text-3xl sm:text-4xl">Buku tidak ditemukan</h1>
      <p className="text-navy/80">Buku yang Anda cari tidak ada di katalog.</p>
      <TautanTombol href="/katalog">Kembali ke Katalog</TautanTombol>
    </section>
  );
}

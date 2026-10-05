"use client";

import { Pesan } from "@/components/ui/Pesan";
import { Tombol } from "@/components/ui/Tombol";
import { PESAN_SISTEM } from "@/lib/galat";

/**
 * Galat tak tertangani saat render (mis. backend tak terjangkau dari layout area). Pesan umum hanya di sini;
 * penolakan bisnis ditampilkan di halaman dengan `pesan` backend (IR-UI-04).
 */
export default function Galat({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16">
      <Pesan jenis="galat" judul="Halaman gagal dimuat">
        {PESAN_SISTEM}
      </Pesan>
      <div>
        <Tombol onClick={reset}>Coba Lagi</Tombol>
      </div>
    </section>
  );
}

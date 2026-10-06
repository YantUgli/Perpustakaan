import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tentang Perpustakaan" };

/**
 * Isi faktual halaman Tentang BELUM ADA di sumber (SRS/Brief). Semua bagian memakai teks penanda sampai data
 * dari client diterima lewat BA; halaman tidak boleh lolos UAT selama penanda masih ada (progress.md 5.4.2).
 * Cari `data-penanda` untuk menemukan semua yang harus diganti.
 */
const BAGIAN: { judul: string; menunggu: string }[] = [
  { judul: "Profil", menunggu: "profil singkat perpustakaan" },
  { judul: "Nilai", menunggu: "nilai atau visi perpustakaan" },
  { judul: "Fasilitas & Layanan", menunggu: "daftar fasilitas dan layanan" },
  { judul: "Dalam Angka", menunggu: "angka yang ingin ditampilkan, bila ada" },
  { judul: "Alamat", menunggu: "alamat lengkap perpustakaan" },
  { judul: "Jam Buka", menunggu: "hari dan jam operasional" },
  { judul: "Kontak", menunggu: "telepon dan email yang boleh ditampilkan" },
];

function Penanda({ menunggu }: { menunggu: string }) {
  return (
    <p
      data-penanda
      className="rounded-lg border border-dashed border-gold-700/60 bg-surface px-4 py-3 text-sm text-gold-700"
    >
      [PENANDA] Menunggu data dari pengelola perpustakaan: {menunggu}.
    </p>
  );
}

/** FR-KTL-05: halaman Tentang Perpustakaan tanpa login. */
export default function Tentang() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl sm:text-4xl">Tentang Perpustakaan</h1>
        <span aria-hidden="true" className="block h-0.5 w-20 bg-gold" />
      </header>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {BAGIAN.map((b) => (
          <section key={b.judul} className="flex flex-col gap-2">
            <h2 className="font-display text-xl">{b.judul}</h2>
            <Penanda menunggu={b.menunggu} />
          </section>
        ))}
      </div>
    </section>
  );
}

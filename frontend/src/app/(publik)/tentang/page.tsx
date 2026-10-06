import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tentang Perpustakaan" };

/**
 * Isi dari data pemilik proyek (06/10/2026), disalin apa adanya; belum dikonfirmasi client lewat BA
 * (progress.md 5.4.2). Semua bagian sudah terisi; bila kelak ada isian tanpa data, isi `menunggu` agar tampil
 * sebagai teks penanda (`data-penanda`) dan halaman tidak lolos UAT selama penanda masih ada.
 * "Dalam Angka" dihapus: tidak ada angka dari pemilik proyek.
 */
const BAGIAN: { judul: string; paragraf?: string[]; daftar?: string[]; menunggu?: string }[] = [
  {
    judul: "Profil",
    paragraf: [
      "Perpustakaan Naratif adalah perpustakaan umum yang menyediakan koleksi buku fisik dari berbagai kategori untuk dibaca dan dipinjam oleh masyarakat. Katalog kami dapat dijelajahi siapa saja secara daring tanpa perlu login, sehingga Anda bisa mengecek ketersediaan buku sebelum datang.",
      "Pendaftaran anggota dilakukan secara online dan akun langsung aktif. Setiap anggota mendapat kode QR identifikasi di ponsel. Cukup tunjukkan kode tersebut kepada petugas saat meminjam, tanpa kartu fisik.",
    ],
  },
  {
    judul: "Nilai / Visi",
    daftar: [
      "Membuka akses bacaan yang mudah dan setara bagi seluruh lapisan masyarakat.",
      "Layanan yang cepat, transparan, dan adil bagi setiap anggota.",
      "Menjaga koleksi bersama agar tetap terawat dan bisa dinikmati lebih banyak pembaca.",
    ],
  },
  {
    judul: "Fasilitas & Layanan",
    daftar: [
      "Katalog daring: cari buku berdasarkan judul, penulis, ISBN, atau kategori, lengkap dengan lokasi rak dan jumlah eksemplar tersedia.",
      "Peminjaman buku fisik: maksimal 3 buku dipinjam pada saat yang sama, masa pinjam 30 hari.",
      "Sirkulasi cepat dengan pemindaian kode QR anggota dan buku oleh petugas.",
      "Area anggota: pantau buku yang dipinjam, tanggal jatuh tempo, riwayat, dan tagihan.",
      "Ruang baca di tempat.",
      "Bantuan petugas untuk pencarian koleksi dan pendaftaran anggota.",
    ],
  },
  {
    judul: "Alamat",
    paragraf: [
      "Jl. Surya Kencana No. 58, Pamulang Barat, Kec. Pamulang, Kota Tangerang Selatan, Banten 15417",
    ],
  },
  {
    judul: "Jam Buka",
    daftar: ["Senin–Jumat: 08.00–17.00 WIB", "Sabtu: 09.00–14.00 WIB", "Minggu/libur: Tutup"],
  },
  { judul: "Kontak", daftar: ["Telepon: (021) 555-0123", "Email: info@naratif.id"] },
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
            {b.paragraf?.map((t) => (
              <p key={t} className="text-sm leading-relaxed">
                {t}
              </p>
            ))}
            {b.daftar && (
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {b.daftar.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            {b.menunggu && <Penanda menunggu={b.menunggu} />}
          </section>
        ))}
      </div>
    </section>
  );
}

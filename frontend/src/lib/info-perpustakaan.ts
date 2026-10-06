/**
 * Info perpustakaan untuk halaman Tentang (FR-KTL-05), ringkasan Tentang di beranda, dan kontak di footer.
 * Satu sumber agar ketiganya selalu sama; isi dipindahkan apa adanya dari `tentang/page.tsx`.
 */

/**
 * Isi dari data pemilik proyek (06/10/2026), disalin apa adanya KECUALI baris Fasilitas "Peminjaman buku fisik":
 * "maksimal 3 buku sekaligus" diubah menjadi "maksimal 3 buku dipinjam pada saat yang sama" (BR-08/FR-PJM-08,
 * keputusan Ayen 06/10/2026). Belum dikonfirmasi client lewat BA (progress.md 5.4.2). Semua bagian sudah terisi; bila kelak ada isian tanpa data, isi `menunggu` agar tampil
 * sebagai teks penanda (`data-penanda`) dan halaman tidak lolos UAT selama penanda masih ada.
 * "Dalam Angka" dihapus: tidak ada angka dari pemilik proyek.
 */
export type BagianTentang = {
  judul: string;
  paragraf?: string[];
  daftar?: string[];
  menunggu?: string;
};

export const BAGIAN_TENTANG: BagianTentang[] = [
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

/** Bagian Tentang berdasarkan judulnya (`undefined` bila tidak ada, pemanggil tidak menampilkan apa-apa). */
export function bagianTentang(judul: string): BagianTentang | undefined {
  return BAGIAN_TENTANG.find((b) => b.judul === judul);
}

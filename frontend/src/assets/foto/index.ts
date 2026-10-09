/**
 * Foto dekoratif halaman publik (beranda hal-02, katalog hal-03/04, Tentang hal-06; `fotoHeroBeranda` juga panel
 * kiri `/masuk` hal-07 dan kepala halaman area anggota & admin, `KepalaHalamanArea`). Static import: Next.js membaca ukuran asli dan memberi URL ber-hash, jadi berkas cukup
 * ditimpa dengan nama yang sama saat diganti (mis. versi resolusi lebih tinggi) tanpa mengubah kode. Sumber &
 * lisensi dicatat di `design/kredit-foto.md`.
 */
export { default as fotoHeroBeranda } from "./hero-beranda.jpg";
export { default as fotoBannerKatalog } from "./banner-katalog.jpg";
export { default as fotoHeroTentang } from "./hero-tentang.jpg";
export { default as fotoProfilTentang } from "./profil-tentang.jpg";

/**
 * Kontainer situs publik (hal-02..06). Satu-satunya sumber lebar & gutter untuk header, footer, dan semua halaman
 * publik agar tepi kiri-kanannya sejajar. Mobile: gutter 16/24 px. Mulai `lg`: gutter proporsional 5,5vw
 * (1920 px → ±106 px, 1280 px → ±70 px), tetapi lebar konten tidak melebihi token `--container-situs` (1720 px):
 * di layar sangat lebar gutter membesar, bukan kontennya.
 */
export const KONTAINER =
  "w-full px-4 sm:px-6 lg:px-[max(5.5vw,calc((100%_-_var(--container-situs))/2))]";

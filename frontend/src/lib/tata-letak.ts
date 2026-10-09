/**
 * Kontainer situs publik (hal-02..06). Satu-satunya sumber lebar & gutter untuk header, footer, dan semua halaman
 * publik agar tepi kiri-kanannya sejajar. Mobile: gutter 16/24 px. Mulai `lg`: gutter proporsional 5,5vw
 * (1920 px → ±106 px, 1280 px → ±70 px), tetapi lebar konten tidak melebihi token `--container-situs` (1720 px):
 * di layar sangat lebar gutter membesar, bukan kontennya.
 */
export const KONTAINER =
  "w-full px-4 sm:px-6 lg:px-[max(5.5vw,calc((100%_-_var(--container-situs))/2))]";

/**
 * Rumus gutter `lg` KONTAINER (CSS). `KONTAINER` harus tetap kelas literal agar terbaca Tailwind; kesamaannya dengan
 * rumus ini dijaga `tata-letak.test.ts`. `100%` = lebar elemen ber-KONTAINER (lebar layar pada section publik).
 */
export const GUTTER_LG = "max(5.5vw,calc((100% - var(--container-situs))/2))";

/**
 * Gutter `lg` untuk elemen di dalam kolom (mis. foto `/daftar` yang menembus gutter ke tepi layar): `100%` diganti
 * `100vw` karena persen margin mengacu ke kolom, bukan layar. 100vw termasuk lebar scrollbar, jadi hasilnya bisa
 * sedikit lebih lebar dari gutter sebenarnya; pemakai memotong kelebihannya (`overflow-x-clip`).
 */
export const GUTTER_LG_LAYAR = GUTTER_LG.replace("100%", "100vw");

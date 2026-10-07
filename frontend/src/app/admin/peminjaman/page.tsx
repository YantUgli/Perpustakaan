import type { Metadata } from "next";

import { AlurPeminjaman } from "./AlurPeminjaman";

export const metadata: Metadata = { title: "Peminjaman" };

/** FR-PJM: halaman sirkulasi peminjaman, mobile-first 360 px (IR-UI-01). Alur di komponen klien. */
export default function HalamanPeminjaman() {
  return <AlurPeminjaman />;
}

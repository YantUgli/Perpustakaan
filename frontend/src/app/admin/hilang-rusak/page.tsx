import type { Metadata } from "next";

import { AlurHilangRusak } from "./AlurHilangRusak";

export const metadata: Metadata = { title: "Hilang / Rusak" };

/** FR-HLR: halaman sirkulasi hilang/rusak, mobile-first 360 px (IR-UI-01). Alur di komponen klien. */
export default function HalamanHilangRusak() {
  return <AlurHilangRusak />;
}

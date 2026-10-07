import type { Metadata } from "next";

import { AlurPengembalian } from "./AlurPengembalian";

export const metadata: Metadata = { title: "Pengembalian" };

/** FR-KMB: halaman sirkulasi pengembalian, mobile-first 360 px (IR-UI-01). Alur di komponen klien. */
export default function HalamanPengembalian() {
  return <AlurPengembalian />;
}

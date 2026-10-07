"use client";

import { Tombol } from "@/components/ui/Tombol";

/** Membuka dialog cetak peramban (FR-BKU-06). Tata letak & ukuran diatur CSS cetak lembar label. */
export function TombolCetak() {
  return <Tombol onClick={() => window.print()}>Cetak</Tombol>;
}

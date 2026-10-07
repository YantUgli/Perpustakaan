import Link from "next/link";
import type { ComponentProps } from "react";

export type VarianTombol = "primer" | "sekunder";

// Keputusan pemilik proyek 2026-10-06 (decisions §B, menggantikan P2 2026-10-05): primer = latar gold-700 +
// teks putih (5,51, AA), satu varian. Sekunder = outline navy. Gold #B08D57 hanya untuk dekorasi.
const KELAS: Record<VarianTombol, string> = {
  primer: "bg-gold-700 text-white hover:brightness-90 border border-gold-700",
  sekunder: "bg-transparent text-navy border border-navy hover:bg-navy/5",
};

/** Fokus dua warna: cincin ivory di tepi tombol (terlihat di latar navy) + outline navy di luar (latar terang). */
export function kelasTombol(varian: VarianTombol = "primer", tambahan = ""): string {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy focus-visible:ring-2 focus-visible:ring-ivory disabled:cursor-not-allowed disabled:opacity-60 ${KELAS[varian]} ${tambahan}`;
}

type PropsTombol = ComponentProps<"button"> & { varian?: VarianTombol };

export function Tombol({
  varian = "primer",
  className = "",
  type = "button",
  ...lain
}: PropsTombol) {
  return <button type={type} className={kelasTombol(varian, className)} {...lain} />;
}

type PropsTautan = ComponentProps<typeof Link> & { varian?: VarianTombol };

/** Tautan berpenampilan tombol (navigasi, bukan aksi). */
export function TautanTombol({ varian = "primer", className = "", ...lain }: PropsTautan) {
  return <Link className={kelasTombol(varian, className)} {...lain} />;
}

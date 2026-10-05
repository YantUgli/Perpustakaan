import Link from "next/link";
import type { ComponentProps } from "react";

export type VarianTombol = "primer" | "sekunder";

// P2 (decisions §B): primer = latar gold + teks navy (4,85, AA), satu varian. Sekunder = outline navy.
const KELAS: Record<VarianTombol, string> = {
  primer: "bg-gold text-navy hover:brightness-95 border border-gold",
  sekunder: "bg-transparent text-navy border border-navy hover:bg-navy/5",
};

export function kelasTombol(varian: VarianTombol = "primer", tambahan = ""): string {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-60 ${KELAS[varian]} ${tambahan}`;
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

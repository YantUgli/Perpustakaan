import type { ComponentProps } from "react";

/** Kartu putih di atas ivory dengan garis tipis (design-system §3a, §4: pemisah garis, bukan bayangan). */
export function Kartu({ className = "", ...lain }: ComponentProps<"div">) {
  return <div className={`rounded-xl border border-line bg-surface p-5 ${className}`} {...lain} />;
}

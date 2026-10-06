"use client";

import { type ReactNode, useState } from "react";

/**
 * Panel filter di layar < lg dilipat jadi tombol "Filter" (hal-03 hanya desktop; diturunkan untuk mobile).
 * Mulai `lg` panel selalu tampil dan tombol disembunyikan.
 */
export function LipatFilter({ id, children }: { id: string; children: ReactNode }) {
  const [buka, setBuka] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={buka}
        aria-controls={id}
        onClick={() => setBuka((b) => !b)}
        className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full border border-navy/40 px-5 text-sm font-semibold text-navy hover:bg-navy/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy lg:hidden"
      >
        Filter
        <span aria-hidden="true">{buka ? "▴" : "▾"}</span>
      </button>
      <div id={id} className={`${buka ? "" : "hidden"} lg:block`}>
        {children}
      </div>
    </div>
  );
}

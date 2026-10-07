"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";

import { OPSI_URUT, type Urut } from "@/lib/katalog";

/**
 * OQ-44: dropdown "Urutkan". Ganti pilihan → pindah ke URL yang sudah disusun server (`urlUrutan()`, halaman 1,
 * filter & `q` tetap). Klien tidak menyusun URL sendiri agar satu sumber dengan chip & paginasi.
 */
export function PilihUrutan({ nilai, tautan }: { nilai: Urut; tautan: Record<Urut, string> }) {
  const router = useRouter();
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="shrink-0 text-sm text-navy/80">
        Urutkan
      </label>
      <select
        id={id}
        value={nilai}
        onChange={(e) => router.push(tautan[e.target.value as Urut])}
        className="min-h-11 min-w-0 rounded-lg border border-navy/30 bg-surface px-3 py-2 text-sm text-navy focus:outline-2 focus:outline-offset-1 focus:outline-navy"
      >
        {OPSI_URUT.map((o) => (
          <option key={o.nilai} value={o.nilai}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

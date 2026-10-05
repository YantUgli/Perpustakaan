import { notFound } from "next/navigation";

import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { GalatApi } from "@/lib/galat";

export type Judul = components["schemas"]["JudulKeluar"];

/** `id` dari URL: bukan bilangan bulat positif → 404 tanpa memanggil API. */
export function idJudulAtau404(id: string): number {
  if (!/^[1-9][0-9]*$/.test(id)) notFound();
  return Number(id);
}

/** Judul tak ada (404 backend) → halaman 404; galat lain dilempar ke batas galat. */
export async function ambilJudul(id: number): Promise<Judul> {
  try {
    return await ambilServer<Judul>(`/admin/judul/${id}`);
  } catch (e) {
    if (e instanceof GalatApi && e.status === 404) notFound();
    throw e;
  }
}

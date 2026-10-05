import { notFound } from "next/navigation";

import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { GalatApi } from "@/lib/galat";

export type ProfilAnggota = components["schemas"]["ProfilKeluar"];

/** `GET /admin/anggota/{kode}`; kode tak dikenal (404 backend) → halaman 404. */
export async function ambilAnggota(kode: string): Promise<ProfilAnggota> {
  try {
    return await ambilServer<ProfilAnggota>(`/admin/anggota/${encodeURIComponent(kode)}`);
  } catch (e) {
    if (e instanceof GalatApi && e.status === 404) notFound();
    throw e;
  }
}

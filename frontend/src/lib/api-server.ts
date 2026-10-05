/**
 * Pemanggil API dari server Next.js (Server Component / Server Function).
 *
 * - `cookies()` dipanggil PERTAMA: rute otomatis menjadi dinamis, sehingga `alamatBackend()` (yang wajib
 *   `API_INTERNAL_URL` di luar development) tidak pernah dipanggil saat prerender statis di `next build`.
 * - Cookie sesi diteruskan manual: fetch dari server tidak membawa cookie peramban.
 * - Hanya untuk kode server; peramban memakai `ambil()` dari api-klien.ts.
 */
import { cookies } from "next/headers";

import { alamatBackend } from "./alamat-backend";
import { urlApi } from "./api";
import { bacaRespons } from "./api-klien";
import { GalatApi, galatJaringan } from "./galat";
import type { Sesi } from "./sesi";

export const NAMA_COOKIE_SESI = "sesi_perpus";

export async function ambilServer<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const tokoCookie = await cookies();
  const sesi = tokoCookie.get(NAMA_COOKIE_SESI);
  const url = `${alamatBackend()}${urlApi(path)}`;

  const kepala = new Headers(init.headers);
  kepala.set("accept", "application/json");
  if (sesi) kepala.set("cookie", `${NAMA_COOKIE_SESI}=${sesi.value}`);

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: kepala, cache: "no-store" });
  } catch (e) {
    throw galatJaringan(e);
  }
  return (await bacaRespons(res)) as T;
}

/** `GET /auth/saya`: `null` bila belum login (401). Galat lain dilempar, tidak disamarkan sebagai anonim. */
export async function ambilSesiServer(): Promise<Sesi | null> {
  try {
    return await ambilServer<Sesi>("/auth/saya");
  } catch (e) {
    // Hanya GalatApi 401 yang berarti "belum login"; sinyal internal Next & galat lain diteruskan.
    if (e instanceof GalatApi && e.status === 401) return null;
    throw e;
  }
}

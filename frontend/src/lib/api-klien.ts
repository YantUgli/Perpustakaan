/**
 * Pemanggil API dari peramban. Selalu path relatif `/api/v1` (satu origin, decisions.md §B) sehingga cookie
 * sesi `sesi_perpus` (HttpOnly) ikut terkirim tanpa CORS.
 */
import { urlApi } from "./api";
import { GalatApi, bacaGalat, galatJaringan } from "./galat";

export type OpsiAmbil = Omit<RequestInit, "body" | "credentials"> & {
  /** Dikirim sebagai body JSON. Untuk multipart, pakai `body` FormData lewat `RequestInit` biasa. */
  json?: unknown;
  body?: BodyInit;
};

/** Lempar `GalatApi` bila respons bukan 2xx atau jaringan gagal. 204 → `undefined`. */
export async function ambil<T = unknown>(path: string, opsi: OpsiAmbil = {}): Promise<T> {
  const { json, headers, body, ...lain } = opsi;
  const kepala = new Headers(headers);
  kepala.set("accept", "application/json");
  if (json !== undefined) kepala.set("content-type", "application/json");

  let res: Response;
  try {
    res = await fetch(urlApi(path), {
      ...lain,
      headers: kepala,
      body: json !== undefined ? JSON.stringify(json) : body,
      credentials: "same-origin",
    });
  } catch (e) {
    throw galatJaringan(e);
  }
  return (await bacaRespons(res)) as T;
}

/** Dipakai bersama klien browser & server. */
export async function bacaRespons(res: Response): Promise<unknown> {
  if (!res.ok) throw await bacaGalat(res);
  if (res.status === 204) return undefined;
  return res.json();
}

export { GalatApi };

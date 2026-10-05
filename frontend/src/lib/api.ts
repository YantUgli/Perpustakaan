/**
 * Klien dasar ke backend FastAPI (IR-COM-01: REST/JSON, prefix /api/v1).
 * Tipe respons nantinya di-generate dari OpenAPI backend, bukan ditulis manual.
 *
 * Satu origin (decisions.md §B): browser selalu memanggil path relatif `/api/v1/...`.
 * Development: diteruskan ke backend oleh `rewrites` di next.config.ts.
 * Staging/produksi: diteruskan oleh reverse proxy di domain yang sama.
 */
import { alamatBackend } from "./alamat-backend";

export { alamatBackend };

const PREFIX_API = "/api/v1";

/** URL relatif untuk browser: selalu origin yang sama, tanpa CORS. */
export function urlApi(path: string): string {
  const jalur = path.startsWith("/") ? path : `/${path}`;
  return `${PREFIX_API}${jalur}`;
}

/** URL absolut ke backend, hanya untuk kode yang berjalan di server Next.js. */
export function urlApiServer(path: string): string {
  return `${alamatBackend()}${urlApi(path)}`;
}

/**
 * Klien dasar ke backend FastAPI (IR-COM-01: REST/JSON, prefix /api/v1).
 * Tipe respons nantinya di-generate dari OpenAPI backend, bukan ditulis manual.
 */
const BASE_URL_BAWAAN = "http://localhost:8000";

export function urlApi(path: string, baseUrl?: string): string {
  const dasar = (baseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? BASE_URL_BAWAAN).replace(
    /\/+$/,
    "",
  );
  const jalur = path.startsWith("/") ? path : `/${path}`;
  return `${dasar}/api/v1${jalur}`;
}

/**
 * Alamat backend FastAPI untuk kode yang berjalan di server Next.js (rewrites dev, fetch dari Server Component).
 * Satu-satunya sumber alamat backend (decisions.md §B, satu origin). Fallback hanya saat development;
 * di luar itu `API_INTERNAL_URL` wajib.
 *
 * Modul ini sengaja tanpa import (apalagi alias `@/`) karena juga di-import oleh next.config.ts.
 */
const BACKEND_DEV = "http://127.0.0.1:8000";

export function alamatBackend(): string {
  const dariEnv = process.env.API_INTERNAL_URL?.trim();
  if (dariEnv) return dariEnv.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "development") return BACKEND_DEV;
  throw new Error(
    "API_INTERNAL_URL belum diset. Isi dengan alamat backend FastAPI yang dapat dijangkau server Next.js " +
      "(mis. http://127.0.0.1:8000); fallback otomatis hanya berlaku saat NODE_ENV=development.",
  );
}

/**
 * Pengalihan per role (FR-AKN-05). Hanya kenyamanan UI: hak akses sesungguhnya ditegakkan backend
 * (`router_admin` / `router_anggota`, NFR-SEC-03).
 */
import type { components } from "./api-skema";

export type Role = components["schemas"]["Role"];
export type Area = "admin" | "anggota";

/** Respons `GET /api/v1/auth/saya` (tipe dari OpenAPI). */
export type Sesi = components["schemas"]["ResponsSaya"];

export function berandaRole(role: Role): "/admin" | "/anggota" {
  return role === "ADMIN" ? "/admin" : "/anggota";
}

/** `null` = boleh masuk area; selain itu path tujuan pengalihan. */
export function tujuanArea(sesi: Sesi | null, area: Area): string | null {
  if (!sesi) return "/masuk";
  const milikRole = berandaRole(sesi.role);
  return milikRole === `/${area}` ? null : milikRole;
}

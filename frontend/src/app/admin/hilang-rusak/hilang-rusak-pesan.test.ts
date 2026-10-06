import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, it } from "vitest";

// Tidak perlu jsdom; test ini hanya membaca berkas — ikuti preseden src/lib/validasi-akun.test.ts.

describe("pesan klien sama dengan backend (FR-HLR-03)", () => {
  const baca = (p: string) =>
    readFileSync(fileURLToPath(new URL(`../../../../../backend/${p}`, import.meta.url)), "utf8");

  function harusMemuat(sumber: string, teks: string, berkasPy: string) {
    if (!sumber.includes(teks)) {
      throw new Error(`Teks ${JSON.stringify(teks)} tidak ditemukan di backend/${berkasPy}`);
    }
  }

  it("test_validasi_keterangan_kosong_pesan_identik_backend", async () => {
    // Preseden: src/lib/validasi-akun.test.ts — baca backend, bandingkan dengan konstanta frontend.
    // PESAN_KETERANGAN_KOSONG diekspor dari AlurHilangRusak.tsx (use client); diimpor dinamis agar
    // modul React tidak di-load di lingkungan node.
    const { PESAN_KETERANGAN_KOSONG } = await import("./AlurHilangRusak");
    const sumber = baca("app/services/hilang_rusak.py");
    harusMemuat(sumber, `"${PESAN_KETERANGAN_KOSONG}"`, "app/services/hilang_rusak.py");
  });
});

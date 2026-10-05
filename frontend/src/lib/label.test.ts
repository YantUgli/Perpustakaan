import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  LABEL_CARA_PENYELESAIAN,
  LABEL_JENIS_TAGIHAN,
  LABEL_STATUS,
  LABEL_TERLAMBAT,
  labelStatus,
} from "./label";

const STATUS_PY = fileURLToPath(new URL("../../../backend/app/models/status.py", import.meta.url));

/** Ambil dict `NAMA = { Enum.KODE: "Label", ... }` dari status.py. Gagal keras bila pola tak cocok. */
function dictPython(sumber: string, nama: string): Record<string, string> {
  const blok = new RegExp(`^${nama}\\s*=\\s*\\{([\\s\\S]*?)\\}`, "m").exec(sumber);
  if (!blok) throw new Error(`Tidak menemukan dict ${nama} di backend/app/models/status.py`);
  const entri = [...blok[1].matchAll(/\w+\.(\w+)\s*:\s*"([^"]+)"/g)];
  const isiTanpaSpasi = blok[1].replace(/[\s,]/g, "");
  if (
    entri.length === 0 ||
    entri.map((e) => e[0].replace(/[\s,]/g, "")).join("") !== isiTanpaSpasi
  ) {
    throw new Error(
      `Isi dict ${nama} di status.py tidak dapat diurai dengan pola Enum.KODE: "Label"`,
    );
  }
  return Object.fromEntries(entri.map((e) => [e[1], e[2]]));
}

function konstantaPython(sumber: string, nama: string): string {
  const m = new RegExp(`^${nama}\\s*=\\s*"([^"]+)"\\s*$`, "m").exec(sumber);
  if (!m) throw new Error(`Tidak menemukan konstanta ${nama} di backend/app/models/status.py`);
  return m[1];
}

describe("label sama dengan backend/app/models/status.py (IR-UI-03)", () => {
  const sumber = readFileSync(STATUS_PY, "utf8");

  it("IR_UI_03_label_status_sama_dengan_backend", () => {
    const backend = {
      ...dictPython(sumber, "LABEL_STATUS_EKSEMPLAR"),
      ...dictPython(sumber, "LABEL_STATUS_ITEM"),
      ...dictPython(sumber, "LABEL_STATUS_TAGIHAN"),
    };
    // Kode yang sama di eksemplar & item harus berlabel sama di kedua dict.
    const eks = dictPython(sumber, "LABEL_STATUS_EKSEMPLAR");
    const item = dictPython(sumber, "LABEL_STATUS_ITEM");
    for (const kode of Object.keys(eks)) if (kode in item) expect(item[kode]).toBe(eks[kode]);
    expect(LABEL_STATUS).toEqual(backend);
  });

  it("IR_UI_03_label_jenis_tagihan_sama_dengan_backend", () => {
    expect(LABEL_JENIS_TAGIHAN).toEqual(dictPython(sumber, "LABEL_JENIS_TAGIHAN"));
  });

  it("IR_UI_03_label_cara_penyelesaian_sama_dengan_backend", () => {
    expect(LABEL_CARA_PENYELESAIAN).toEqual(dictPython(sumber, "LABEL_CARA_PENYELESAIAN"));
  });

  it("IR_UI_03_label_terlambat_sama_dengan_backend", () => {
    expect(LABEL_TERLAMBAT).toBe(konstantaPython(sumber, "LABEL_TERLAMBAT"));
  });

  it("pengurai gagal keras bila pola Python berubah (bukan lolos diam-diam)", () => {
    expect(() => dictPython("LABEL_X = {StatusX.A: 'pakai kutip tunggal'}", "LABEL_X")).toThrow(
      /tidak dapat diurai/,
    );
    expect(() => dictPython("", "LABEL_X")).toThrow(/Tidak menemukan/);
    expect(() => konstantaPython("LABEL_TERLAMBAT = 'x'", "LABEL_TERLAMBAT")).toThrow();
  });
});

describe("labelStatus (IR-UI-03)", () => {
  it.each([
    ["TERSEDIA", "Tersedia"],
    ["DIPINJAM", "Dipinjam"],
    ["DIKEMBALIKAN", "Dikembalikan"],
    ["HILANG", "Hilang"],
    ["RUSAK", "Rusak"],
    ["BELUM_LUNAS", "Belum Lunas"],
    ["LUNAS", "Lunas"],
  ])("IR_UI_03_label_status_persis_dari_kode: %s → %s", (kode, label) => {
    expect(labelStatus(kode).label).toBe(label);
  });

  it("IR_UI_03_terlambat_hanya_dari_field_terlambat", () => {
    expect(labelStatus("DIPINJAM", true)).toEqual({ label: "Terlambat", nada: "terlambat" });
    expect(labelStatus("DIPINJAM", false)).toEqual({ label: "Dipinjam", nada: "dipinjam" });
    // `terlambat` hanya bermakna untuk item Dipinjam (FR-DND-05).
    expect(labelStatus("DIKEMBALIKAN", true).label).toBe("Dikembalikan");
  });

  it("IR_UI_03_terlambat_bukan_status_tersimpan: kode TERLAMBAT ditolak", () => {
    expect(() => labelStatus("TERLAMBAT")).toThrow(/tidak dikenal/);
    expect(() => labelStatus("Tersedia")).toThrow(/tidak dikenal/);
  });

  it("nada warna: Belum Lunas memakai nada hilang, Lunas memakai nada tersedia (design-system §5)", () => {
    expect(labelStatus("BELUM_LUNAS").nada).toBe("hilang");
    expect(labelStatus("LUNAS").nada).toBe("tersedia");
    expect(labelStatus("DIKEMBALIKAN").nada).toBe("dikembalikan");
  });
});

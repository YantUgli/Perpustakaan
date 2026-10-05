import { describe, expect, it } from "vitest";

import {
  LABEL_PER_HALAMAN,
  UKURAN_LABEL,
  bagiHalaman,
  cssLabel,
  idLabelDariParam,
  queryLabel,
  urlLabel,
} from "./label-cetak";

describe("Tata letak label A4 (FR-BKU-06, IR-HW-02; keputusan 2026-10-05)", () => {
  it("IR_HW_02_ukuran_3_kolom_x_7_baris_63_5_x_38_1_mm_qr_24_mm", () => {
    expect(UKURAN_LABEL).toMatchObject({
      kolom: 3,
      baris: 7,
      lebarMm: 63.5,
      tinggiMm: 38.1,
      qrMm: 24,
    });
  });

  it("IR_HW_02_21_label_per_halaman", () => {
    expect(LABEL_PER_HALAMAN).toBe(21);
  });

  it("IR_HW_02_css_page_a4_dengan_margin_eksplisit_dan_ukuran_qr_24mm", () => {
    const css = cssLabel();
    expect(css).toMatch(/@page\s*{[^}]*size:\s*A4 portrait;[^}]*margin:\s*0;[^}]*}/);
    expect(css).toMatch(/\.label-qr\s*{[^}]*width:\s*24mm\s*!important;[^}]*}/);
    expect(css).toMatch(/\.label-qr\s*{[^}]*height:\s*24mm\s*!important;[^}]*}/);
    expect(css).toContain("63.5mm");
    expect(css).toContain("38.1mm");
  });

  it("IR_HW_02_satu_lembar_tepat_a4_agar_tidak_meluap_ke_halaman_berikutnya", () => {
    const css = cssLabel();
    expect(css).toMatch(/\.lembar-label\s*{[^}]*width:\s*210mm;[^}]*height:\s*297mm;[^}]*}/);
    expect(css).toContain("break-after: page");
  });

  it("IR_HW_02_tata_letak_muat_di_a4: 3 x lebar + celah <= 210 mm, 7 x tinggi <= 297 mm", () => {
    const { kolom, baris, lebarMm, tinggiMm } = UKURAN_LABEL;
    expect(kolom * lebarMm).toBeLessThanOrEqual(210);
    expect(baris * tinggiMm).toBeLessThanOrEqual(297);
    expect(UKURAN_LABEL.qrMm).toBeLessThan(tinggiMm);
  });
});

describe("Parameter label & halaman cetak", () => {
  it("FR_BKU_06_idLabelDariParam: bulat positif, urutan asli, tanpa duplikat", () => {
    expect(idLabelDariParam({ id: ["3", "1", "3", "x", "-2", "0", "07", "2.5", ""] })).toEqual([
      3, 1,
    ]);
  });

  it("FR_BKU_06_idLabelDariParam: satu id sebagai string; tanpa id → kosong", () => {
    expect(idLabelDariParam({ id: "5" })).toEqual([5]);
    expect(idLabelDariParam({})).toEqual([]);
  });

  it("FR_BKU_06_queryLabel_dan_urlLabel", () => {
    expect(queryLabel([11, 12, 13])).toBe("id=11&id=12&id=13");
    expect(urlLabel([11, 12])).toBe("/admin/eksemplar/label?id=11&id=12");
  });

  it("IR_HW_02_bagiHalaman: 45 label → 21 + 21 + 3; kosong → tanpa halaman", () => {
    const item = Array.from({ length: 45 }, (_, i) => i);
    expect(bagiHalaman(item, 21).map((h) => h.length)).toEqual([21, 21, 3]);
    expect(bagiHalaman(item, 21)[1][0]).toBe(21);
    expect(bagiHalaman([], 21)).toEqual([]);
    expect(bagiHalaman([1, 2, 3], 21)).toEqual([[1, 2, 3]]);
  });
});

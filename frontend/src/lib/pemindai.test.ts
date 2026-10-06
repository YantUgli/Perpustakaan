import { describe, expect, it } from "vitest";

import {
  JEDA_PINDAI_GANDA_MS,
  PESAN_KAMERA,
  buatPenyaringGanda,
  pesanGalatKamera,
} from "./pemindai";

function galatDom(name: string): Error {
  const galat = new Error("pesan bawaan browser");
  galat.name = name;
  return galat;
}

describe("pesanGalatKamera (IR-HW-01, IR-UI-04)", () => {
  it.each([
    ["NotAllowedError", PESAN_KAMERA.izinDitolak],
    ["SecurityError", PESAN_KAMERA.izinDitolak],
    ["NotFoundError", PESAN_KAMERA.tidakDitemukan],
    ["OverconstrainedError", PESAN_KAMERA.tidakDitemukan],
    ["NotReadableError", PESAN_KAMERA.sedangDipakai],
    ["AbortError", PESAN_KAMERA.sedangDipakai],
  ])("test_IR_UI_04_pesan_spesifik_%s", (nama, pesan) => {
    expect(pesanGalatKamera(galatDom(nama))).toBe(pesan);
  });

  it("test_IR_UI_04_galat_tak_dikenal_pesan_gagal_umum_kamera", () => {
    expect(pesanGalatKamera(galatDom("TypeError"))).toBe(PESAN_KAMERA.gagal);
    expect(pesanGalatKamera("bukan galat")).toBe(PESAN_KAMERA.gagal);
    expect(pesanGalatKamera(undefined)).toBe(PESAN_KAMERA.gagal);
  });

  it("test_IR_UI_04_setiap_pesan_mengarahkan_ke_input_manual", () => {
    for (const pesan of Object.values(PESAN_KAMERA)) {
      expect(pesan).toMatch(/ketik kode/i);
    }
  });

  it("test_IR_UI_04_kalimat_lengkap_kamera_sedang_dipakai", () => {
    expect(PESAN_KAMERA.sedangDipakai).toBe(
      "Kamera sedang dipakai aplikasi lain atau tidak dapat dibuka. Tutup aplikasi lain yang memakai kamera lalu tekan Coba lagi, atau ketik kode di bawah.",
    );
  });
});

describe("buatPenyaringGanda (jeda pindai ganda, work-plan 5.4.5)", () => {
  it("jeda bawaan 3 detik", () => {
    expect(JEDA_PINDAI_GANDA_MS).toBe(3000);
  });

  it("test_pindai_ganda_kode_sama_dalam_jeda_diabaikan", () => {
    const saring = buatPenyaringGanda(3000);
    expect(saring("EKS-000001", 0)).toBe(true);
    expect(saring("EKS-000001", 2999)).toBe(false);
  });

  it("test_pindai_ganda_kode_sama_setelah_jeda_lolos", () => {
    const saring = buatPenyaringGanda(3000);
    expect(saring("EKS-000001", 0)).toBe(true);
    expect(saring("EKS-000001", 3000)).toBe(true);
  });

  it("test_pindai_ganda_jeda_bergeser_selama_kode_terus_terbaca", () => {
    const saring = buatPenyaringGanda(3000);
    expect(saring("EKS-000001", 0)).toBe(true);
    expect(saring("EKS-000001", 2000)).toBe(false);
    expect(saring("EKS-000001", 4000)).toBe(false);
    expect(saring("EKS-000001", 6000)).toBe(false);
    expect(saring("EKS-000001", 9000)).toBe(true);
  });

  it("test_pindai_ganda_kode_berbeda_langsung_lolos", () => {
    const saring = buatPenyaringGanda(3000);
    expect(saring("EKS-000001", 0)).toBe(true);
    expect(saring("EKS-000002", 10)).toBe(true);
    expect(saring("EKS-000001", 20)).toBe(true);
  });

  it("test_pindai_ganda_nonaktif_kode_sama_memperpanjang_jeda", () => {
    const saring = buatPenyaringGanda(3000);
    expect(saring("EKS-000001", 0)).toBe(true);
    // Selama nonaktif: dibuang, tetapi kode yang sama tetap memperpanjang jeda.
    expect(saring("EKS-000001", 2500, { nonaktif: true })).toBe(false);
    expect(saring("EKS-000001", 5000, { nonaktif: true })).toBe(false);
    // Sesudah nonaktif=false, buku yang masih di depan kamera tidak terkirim ulang.
    expect(saring("EKS-000001", 7000)).toBe(false);
  });

  it("test_pindai_ganda_nonaktif_kode_berbeda_tidak_dicatat", () => {
    const saring = buatPenyaringGanda(3000);
    expect(saring("EKS-000001", 0)).toBe(true);
    expect(saring("EKS-000002", 100, { nonaktif: true })).toBe(false);
    // Kode berbeda tidak dicatat selama nonaktif → langsung lolos setelahnya.
    expect(saring("EKS-000002", 200)).toBe(true);
  });

  it("test_pindai_ganda_nonaktif_sebelum_ada_bacaan_tidak_dicatat", () => {
    const saring = buatPenyaringGanda(3000);
    expect(saring("EKS-000001", 0, { nonaktif: true })).toBe(false);
    expect(saring("EKS-000001", 100)).toBe(true);
  });
});

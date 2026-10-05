// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const respons = new Map<string, unknown>();
const dipanggil: string[] = [];
vi.mock("@/lib/api-server", () => ({
  ambilServer: async (path: string) => {
    dipanggil.push(path);
    if (!respons.has(path)) throw new Error(`respons palsu belum diatur: ${path}`);
    const r = respons.get(path);
    if (r instanceof Error) throw r;
    return r;
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { default: CetakLabel } = await import("./page");
const { LembarLabel } = await import("./LembarLabel");
const { TombolCetak } = await import("./TombolCetak");
const { GalatApi } = await import("@/lib/galat");

beforeEach(() => {
  respons.clear();
  dipanggil.length = 0;
});
afterEach(() => cleanup());

const buatLabel = (n: number, mulai = 1) =>
  Array.from({ length: n }, (_, i) => ({
    kode: `EKS-${String(mulai + i).padStart(6, "0")}`,
    judul_singkat: `Judul singkat ${mulai + i}`,
    isi_qr: `QR-DARI-API-${mulai + i}`,
  }));

describe("Cetak label (FR-BKU-06, IR-HW-02)", () => {
  it("FR_BKU_06_halaman_memuat_label_dari_api_dengan_id_dari_query", async () => {
    respons.set("/admin/eksemplar/label?id=1&id=2", buatLabel(2));
    const { container } = render(
      await CetakLabel({ searchParams: Promise.resolve({ id: ["1", "2"] }) }),
    );
    expect(dipanggil).toEqual(["/admin/eksemplar/label?id=1&id=2"]);
    expect(container.querySelectorAll("[data-label]")).toHaveLength(2);
    expect(screen.getByText("EKS-000001")).toBeTruthy();
    expect(screen.getByText("Judul singkat 2")).toBeTruthy();
  });

  it("FR_BKU_06_isi_qr_dari_api_apa_adanya_bukan_diturunkan_dari_kode", () => {
    const { container } = render(<LembarLabel label={buatLabel(2)} />);
    const isi = [...container.querySelectorAll("svg[data-isi-qr]")].map((e) =>
      e.getAttribute("data-isi-qr"),
    );
    expect(isi).toEqual(["QR-DARI-API-1", "QR-DARI-API-2"]);
  });

  it("FR_BKU_06_setiap_label_memuat_qr_kode_dan_judul_singkat", () => {
    const { container } = render(<LembarLabel label={buatLabel(1)} />);
    const item = container.querySelector("[data-label]") as HTMLElement;
    expect(item.querySelector("svg")).toBeTruthy();
    expect(item.textContent).toContain("EKS-000001");
    expect(item.textContent).toContain("Judul singkat 1");
  });

  it("IR_HW_02_21_label_per_lembar_A4: 25 label → 2 lembar (21 + 4)", () => {
    const { container } = render(<LembarLabel label={buatLabel(25)} />);
    const lembar = container.querySelectorAll("[data-lembar]");
    expect(lembar).toHaveLength(2);
    expect(lembar[0].querySelectorAll("[data-label]")).toHaveLength(21);
    expect(lembar[1].querySelectorAll("[data-label]")).toHaveLength(4);
  });

  it("IR_HW_02_tepat_21_label_satu_lembar_tanpa_lembar_kosong", () => {
    const { container } = render(<LembarLabel label={buatLabel(21)} />);
    expect(container.querySelectorAll("[data-lembar]")).toHaveLength(1);
  });

  it("IR_HW_02_qr_dipaksa_24mm_lewat_css_dan_page_a4_di_halaman", () => {
    const { container } = render(<LembarLabel label={buatLabel(1)} />);
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toMatch(/@page\s*{[^}]*size:\s*A4 portrait;[^}]*margin:\s*0;/);
    expect(css).toMatch(/\.label-qr\s*{[^}]*width:\s*24mm\s*!important;/);
    expect(css).toMatch(/\.label-qr\s*{[^}]*height:\s*24mm\s*!important;/);
    expect(css).toContain("63.5mm");
    expect(css).toContain("38.1mm");
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("label-qr");
  });

  it("IR_HW_02_petunjuk_cetak_skala_100_persen_hanya_di_layar", async () => {
    respons.set("/admin/eksemplar/label?id=1", buatLabel(1));
    const { container } = render(await CetakLabel({ searchParams: Promise.resolve({ id: "1" }) }));
    const petunjuk = screen.getByText(/skala 100%/i);
    expect(petunjuk.textContent).toMatch(/fit to page|sesuaikan/i);
    expect(petunjuk.closest(".print\\:hidden")).toBeTruthy();
    expect(container.textContent).toMatch(/1 label/);
  });

  it("FR_BKU_06_tombol_cetak_memanggil_print_peramban", () => {
    const cetak = vi.fn();
    vi.stubGlobal("print", cetak);
    window.print = cetak;
    render(<TombolCetak />);
    fireEvent.click(screen.getByRole("button", { name: "Cetak" }));
    expect(cetak).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("FR_BKU_06_tanpa_id_state_kosong_tanpa_panggilan_api", async () => {
    render(await CetakLabel({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Belum ada eksemplar dipilih")).toBeTruthy();
    expect(dipanggil).toEqual([]);
  });

  it("FR_BKU_06_id_tidak_sah_dibuang_sebelum_memanggil_api", async () => {
    respons.set("/admin/eksemplar/label?id=4", buatLabel(1, 4));
    render(await CetakLabel({ searchParams: Promise.resolve({ id: ["4", "abc", "-1"] }) }));
    expect(dipanggil).toEqual(["/admin/eksemplar/label?id=4"]);
  });

  it("IR_UI_04_penolakan_backend_batas_label_pesan_apa_adanya_tanpa_lembar", async () => {
    const pesan = "Data label 1–200 eksemplar per permintaan.";
    respons.set(
      "/admin/eksemplar/label?id=1",
      new GalatApi(422, "BKU_JUMLAH_LABEL", pesan, "FR-BKU-06", {}, false),
    );
    const { container } = render(await CetakLabel({ searchParams: Promise.resolve({ id: "1" }) }));
    expect(screen.getByRole("alert").textContent).toBe(pesan);
    expect(container.querySelectorAll("[data-lembar]")).toHaveLength(0);
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
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

const { default: DashboardAdmin } = await import("./page");

beforeEach(() => {
  respons.clear();
  dipanggil.length = 0;
});
afterEach(() => cleanup());

// Angka sengaja berbeda-beda agar tiap tampilan dapat ditelusuri ke satu field API.
const DASHBOARD = {
  jumlah_judul: 2000,
  eksemplar_per_status: { TERSEDIA: 4120, DIPINJAM: 312, HILANG: 7, RUSAK: 15 },
  jumlah_anggota: 980,
  item_dipinjam: 305,
  item_terlambat: 18,
  tagihan_belum_lunas_jumlah: 12,
  tagihan_belum_lunas_total: 456000,
};

const grup = (nama: string) => screen.getByRole("group", { name: nama });

describe("Dashboard admin (FR-LAP-01, OQ-40, IR-UI-02)", () => {
  it("FR_LAP_01_semua_angka_dari_api_satu_panggilan", async () => {
    respons.set("/admin/dashboard", DASHBOARD);
    render(await DashboardAdmin());
    expect(dipanggil).toEqual(["/admin/dashboard"]);
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
    expect(within(grup("Judul")).getByText("2.000")).toBeTruthy();
    expect(within(grup("Anggota")).getByText("980")).toBeTruthy();
    expect(within(grup("Item dipinjam")).getByText("305")).toBeTruthy();
    expect(within(grup("Item terlambat")).getByText("18")).toBeTruthy();
    const tagihan = grup("Tagihan Belum Lunas");
    expect(within(tagihan).getByText("12")).toBeTruthy();
    expect(within(tagihan).getByText("Rp456.000")).toBeTruthy();
  });

  it("FR_LAP_01_eksemplar_per_status_keempat_tampil_dengan_label_persis_walau_nol", async () => {
    respons.set("/admin/dashboard", {
      ...DASHBOARD,
      eksemplar_per_status: { TERSEDIA: 4120, DIPINJAM: 312, HILANG: 0, RUSAK: 15 },
    });
    render(await DashboardAdmin());
    expect(within(grup("Eksemplar Tersedia")).getByText("4.120")).toBeTruthy();
    expect(within(grup("Eksemplar Dipinjam")).getByText("312")).toBeTruthy();
    expect(within(grup("Eksemplar Hilang")).getByText("0")).toBeTruthy();
    expect(within(grup("Eksemplar Rusak")).getByText("15")).toBeTruthy();
    for (const label of ["Tersedia", "Dipinjam", "Hilang", "Rusak"]) {
      expect(within(grup(`Eksemplar ${label}`)).getByText(label)).toBeTruthy();
    }
  });

  it("OQ_40_status_yang_hilang_dari_api_tampil_strip_bukan_nol", async () => {
    respons.set("/admin/dashboard", {
      ...DASHBOARD,
      eksemplar_per_status: { TERSEDIA: 4120, DIPINJAM: 312, RUSAK: 15 }, // HILANG tidak dikirim
    });
    render(await DashboardAdmin());
    const hilang = grup("Eksemplar Hilang");
    expect(within(hilang).getByText("—")).toBeTruthy();
    expect(within(hilang).queryByText("0")).toBeNull();
    expect(within(grup("Eksemplar Tersedia")).getByText("4.120")).toBeTruthy(); // lainnya tak terpengaruh
  });

  it("FR_LAP_01_klien_tidak_menjumlahkan_eksemplar_per_status", async () => {
    respons.set("/admin/dashboard", DASHBOARD);
    const { container } = render(await DashboardAdmin());
    const teks = container.textContent ?? "";
    // 4120 + 312 + 7 + 15 = 4454: tidak boleh muncul sebagai angka turunan di klien.
    expect(teks).not.toContain("4.454");
    expect(teks).not.toContain("4454");
    expect(screen.queryByText(/total eksemplar/i)).toBeNull();
  });

  it("OQ_40_item_dipinjam_termasuk_terlambat_tanpa_tautan_dan_tanpa_transaksi_aktif", async () => {
    respons.set("/admin/dashboard", DASHBOARD);
    const { container } = render(await DashboardAdmin());
    const dipinjam = grup("Item dipinjam");
    expect(dipinjam.textContent).toMatch(/termasuk yang terlambat/i);
    expect(within(dipinjam).queryByRole("link")).toBeNull(); // filter DIPINJAM ≠ angka ini (OQ-37)
    expect(container.textContent).not.toMatch(/transaksi aktif/i);
  });

  it("FR_LAP_01_tautan_hanya_item_terlambat_tagihan_belum_lunas_judul_dan_anggota", async () => {
    respons.set("/admin/dashboard", DASHBOARD);
    render(await DashboardAdmin());
    expect(
      within(grup("Item terlambat"))
        .getByRole("link", { name: /Lihat laporan/ })
        .getAttribute("href"),
    ).toBe("/admin/laporan/transaksi?status=TERLAMBAT");
    expect(
      within(grup("Tagihan Belum Lunas"))
        .getByRole("link", { name: /Lihat tagihan/ })
        .getAttribute("href"),
    ).toBe("/admin/tagihan?status=BELUM_LUNAS");
    expect(within(grup("Judul")).getByRole("link").getAttribute("href")).toBe("/admin/judul");
    expect(within(grup("Anggota")).getByRole("link").getAttribute("href")).toBe("/admin/anggota");
    for (const nama of [
      "Eksemplar Tersedia",
      "Eksemplar Dipinjam",
      "Eksemplar Hilang",
      "Eksemplar Rusak",
    ]) {
      expect(within(grup(nama)).queryByRole("link")).toBeNull();
    }
  });

  it("FR_LAP_01_tanpa_grafik_dan_tanpa_statistik_perubahan_bulanan", async () => {
    respons.set("/admin/dashboard", DASHBOARD);
    const { container } = render(await DashboardAdmin());
    expect(container.querySelector("canvas, svg[role='graphics-document']")).toBeNull();
    expect(container.textContent).not.toMatch(/bulan lalu|\+\d+%/i);
  });
});

/** Foto dekoratif di kepala halaman (decisions §B Kepala halaman area): `alt=""`, panel `aria-hidden` mulai `lg`. */
function fotoKepala(wadah: Element) {
  return [...wadah.querySelectorAll("header img")].map((img) => {
    expect(img.getAttribute("alt")).toBe("");
    expect(img.closest('[aria-hidden="true"]')?.classList.contains("hidden")).toBe(true);
    return img.getAttribute("src")!;
  });
}

describe("Kepala halaman area (decisions §B)", () => {
  it("IR_UI_03_dashboard_admin_berfoto_hero_beranda", async () => {
    respons.set("/admin/dashboard", DASHBOARD);
    const { container } = render(await DashboardAdmin());
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
    expect(fotoKepala(container)).toEqual([expect.stringContaining("hero-beranda")]);
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = { replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/laporan/tagihan",
}));

const { TombolKeluar } = await import("./TombolKeluar");
const { PESAN_JARINGAN, PESAN_SISTEM } = await import("@/lib/galat");
const { SidebarArea } = await import("./SidebarArea");
const { MENU_ADMIN, MENU_ANGGOTA, itemAktif } = await import("./menu");

const fetchPalsu = vi.fn();

beforeEach(() => {
  router.replace.mockReset();
  router.refresh.mockReset();
  fetchPalsu.mockReset();
  vi.stubGlobal("fetch", fetchPalsu);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TombolKeluar (FR-AKN-06)", () => {
  it("FR_AKN_06_keluar_panggil_logout_lalu_ke_beranda", async () => {
    fetchPalsu.mockResolvedValue(new Response(null, { status: 204 }));
    render(<TombolKeluar />);
    fireEvent.click(screen.getByRole("button", { name: "Keluar" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("/api/v1/auth/logout");
    expect(init.method).toBe("POST");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("FR_AKN_06_logout_gagal_menampilkan_pesan_dan_tetap_di_halaman", async () => {
    fetchPalsu.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<TombolKeluar />);
    fireEvent.click(screen.getByRole("button", { name: "Keluar" }));
    expect((await screen.findByRole("alert")).textContent).toBe(PESAN_JARINGAN);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("IR_UI_04_logout_galat_bukan_GalatApi_tampilkan_pesan_sistem", async () => {
    // 200 dengan isi bukan JSON → res.json() melempar SyntaxError (bukan GalatApi).
    fetchPalsu.mockResolvedValue(new Response("<html>bukan json</html>", { status: 200 }));
    render(<TombolKeluar />);
    fireEvent.click(screen.getByRole("button", { name: "Keluar" }));
    const pesan = await screen.findByRole("alert");
    expect(pesan.textContent).toBe(PESAN_SISTEM);
    expect(pesan.textContent).not.toContain("SyntaxError");
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("Menu area", () => {
  it("menu anggota sesuai Brief §9.1 (tanpa menu lapor hilang, K-01)", () => {
    expect(MENU_ANGGOTA.map((m) => m.label)).toEqual([
      "Dashboard",
      "QR Anggota",
      "Pinjaman Saya",
      "Riwayat",
      "Tagihan",
      "Profil",
    ]);
  });

  it("menu anggota tanpa 'Ubah Password' (keputusan pemilik proyek: ubah password di halaman Profil)", () => {
    expect(
      MENU_ANGGOTA.some((m) => /password/i.test(m.label) || m.href === "/anggota/password"),
    ).toBe(false);
  });

  it("menu admin tanpa kelola akun admin (FR-AKN-12, K-04)", () => {
    expect(MENU_ADMIN.some((m) => /akun admin|pengguna/i.test(m.label))).toBe(false);
  });

  it("itemAktif: beranda area hanya persis, lainnya per awalan", () => {
    const dashboard = MENU_ADMIN[0];
    const laporan = MENU_ADMIN.find((m) => m.label === "Laporan")!;
    expect(itemAktif("/admin", dashboard)).toBe(true);
    expect(itemAktif("/admin/tagihan", dashboard)).toBe(false);
    expect(itemAktif("/admin/laporan/tagihan", laporan)).toBe(true);
    expect(itemAktif("/admin/laporanx", laporan)).toBe(false);
  });

  it("SidebarArea admin menandai halaman aktif dan menyediakan Keluar", () => {
    render(<SidebarArea varian="admin" nama="Raisya Annisa" />);
    const aktif = screen.getByRole("link", { current: "page" });
    expect(aktif.textContent).toBe("Laporan");
    expect(screen.getByRole("button", { name: "Keluar" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Raisya Annisa" }).textContent).toBe("RA");
  });
});

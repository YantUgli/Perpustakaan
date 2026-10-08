// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = { replace: vi.fn(), refresh: vi.fn() };
const jalur = { saatIni: "/admin/laporan/tagihan" };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => jalur.saatIni,
}));

const { TombolKeluar } = await import("./TombolKeluar");
const { PESAN_JARINGAN, PESAN_SISTEM } = await import("@/lib/galat");
const { SidebarArea } = await import("./SidebarArea");
const { MENU_ADMIN, MENU_ANGGOTA, itemAktif } = await import("./menu");

const fetchPalsu = vi.fn();

beforeEach(() => {
  jalur.saatIni = "/admin/laporan/tagihan";
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

describe("Navigasi area: ikon menu & logo (susulan 5.4.1, D2/D4 08/10/2026)", () => {
  const LABEL_LOGO = "Naratif Perpustakaan, Beranda";

  /** Ikon menu = svg ber-`data-ikon` di dalam tautan (dekoratif, aria-hidden). */
  function ikonDi(tautan: HTMLElement): string | null {
    const svg = tautan.querySelector("svg[data-ikon]");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    return svg?.getAttribute("data-ikon") ?? null;
  }

  it.each([
    ["anggota", MENU_ANGGOTA],
    ["admin", MENU_ADMIN],
  ] as const)("setiap item menu %s punya ikon", (_, menu) => {
    for (const item of menu) expect(item.ikon).toBeTruthy();
  });

  it.each([
    ["anggota" as const, "/anggota/riwayat", "Riwayat"],
    ["admin" as const, "/admin/laporan/tagihan", "Laporan"],
  ])("FR_AKN_05_menu_%s_aktif_ikon_solid_lainnya_ikon_garis", (varian, pathname, labelAktif) => {
    jalur.saatIni = pathname;
    render(<SidebarArea varian={varian} nama="Bryant Nanur" />);
    const menu = varian === "admin" ? MENU_ADMIN : MENU_ANGGOTA;
    const nav = screen.getByRole("navigation");
    for (const item of menu) {
      const tautan = within(nav).getByRole("link", { name: item.label });
      if (item.label === labelAktif) {
        expect(tautan.getAttribute("aria-current")).toBe("page");
        expect(ikonDi(tautan)).toBe(`${item.ikon}Isi`);
      } else {
        expect(tautan.getAttribute("aria-current")).toBeNull();
        expect(ikonDi(tautan)).toBe(item.ikon);
      }
    }
  });

  it.each(["anggota", "admin"] as const)(
    "FR_AKN_05_logo_sidebar_dan_bilah_atas_%s_ke_beranda",
    (varian) => {
      jalur.saatIni = varian === "admin" ? "/admin" : "/anggota";
      render(<SidebarArea varian={varian} nama="Bryant Nanur" />);
      const logo = screen.getAllByRole("link", { name: LABEL_LOGO });
      // Satu di bilah atas (< lg), satu di sidebar (≥ lg).
      expect(logo).toHaveLength(2);
      for (const t of logo) {
        expect(t.getAttribute("href")).toBe("/");
        expect(t.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
      }
    },
  );
});

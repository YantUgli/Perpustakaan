// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sesiPalsu = vi.fn();
vi.mock("@/lib/api-server", () => ({ ambilSesiAtauTamu: () => sesiPalsu() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const { default: HalamanMasuk } = await import("./page");
const { FormMasuk } = await import("./FormMasuk");

const fetchPalsu = vi.fn();

beforeEach(() => {
  fetchPalsu.mockReset();
  vi.stubGlobal("fetch", fetchPalsu);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Tampilan /masuk (hal-07, FR-AKN-05)", () => {
  it("FR_AKN_05_tombol_mata_tidak_mengirim_form_dan_mengubah_type", () => {
    render(<FormMasuk />);
    const isian = screen.getByLabelText(/^Password/) as HTMLInputElement;
    const mata = screen.getByRole("button", { name: "Tampilkan password" });
    expect(mata.getAttribute("type")).toBe("button");
    expect(isian.type).toBe("password");
    expect(mata.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(mata);
    expect(isian.type).toBe("text");
    expect(mata.getAttribute("aria-pressed")).toBe("true");
    // Label tetap; status dibawa aria-pressed.
    expect(mata.getAttribute("aria-label")).toBe("Tampilkan password");

    fireEvent.click(mata);
    expect(isian.type).toBe("password");
    expect(fetchPalsu).not.toHaveBeenCalled();
    expect(screen.queryByText("Email wajib diisi.")).toBeNull();
  });

  it("BR_02_kotak_info_statis_tanpa_role_status_atau_alert", () => {
    render(<FormMasuk />);
    const teks = screen.getByText(/Setelah berhasil masuk/);
    expect(teks.textContent).toContain("(anggota atau admin)");
    expect(teks.closest("[role]")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("BR_01_subjudul_tanpa_favorit_maupun_akses_koleksi", async () => {
    sesiPalsu.mockResolvedValue(null);
    render(await HalamanMasuk());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Masuk ke Akun Anda");
    expect(screen.getByText(/Jelajahi lebih banyak pengetahuan/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/favorit/i);
    expect(document.body.textContent).not.toMatch(/Akses koleksi/i);
    expect(screen.queryByText(/lupa/i)).toBeNull();
  });
});

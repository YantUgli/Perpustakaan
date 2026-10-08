// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

const { default: TidakDitemukan } = await import("./not-found");
const { default: BukuTidakDitemukan } = await import("./(publik)/katalog/[id]/not-found");

afterEach(cleanup);

// NFR-USA-02: UI berbahasa Indonesia, termasuk halaman 404 (menggantikan 404 bawaan Next.js berbahasa Inggris).
describe("Halaman 404 (NFR-USA-02)", () => {
  it("NFR_USA_02_404_root_bahasa_indonesia_tautan_ke_beranda", () => {
    const { container } = render(<TidakDitemukan />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Halaman tidak ditemukan");
    expect(screen.getByRole("link", { name: "Kembali ke Beranda" }).getAttribute("href")).toBe("/");
    expect(container.textContent).not.toMatch(/could not be found|not found/i);
  });

  it("NFR_USA_02_404_publik_buku_tidak_ditemukan_tautan_ke_katalog", () => {
    const { container } = render(<BukuTidakDitemukan />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Buku tidak ditemukan");
    expect(screen.getByRole("link", { name: "Kembali ke Katalog" }).getAttribute("href")).toBe(
      "/katalog",
    );
    expect(container.textContent).not.toMatch(/could not be found|not found/i);
    // Akar ber-mx-auto di dalam <main> flex kolom wajib w-full.
    expect((container.firstElementChild as HTMLElement).className.split(" ")).toContain("w-full");
  });
});

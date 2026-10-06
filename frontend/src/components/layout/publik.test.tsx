// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let pathname = "/";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathname,
}));

const { HeaderPublik } = await import("./HeaderPublik");
const { FooterPublik } = await import("./FooterPublik");
const { bagianTentang } = await import("@/lib/info-perpustakaan");

afterEach(cleanup);

describe("HeaderPublik (Brief §9.1, hal-02)", () => {
  it("FR_KTL_05_header_menu_aktif_dan_tombol_pengunjung", () => {
    pathname = "/katalog/7";
    render(<HeaderPublik sesi={null} />);
    const menu = screen.getByRole("navigation", { name: "Menu utama" });
    const tautan = within(menu).getAllByRole("link");
    expect(tautan.map((t) => t.textContent)).toEqual([
      "Beranda",
      "Katalog Buku",
      "Tentang Perpustakaan",
    ]);
    // Halaman detail menandai "Katalog Buku" sebagai aktif; "Beranda" hanya persis "/".
    expect(tautan.map((t) => t.getAttribute("aria-current"))).toEqual([null, "page", null]);
    expect(screen.getByRole("link", { name: "Masuk" }).getAttribute("href")).toBe("/masuk");
    expect(screen.getByRole("link", { name: "Daftar" }).getAttribute("href")).toBe("/daftar");
  });

  it("FR_AKN_05_header_login_nama_panjang_dipotong_dengan_title_utuh", () => {
    pathname = "/";
    const nama = "Raden Ajeng Kartini Sosroningrat Wiryodiningrat Panjang Sekali";
    render(<HeaderPublik sesi={{ role: "ANGGOTA", nama, email: "k@contoh.example" }} />);
    const profil = screen.getByRole("link", { name: /Raden Ajeng/ });
    expect(profil.getAttribute("href")).toBe("/anggota");
    expect(profil.getAttribute("title")).toBe(nama);
    expect(profil.querySelector("span.truncate")?.textContent).toBe(nama);
    expect(screen.getByRole("button", { name: "Keluar" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Masuk" })).toBeNull();
  });
});

describe("FooterPublik (hal-02, D6)", () => {
  it("FR_KTL_05_footer_tautan_cepat_dan_kontak_dari_sumber_tentang", () => {
    render(<FooterPublik />);
    const tautan = within(screen.getByRole("navigation", { name: "Tautan Cepat" })).getAllByRole(
      "link",
    );
    expect(tautan.map((t) => [t.textContent, t.getAttribute("href")])).toEqual([
      ["Beranda", "/"],
      ["Katalog Buku", "/katalog"],
      ["Tentang Perpustakaan", "/tentang"],
    ]);
    const kontak = screen.getByRole("region", { name: "Kontak" });
    // Isi sama persis dengan halaman Tentang (satu sumber), bukan ditulis ulang.
    const harapan = [
      ...(bagianTentang("Alamat")?.paragraf ?? []),
      ...(bagianTentang("Kontak")?.daftar ?? []),
    ];
    expect(harapan.length).toBeGreaterThanOrEqual(3);
    for (const t of harapan) expect(within(kontak).getByText(t)).toBeTruthy();
    // Tanpa "Bantuan" dan media sosial (halaman tidak ada, SRS tidak memuatnya).
    expect(screen.queryByText(/bantuan|instagram|youtube|facebook/i)).toBeNull();
  });
});

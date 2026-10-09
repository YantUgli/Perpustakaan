// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KETENTUAN_PINJAM, bagianTentang } from "@/lib/info-perpustakaan";

const sesiPalsu = vi.fn();
vi.mock("@/lib/api-server", () => ({ ambilSesiAtauTamu: () => sesiPalsu() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

const { default: HalamanDaftar } = await import("./page");

async function tampilkan() {
  render(await HalamanDaftar());
}

beforeEach(() => {
  sesiPalsu.mockResolvedValue(null);
});

afterEach(cleanup);

describe("Tampilan /daftar (hal-08)", () => {
  it("BR_08_BR_11_FR_AGT_02_04_tiga_manfaat_teks_persis", async () => {
    await tampilkan();
    const daftar = screen.getByRole("list", { name: "Keuntungan menjadi anggota" });
    const butir = within(daftar).getAllByRole("listitem");
    expect(
      butir.map((b) => [b.querySelector("h3")?.textContent, b.querySelector("p")?.textContent]),
    ).toEqual([
      ["Pinjam Buku Fisik", "Maksimal 3 buku dipinjam pada saat yang sama, masa pinjam 30 hari."],
      [
        "Pinjam dengan QR Anggota",
        "Tunjukkan QR anggota dari ponsel Anda, tanpa kartu anggota fisik.",
      ],
      [
        "Pantau Pinjaman & Tagihan",
        "Lihat jatuh tempo, riwayat peminjaman, dan tagihan Anda di area anggota.",
      ],
    ]);
    // Butir a satu sumber dengan baris Fasilitas di Tentang.
    expect(KETENTUAN_PINJAM).toBe(
      "maksimal 3 buku dipinjam pada saat yang sama, masa pinjam 30 hari.",
    );
    expect(bagianTentang("Fasilitas & Layanan")!.daftar).toContain(
      `Peminjaman buku fisik: ${KETENTUAN_PINJAM}`,
    );
  });

  it("luar_lingkup_halaman_tanpa_klaim_tanpa_dasar (digital, kegiatan, komunitas, rekomendasi, ribuan)", async () => {
    await tampilkan();
    const teks = document.body.textContent!.toLowerCase();
    for (const kata of ["digital", "kegiatan literasi", "komunitas", "rekomendasi", "ribuan"]) {
      expect(teks).not.toContain(kata);
    }
  });

  it("foto_dekoratif_alt_kosong_di_aria_hidden_tanpa_teks_dan_kolom_hidden_di_bawah_lg", async () => {
    const { container } = render(await HalamanDaftar());
    const img = container.querySelector("img")!;
    expect(img.getAttribute("alt")).toBe("");
    const bungkus = img.closest('[aria-hidden="true"]')!;
    expect(bungkus).not.toBeNull();
    expect(bungkus.textContent).toBe("");
    // Pojok kanan atas (hal-08): menempel header & menembus gutter kanan; kelebihan dipotong section.
    expect(bungkus.className).toContain("lg:-mt-12");
    expect((bungkus as HTMLElement).style.marginRight).toContain("100vw");
    // Menyelip di belakang kartu: tepi kiri memudar (mask kiri), kartu form di atasnya lewat z-index.
    expect((bungkus as HTMLElement).style.marginLeft).toMatch(/^calc\(-/);
    expect(bungkus.className).toContain("mask-l-from-");
    expect(bungkus.className).toContain("mask-l-to-");
    const kartu = container.querySelector("form")!.closest(".rounded-2xl\\!")!;
    expect(kartu.className).toContain("relative");
    expect(kartu.className).toContain("z-10");
    // Breadcrumb & kepala dibatasi agar tidak berada di atas foto.
    expect(container.querySelector('nav[aria-label="Breadcrumb"]')!.className).toContain(
      "lg:pr-28",
    );
    expect(container.querySelector("header")!.className).toContain("lg:pr-28");
    expect(container.querySelector("section")!.className).toContain("overflow-x-clip");
    const kolom = container.querySelector("[data-kolom-manfaat]")!;
    expect(kolom.contains(img)).toBe(true);
    expect(kolom.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(kolom.className).toContain("lg:flex");
  });

  it("breadcrumb_beranda_daftar_anggota", async () => {
    await tampilkan();
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Beranda" }).getAttribute("href")).toBe("/");
    expect(within(nav).getByText("Daftar Anggota").getAttribute("aria-current")).toBe("page");
  });

  it("BR_03_h1_dan_subjudul", async () => {
    await tampilkan();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Daftar Menjadi Anggota Naratif",
    );
    expect(
      screen.getByText(
        "Daftar untuk meminjam buku fisik di Perpustakaan Naratif. Akun langsung aktif setelah pendaftaran.",
      ),
    ).toBeTruthy();
  });

  it("OQ_30_kotak_info_statis_tanpa_role", async () => {
    await tampilkan();
    const teks = screen.getByText(
      "Setelah pendaftaran berhasil, akun Anda langsung aktif dan Anda mendapatkan ID anggota.",
    );
    const kotak = teks.parentElement!;
    expect(kotak.getAttribute("role")).toBeNull();
    expect(teks.getAttribute("role")).toBeNull();
    expect(kotak.querySelector('svg[data-ikon="info"]')).not.toBeNull();
  });

  it("kepala_kartu_form_pendaftaran_anggota", async () => {
    await tampilkan();
    expect(
      screen.getByRole("heading", { level: 2, name: "Form Pendaftaran Anggota" }),
    ).toBeTruthy();
    expect(screen.getByText("Lengkapi data diri Anda. Isian bertanda * wajib diisi.")).toBeTruthy();
  });

  it("grid_kolom_minmax_agar_isi_panjang_tidak_melebarkan_kolom", async () => {
    const { container } = render(await HalamanDaftar());
    const kolom = container.querySelector("[data-kolom-manfaat]")!;
    expect(kolom.parentElement!.className).toContain("lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]");
  });
});

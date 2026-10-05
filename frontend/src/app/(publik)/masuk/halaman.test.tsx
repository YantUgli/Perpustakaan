import { beforeEach, describe, expect, it, vi } from "vitest";

const sesiPalsu = vi.fn();
vi.mock("@/lib/api-server", () => ({ ambilSesiAtauTamu: () => sesiPalsu() }));

class Dialihkan extends Error {
  constructor(readonly tujuan: string) {
    super(`redirect ${tujuan}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (tujuan: string) => {
    throw new Dialihkan(tujuan);
  },
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const { default: HalamanMasuk } = await import("./page");
const { default: HalamanDaftar } = await import("../daftar/page");

beforeEach(() => sesiPalsu.mockReset());

describe.each([
  ["/masuk (FR-AKN-05)", HalamanMasuk],
  ["/daftar (keputusan tim P2, decisions §B)", HalamanDaftar],
])("%s", (_nama, Halaman) => {
  it.each([
    ["ADMIN", "/admin"],
    ["ANGGOTA", "/anggota"],
  ])("FR_AKN_05_sudah_login_dialihkan_ke_beranda_role: %s → %s", async (role, tujuan) => {
    sesiPalsu.mockResolvedValue({ role, nama: "X", email: "x@contoh.example" });
    await expect(Halaman()).rejects.toMatchObject({ tujuan });
  });

  it("pengunjung (belum login) melihat form", async () => {
    sesiPalsu.mockResolvedValue(null);
    await expect(Halaman()).resolves.toBeTruthy();
  });
});

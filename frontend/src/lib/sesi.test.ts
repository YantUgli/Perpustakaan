import { describe, expect, it } from "vitest";

import { berandaRole, tujuanArea } from "./sesi";

describe("tujuanArea (FR-AKN-05: arahkan ke dashboard sesuai role)", () => {
  it("FR_AKN_05_tanpa_sesi_ke_halaman_masuk", () => {
    expect(tujuanArea(null, "anggota")).toBe("/masuk");
    expect(tujuanArea(null, "admin")).toBe("/masuk");
  });

  it("FR_AKN_05_role_sesuai_boleh_masuk", () => {
    expect(
      tujuanArea({ role: "ANGGOTA", nama: "Aulia", email: "aulia@contoh.example" }, "anggota"),
    ).toBeNull();
    expect(
      tujuanArea({ role: "ADMIN", nama: "Raisya", email: "raisya@contoh.example" }, "admin"),
    ).toBeNull();
  });

  it("FR_AKN_05_role_salah_dialihkan_ke_area_sendiri", () => {
    expect(
      tujuanArea({ role: "ANGGOTA", nama: "Aulia", email: "aulia@contoh.example" }, "admin"),
    ).toBe("/anggota");
    expect(
      tujuanArea({ role: "ADMIN", nama: "Raisya", email: "raisya@contoh.example" }, "anggota"),
    ).toBe("/admin");
  });

  it("berandaRole: dashboard per role", () => {
    expect(berandaRole("ADMIN")).toBe("/admin");
    expect(berandaRole("ANGGOTA")).toBe("/anggota");
  });
});

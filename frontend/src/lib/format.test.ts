import { describe, expect, it } from "vitest";

import { formatRupiah, formatTanggal } from "./format";

describe("formatTanggal (NFR-USA-02, K-07)", () => {
  it.each([
    ["2026-10-05", "05/10/2026"],
    ["2024-02-29", "29/02/2024"],
    ["2026-12-31", "31/12/2026"],
    ["2027-01-01", "01/01/2027"],
  ])("NFR_USA_02_format_tanggal_DD_MM_YYYY: %s → %s", (iso, hasil) => {
    expect(formatTanggal(iso)).toBe(hasil);
  });

  it("K_07_tanpa_geser_zona_waktu: tanggal diurai sebagai teks, bukan Date UTC", () => {
    // new Date("2026-10-01") = tengah malam UTC; di zona barat UTC akan jadi 30/09.
    expect(formatTanggal("2026-10-01")).toBe("01/10/2026");
  });

  it.each(["05/10/2026", "2026-10-5", "2026-10-05T10:00:00", ""])(
    "menolak bentuk selain YYYY-MM-DD: %j",
    (salah) => {
      expect(() => formatTanggal(salah)).toThrow();
    },
  );
});

describe("formatRupiah (NFR-USA-02, sama dengan backend format_rupiah)", () => {
  it.each([
    [0, "Rp0"],
    [999, "Rp999"],
    [10_000, "Rp10.000"],
    [35_555, "Rp35.555"],
    [1_250_000, "Rp1.250.000"],
  ])("NFR_USA_02_format_rupiah: %d → %s", (nominal, hasil) => {
    expect(formatRupiah(nominal)).toBe(hasil);
  });

  it.each([-1, 10.5, Number.NaN])("menolak nominal bukan int Rupiah tak negatif: %d", (salah) => {
    expect(() => formatRupiah(salah)).toThrow();
  });
});

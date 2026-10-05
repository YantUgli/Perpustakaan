import { describe, expect, it } from "vitest";

import { JUDUL_ALASAN_UMUM, judulAlasan, pinjamanTerdekat, teksSisaHari } from "./area-anggota";
import { halamanDariParam, jumlahHalaman } from "./halaman";

describe("teksSisaHari (FR-AGT-02, OQ-34) — hanya dari field API", () => {
  it.each([
    [{ sisa_hari: 5, terlambat: false, hari_terlambat: 0 }, "5 hari lagi"],
    [{ sisa_hari: 1, terlambat: false, hari_terlambat: 0 }, "1 hari lagi"],
    [{ sisa_hari: 0, terlambat: false, hari_terlambat: 0 }, "Jatuh tempo hari ini"],
    [{ sisa_hari: 0, terlambat: true, hari_terlambat: 3 }, "Terlambat 3 hari"],
    [{ sisa_hari: 0, terlambat: true, hari_terlambat: 71 }, "Terlambat 71 hari"],
  ])("OQ_34_teks_sisa_hari: %j → %s", (item, teks) => {
    expect(teksSisaHari(item)).toBe(teks);
  });

  it("terlambat diambil dari field `terlambat`, bukan dari sisa_hari", () => {
    // Bila API menyatakan terlambat, teks terlambat yang dipakai walau sisa_hari tidak 0.
    expect(teksSisaHari({ sisa_hari: 2, terlambat: true, hari_terlambat: 1 })).toBe(
      "Terlambat 1 hari",
    );
  });
});

describe("judulAlasan (FR-AGT-05; decisions §B: kalimat 'Anda …' disusun dari alasan[].kode)", () => {
  it("FR_AGT_05_judul_alasan_dari_kode", () => {
    expect(judulAlasan("PJM_ADA_TAGIHAN")).toBe("Anda memiliki tagihan yang belum lunas");
    expect(judulAlasan("PJM_ADA_TERLAMBAT")).toBe("Anda memiliki buku yang terlambat dikembalikan");
  });

  it("kode tak dikenal memakai judul umum (pesan backend tetap ditampilkan pemanggil)", () => {
    expect(judulAlasan("KODE_BARU")).toBe(JUDUL_ALASAN_UMUM);
  });
});

describe("pinjamanTerdekat (dashboard)", () => {
  it("mengambil 3 pertama sesuai urutan API (backend sudah urut jatuh_tempo, id)", () => {
    const daftar = ["a", "b", "c", "d"].map((kode, i) => ({
      kode_eksemplar: kode,
      // Sengaja tidak urut: fungsi tidak boleh mengurutkan ulang.
      jatuh_tempo: `2026-10-0${9 - i}`,
    }));
    expect(pinjamanTerdekat(daftar).map((p) => p.kode_eksemplar)).toEqual(["a", "b", "c"]);
  });

  it("kurang dari 3 → apa adanya", () => {
    expect(pinjamanTerdekat([{ k: 1 }])).toEqual([{ k: 1 }]);
    expect(pinjamanTerdekat([])).toEqual([]);
  });
});

describe("halamanDariParam & jumlahHalaman (FR-AGT-03/04 berhalaman)", () => {
  it.each([undefined, "", "0", "-1", "abc", "2.5", ["3", "4"]])(
    "halaman_dari_param tidak sah → 1: %j",
    (nilai) => {
      expect(halamanDariParam(nilai)).toBe(1);
    },
  );

  it("halaman_dari_param sah", () => {
    expect(halamanDariParam("3")).toBe(3);
  });

  it.each([
    [0, 20, 1],
    [20, 20, 1],
    [21, 20, 2],
    [40, 20, 2],
    [41, 20, 3],
  ])("jumlah_halaman total=%d per=%d → %d", (total, per, hasil) => {
    expect(jumlahHalaman(total, per)).toBe(hasil);
  });
});

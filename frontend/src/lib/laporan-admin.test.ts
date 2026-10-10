import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { formatAngka } from "./format";
import {
  OPSI_CARA_LAPORAN,
  OPSI_JENIS_LAPORAN,
  OPSI_STATUS_TAGIHAN_LAPORAN,
  OPSI_STATUS_TRANSAKSI,
  STATUS_TRANSAKSI,
  URUT_STATUS_EKSEMPLAR,
  filterTagihanDariParam,
  filterTransaksiDariParam,
  paramFilterTagihan,
  paramFilterTransaksi,
  paramsPaginasi,
  queryTagihan,
  ringkasEksemplar,
  segmenDonut,
  queryTransaksi,
  urlEksporTagihan,
  urlEksporTransaksi,
  urutkanEksemplar,
} from "./laporan-admin";

const backend = readFileSync(
  fileURLToPath(new URL("../../../backend/app/api/v1/admin/laporan.py", import.meta.url)),
  "utf8",
);

describe("Filter laporan transaksi (FR-LAP-02, OQ-37, OQ-38)", () => {
  it("FR_LAP_02_filter_dari_param: nilai sah dipertahankan", () => {
    expect(
      filterTransaksiDariParam({
        dari: "2026-10-01",
        sampai: "2026-10-31",
        status: "TERLAMBAT",
        halaman: "3",
      }),
    ).toEqual({ dari: "2026-10-01", sampai: "2026-10-31", status: "TERLAMBAT", halaman: 3 });
  });

  it("FR_LAP_02_nilai_tak_sah_dibuang: status tak dikenal, tanggal tak nyata, array, kosong", () => {
    expect(
      filterTransaksiDariParam({ dari: "01/10/2026", sampai: "2026-02-30", status: "SELESAI" }),
    ).toEqual({ halaman: 1 });
    expect(
      filterTransaksiDariParam({
        dari: ["2026-10-01", "2026-10-02"],
        status: ["LUNAS"],
        halaman: "x",
      }),
    ).toEqual({ halaman: 1 });
    expect(filterTransaksiDariParam({ dari: "", sampai: "  " })).toEqual({ halaman: 1 });
  });

  it("FR_LAP_02_tanggal_kabisat_dan_batas_bulan", () => {
    expect(filterTransaksiDariParam({ dari: "2024-02-29" }).dari).toBe("2024-02-29");
    expect(filterTransaksiDariParam({ dari: "2026-02-29" }).dari).toBeUndefined();
    expect(filterTransaksiDariParam({ dari: "2026-04-31" }).dari).toBeUndefined();
  });

  it("OQ_38_dari_lebih_besar_dari_sampai_tidak_diputuskan_klien (backend 422)", () => {
    expect(filterTransaksiDariParam({ dari: "2026-12-01", sampai: "2026-01-01" })).toEqual({
      dari: "2026-12-01",
      sampai: "2026-01-01",
      halaman: 1,
    });
  });

  it("OQ_37_status_pilihan_saling_lepas_sesuai_backend", () => {
    expect([...STATUS_TRANSAKSI]).toEqual([
      "DIPINJAM",
      "TERLAMBAT",
      "DIKEMBALIKAN",
      "HILANG",
      "RUSAK",
    ]);
    for (const s of STATUS_TRANSAKSI) expect(backend).toContain(`"${s}"`);
  });

  it("IR_UI_03_label_opsi_status_transaksi_persis (Terlambat hanya sebagai label filter)", () => {
    expect(OPSI_STATUS_TRANSAKSI).toEqual([
      { nilai: "", label: "Semua status" },
      { nilai: "DIPINJAM", label: "Dipinjam" },
      { nilai: "TERLAMBAT", label: "Terlambat" },
      { nilai: "DIKEMBALIKAN", label: "Dikembalikan" },
      { nilai: "HILANG", label: "Hilang" },
      { nilai: "RUSAK", label: "Rusak" },
    ]);
  });
});

describe("Filter laporan tagihan (FR-LAP-03, OQ-11, OQ-39)", () => {
  it("FR_LAP_03_filter_tagihan_dari_param", () => {
    expect(
      filterTagihanDariParam({
        dari: "2026-10-01",
        sampai: "2026-10-31",
        jenis: "PENGGANTIAN",
        status: "LUNAS",
        cara: "BUKU_PENGGANTI",
        halaman: "2",
      }),
    ).toEqual({
      dari: "2026-10-01",
      sampai: "2026-10-31",
      jenis: "PENGGANTIAN",
      status: "LUNAS",
      cara: "BUKU_PENGGANTI",
      halaman: 2,
    });
  });

  it("FR_LAP_03_nilai_di_luar_kontrak_dibuang (E-Wallet, Proses, Dibebaskan, TERLAMBAT)", () => {
    expect(
      filterTagihanDariParam({
        jenis: "TERLAMBAT",
        status: "PROSES",
        cara: "E_WALLET",
        dari: "kemarin",
      }),
    ).toEqual({ halaman: 1 });
    expect(filterTagihanDariParam({ cara: "DIBEBASKAN" }).cara).toBeUndefined();
  });

  it("FR_LAP_03_opsi_sesuai_kontrak_backend_dan_label_persis", () => {
    for (const v of [
      "DENDA",
      "PENGGANTIAN",
      "BELUM_LUNAS",
      "LUNAS",
      "TUNAI",
      "TRANSFER",
      "BUKU_PENGGANTI",
    ]) {
      expect(backend).toContain(`"${v}"`);
    }
    expect(OPSI_JENIS_LAPORAN.map((o) => o.label)).toEqual(["Semua jenis", "Denda", "Penggantian"]);
    expect(OPSI_STATUS_TAGIHAN_LAPORAN.map((o) => o.label)).toEqual([
      "Semua status",
      "Belum Lunas",
      "Lunas",
    ]);
    expect(OPSI_CARA_LAPORAN.map((o) => o.label)).toEqual([
      "Semua metode",
      "Tunai",
      "Transfer",
      "Buku Pengganti",
    ]);
  });
});

describe("Query daftar & ekspor memakai filter aktif yang sama (FR-LAP-04)", () => {
  const ftrx = {
    dari: "2026-10-01",
    sampai: "2026-10-31",
    status: "TERLAMBAT" as const,
    halaman: 4,
  };
  const ftgh = {
    dari: "2026-10-01",
    sampai: "2026-10-31",
    jenis: "DENDA" as const,
    status: "BELUM_LUNAS" as const,
    cara: "TUNAI" as const,
    halaman: 2,
  };

  it("FR_LAP_02_query_daftar_urutan_filter_lalu_halaman", () => {
    expect(queryTransaksi(ftrx)).toBe(
      "dari=2026-10-01&sampai=2026-10-31&status=TERLAMBAT&halaman=4",
    );
    expect(queryTransaksi({ halaman: 1 })).toBe("halaman=1");
    expect(queryTagihan(ftgh)).toBe(
      "dari=2026-10-01&sampai=2026-10-31&jenis=DENDA&status=BELUM_LUNAS&cara=TUNAI&halaman=2",
    );
  });

  it("FR_LAP_04_url_ekspor_transaksi_memuat_filter_aktif_dan_format", () => {
    expect(urlEksporTransaksi(ftrx, "pdf")).toBe(
      "/api/v1/admin/laporan/transaksi/ekspor?dari=2026-10-01&sampai=2026-10-31&status=TERLAMBAT&format=pdf",
    );
    expect(urlEksporTransaksi(ftrx, "xlsx")).toBe(
      "/api/v1/admin/laporan/transaksi/ekspor?dari=2026-10-01&sampai=2026-10-31&status=TERLAMBAT&format=xlsx",
    );
  });

  it("FR_LAP_04_url_ekspor_tagihan_memuat_filter_aktif_dan_format", () => {
    expect(urlEksporTagihan(ftgh, "xlsx")).toBe(
      "/api/v1/admin/laporan/tagihan/ekspor?dari=2026-10-01&sampai=2026-10-31&jenis=DENDA&status=BELUM_LUNAS&cara=TUNAI&format=xlsx",
    );
  });

  it("FR_LAP_04_ekspor_semua_baris_tanpa_halaman_dan_tanpa_filter_hanya_format", () => {
    expect(urlEksporTransaksi({ halaman: 7 }, "pdf")).toBe(
      "/api/v1/admin/laporan/transaksi/ekspor?format=pdf",
    );
    expect(urlEksporTagihan({ halaman: 7 }, "pdf")).not.toContain("halaman");
    expect(urlEksporTransaksi(ftrx, "pdf")).not.toContain("halaman");
  });

  it("FR_LAP_04_daftar_dan_ekspor_berbagi_satu_penyusun_filter", () => {
    expect(queryTransaksi(ftrx)).toBe(`${paramFilterTransaksi(ftrx).toString()}&halaman=4`);
    expect(urlEksporTransaksi(ftrx, "pdf")).toContain(paramFilterTransaksi(ftrx).toString());
    expect(queryTagihan(ftgh)).toBe(`${paramFilterTagihan(ftgh).toString()}&halaman=2`);
    expect(urlEksporTagihan(ftgh, "pdf")).toContain(paramFilterTagihan(ftgh).toString());
  });

  it("FR_LAP_04_parameter_backend_ekspor_bernama_format_dan_filter_yang_sama", () => {
    for (const nama of ["dari", "sampai", "status", "jenis", "cara", "format"]) {
      expect(backend).toMatch(new RegExp(`\\b${nama}\\b`));
    }
  });

  it("FR_LAP_02_paginasi_mempertahankan_filter_tanpa_nilai_kosong", () => {
    expect(paramsPaginasi(ftrx)).toEqual({
      dari: "2026-10-01",
      sampai: "2026-10-31",
      status: "TERLAMBAT",
    });
    expect(paramsPaginasi({ halaman: 1 })).toEqual({});
    expect(paramsPaginasi(ftgh)).toEqual({
      dari: "2026-10-01",
      sampai: "2026-10-31",
      jenis: "DENDA",
      status: "BELUM_LUNAS",
      cara: "TUNAI",
    });
  });
});

describe("Dashboard (FR-LAP-01, OQ-40)", () => {
  it("OQ_40_urutan_tampil_keempat_status_eksemplar_tersedia_dipinjam_hilang_rusak", () => {
    expect([...URUT_STATUS_EKSEMPLAR]).toEqual(["TERSEDIA", "DIPINJAM", "HILANG", "RUSAK"]);
  });

  it("FR_LAP_01_urutkanEksemplar_mengikuti_urutan_tetap_dan_membawa_nol_dari_api", () => {
    expect(urutkanEksemplar({ RUSAK: 15, HILANG: 0, DIPINJAM: 312, TERSEDIA: 4120 })).toEqual([
      { status: "TERSEDIA", jumlah: 4120 },
      { status: "DIPINJAM", jumlah: 312 },
      { status: "HILANG", jumlah: 0 },
      { status: "RUSAK", jumlah: 15 },
    ]);
  });

  it("OQ_40_status_hilang_dari_api_bukan_nol: tidak diisi 0 (bug kontrak, bukan jumlah nol)", () => {
    expect(urutkanEksemplar({ TERSEDIA: 5, RUSAK: 2 })).toEqual([
      { status: "TERSEDIA", jumlah: 5 },
      { status: "DIPINJAM", jumlah: null },
      { status: "HILANG", jumlah: null },
      { status: "RUSAK", jumlah: 2 },
    ]);
    expect(urutkanEksemplar({})).toHaveLength(4);
  });

  it("FR_LAP_01_urutkanEksemplar_tanpa_menjumlahkan (hanya empat baris, tanpa total)", () => {
    const hasil = urutkanEksemplar({ TERSEDIA: 1, DIPINJAM: 2, HILANG: 3, RUSAK: 4 });
    expect(hasil).toHaveLength(4);
    expect(hasil.map((h) => h.jumlah)).toEqual([1, 2, 3, 4]);
  });
});

describe("Ringkasan eksemplar dashboard (FR-LAP-01, keputusan Ayen 10/10/2026)", () => {
  it("FR_LAP_01_ringkasEksemplar_total_jumlah_empat_status_dan_persen_dibulatkan", () => {
    const r = ringkasEksemplar({ TERSEDIA: 3120, DIPINJAM: 980, HILANG: 120, RUSAK: 100 });
    expect(r.total).toBe(4320);
    expect(r.baris).toEqual([
      { status: "TERSEDIA", jumlah: 3120, persen: 72 },
      { status: "DIPINJAM", jumlah: 980, persen: 23 },
      { status: "HILANG", jumlah: 120, persen: 3 },
      { status: "RUSAK", jumlah: 100, persen: 2 },
    ]);
  });

  it("FR_LAP_01_ringkasEksemplar_total_nol_tanpa_persen_dan_tanpa_NaN", () => {
    const r = ringkasEksemplar({ TERSEDIA: 0, DIPINJAM: 0, HILANG: 0, RUSAK: 0 });
    expect(r.total).toBe(0);
    expect(r.baris.map((b) => b.persen)).toEqual([null, null, null, null]);
  });

  it("OQ_40_ringkasEksemplar_satu_status_tidak_dikirim_total_dan_persen_null", () => {
    const r = ringkasEksemplar({ TERSEDIA: 5, DIPINJAM: 1, RUSAK: 2 });
    expect(r.total).toBeNull();
    expect(r.baris.map((b) => b.jumlah)).toEqual([5, 1, null, 2]);
    expect(r.baris.map((b) => b.persen)).toEqual([null, null, null, null]);
  });
});

describe("Segmen donut status eksemplar (hanya geometri tampilan)", () => {
  const KELILING = 100;

  it("segmen_mengisi_keliling_dikurangi_celah_dan_berurutan", () => {
    const s = segmenDonut([50, 30, 20], KELILING, 2);
    expect(s).toEqual([
      { indeks: 0, panjang: 48, mulai: 0 },
      { indeks: 1, panjang: 28, mulai: 50 },
      { indeks: 2, panjang: 18, mulai: 80 },
    ]);
    const terisi = s.reduce((a, x) => a + x.panjang, 0) + s.length * 2;
    expect(terisi).toBeCloseTo(KELILING);
  });

  it("segmen_bernilai_nol_dilewati_tanpa_menggeser_indeks", () => {
    const s = segmenDonut([60, 0, 40, 0], KELILING, 2);
    expect(s.map((x) => x.indeks)).toEqual([0, 2]);
    expect(s[1].mulai).toBe(60);
  });

  it("satu_status_100_persen_lingkaran_penuh_tanpa_celah", () => {
    expect(segmenDonut([0, 7, 0, 0], KELILING, 2)).toEqual([
      { indeks: 1, panjang: KELILING, mulai: 0 },
    ]);
  });

  it("segmen_lebih_kecil_dari_celah_tidak_negatif", () => {
    const s = segmenDonut([999, 1], KELILING, 2);
    expect(s.every((x) => x.panjang >= 0)).toBe(true);
  });

  it("semua_nol_atau_ada_null_tanpa_segmen", () => {
    expect(segmenDonut([0, 0, 0, 0], KELILING, 2)).toEqual([]);
    expect(segmenDonut([5, null, 1, 0], KELILING, 2)).toEqual([]);
  });
});

describe("formatAngka (hitungan dashboard, NFR-USA-02)", () => {
  it.each([
    [0, "0"],
    [7, "7"],
    [312, "312"],
    [1000, "1.000"],
    [4120, "4.120"],
    [1234567, "1.234.567"],
  ])("formatAngka(%i) = %s", (n, teks) => {
    expect(formatAngka(n)).toBe(teks);
  });

  it.each([-1, 1.5, Number.NaN])("menolak bukan bilangan bulat tak negatif: %s", (n) => {
    expect(() => formatAngka(n)).toThrow();
  });
});

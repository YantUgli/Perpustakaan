import { describe, expect, it } from "vitest";

import {
  adaFilter,
  chipFilter,
  filterKatalogDariParam,
  paramsPaginasi,
  queryKatalog,
  tautanKategori,
  teksJudulHasil,
  teksKetersediaan,
  teksRak,
  urlKatalog,
  urlReset,
  urlUrutan,
} from "./katalog";

describe("Katalog publik — logika tampilan", () => {
  it("OQ_24_q_dari_url_apa_adanya_tanpa_trim_dan_halaman_valid", () => {
    expect(filterKatalogDariParam({ q: "  978-602 ", halaman: "3" })).toEqual({
      q: "  978-602 ",
      halaman: 3,
    });
    expect(filterKatalogDariParam({ q: "", halaman: "0" })).toEqual({ halaman: 1 });
    expect(filterKatalogDariParam({ q: ["a", "b"] })).toEqual({ halaman: 1 });
  });

  it("FR_KTL_02_q_di_encode_dalam_query_api", () => {
    expect(queryKatalog({ q: "Bumi & Langit/100%", halaman: 2 })).toBe(
      "q=Bumi+%26+Langit%2F100%25&halaman=2",
    );
    expect(queryKatalog({ halaman: 1 })).toBe("halaman=1");
  });

  it("OQ_43_tautan_kategori_ke_katalog_kategori_id", () => {
    expect(tautanKategori(12)).toBe("/katalog?kategori_id=12");
  });

  it("FR_KTL_03_teks_x_dari_y_dari_field_api", () => {
    expect(teksKetersediaan({ tersedia: 2, total: 5 })).toBe("2 dari 5 eksemplar tersedia");
    expect(teksKetersediaan({ tersedia: 1200, total: 1500 })).toBe(
      "1.200 dari 1.500 eksemplar tersedia",
    );
  });

  it("FR_KTL_05_ketersediaan_ringkas_kartu_beranda", () => {
    expect(teksKetersediaan({ tersedia: 2, total: 5 }, true)).toBe("2 dari 5 tersedia");
    expect(teksKetersediaan({ tersedia: 1200, total: 1500 }, true)).toBe(
      "1.200 dari 1.500 tersedia",
    );
    expect(teksKetersediaan({ tersedia: 0, total: 0 }, true)).toBe("0 dari 0 tersedia");
  });

  it("OQ_23_judul_tanpa_eksemplar_nol_dari_nol", () => {
    expect(teksKetersediaan({ tersedia: 0, total: 0 })).toBe("0 dari 0 eksemplar tersedia");
  });

  it("OQ_22_rak_kode_plus_lokasi_bila_ada", () => {
    expect(teksRak({ kode: "R-01", lokasi: "Lantai 1" })).toBe("R-01 (Lantai 1)");
    expect(teksRak({ kode: "R-02", lokasi: null })).toBe("R-02");
  });
});

describe("Katalog publik — filter & urutan (OQ-44)", () => {
  const SEMUA = {
    q: "sejarah & budaya",
    kategori_id: ["3", "12"],
    tersedia: "true",
    tahun_dari: "2000",
    tahun_sampai: "2020",
    urut: "tahun_terbaru",
    halaman: "4",
  };

  it("OQ_44_parse_kategori_id_berulang_angka_saja_tanpa_duplikat", () => {
    expect(
      filterKatalogDariParam({ kategori_id: ["12", "abc", "3", "12", "", "-1", "4.5"] }),
    ).toEqual({
      halaman: 1,
      kategori_id: ["12", "3"],
    });
    expect(filterKatalogDariParam({ kategori_id: "7" })).toEqual({
      halaman: 1,
      kategori_id: ["7"],
    });
  });

  it("OQ_44_parse_tersedia_hanya_true", () => {
    expect(filterKatalogDariParam({ tersedia: "true" })).toEqual({ halaman: 1, tersedia: true });
    for (const v of ["false", "1", "True", "", ["true", "true"]]) {
      expect(filterKatalogDariParam({ tersedia: v })).toEqual({ halaman: 1 });
    }
  });

  it("OQ_44_parse_urut_tidak_sah_dibuang_dan_bawaan_tidak_disimpan", () => {
    expect(filterKatalogDariParam({ urut: "tahun_terlama" })).toEqual({
      halaman: 1,
      urut: "tahun_terlama",
    });
    for (const v of ["judul_za", "acak", "TAHUN_TERBARU", "judul_az", ""]) {
      expect(filterKatalogDariParam({ urut: v })).toEqual({ halaman: 1 });
    }
  });

  it("OQ_44_parse_tahun_tidak_kosong_diteruskan_apa_adanya", () => {
    // Keputusan Ayen: backend yang menolak (IR-UI-04), bukan filter yang diam-diam diabaikan.
    expect(filterKatalogDariParam({ tahun_dari: "abc", tahun_sampai: "0" })).toEqual({
      halaman: 1,
      tahun_dari: "abc",
      tahun_sampai: "0",
    });
    expect(filterKatalogDariParam({ tahun_dari: "2024", tahun_sampai: "2020" })).toEqual({
      halaman: 1,
      tahun_dari: "2024",
      tahun_sampai: "2020",
    });
    expect(filterKatalogDariParam({ tahun_dari: "", tahun_sampai: ["1", "2"] })).toEqual({
      halaman: 1,
    });
  });

  it("OQ_44_query_api_urutan_stabil_dan_judul_az_tidak_dikirim", () => {
    const f = filterKatalogDariParam(SEMUA);
    expect(queryKatalog(f)).toBe(
      "q=sejarah+%26+budaya&kategori_id=3&kategori_id=12&tersedia=true&tahun_dari=2000" +
        "&tahun_sampai=2020&urut=tahun_terbaru&halaman=4",
    );
    expect(queryKatalog(filterKatalogDariParam({ urut: "judul_az", tahun_dari: "abc" }))).toBe(
      "tahun_dari=abc&halaman=1",
    );
  });

  it("OQ_44_ada_filter_hanya_kategori_tersedia_tahun", () => {
    expect(adaFilter(filterKatalogDariParam({ q: "x", urut: "tahun_terlama" }))).toBe(false);
    expect(adaFilter(filterKatalogDariParam({ kategori_id: "1" }))).toBe(true);
    expect(adaFilter(filterKatalogDariParam({ tersedia: "true" }))).toBe(true);
    expect(adaFilter(filterKatalogDariParam({ tahun_sampai: "2000" }))).toBe(true);
  });

  it("OQ_44_url_katalog_tanpa_halaman_kembali_ke_halaman_1", () => {
    const f = filterKatalogDariParam(SEMUA);
    expect(urlKatalog(f)).toBe(
      "/katalog?q=sejarah+%26+budaya&kategori_id=3&kategori_id=12&tersedia=true&tahun_dari=2000" +
        "&tahun_sampai=2020&urut=tahun_terbaru",
    );
    expect(urlKatalog({ halaman: 1 })).toBe("/katalog");
  });

  it("OQ_44_reset_mempertahankan_q_saja", () => {
    expect(urlReset(filterKatalogDariParam(SEMUA))).toBe("/katalog?q=sejarah+%26+budaya");
    expect(urlReset(filterKatalogDariParam({ kategori_id: "1", urut: "tahun_terlama" }))).toBe(
      "/katalog",
    );
  });

  it("OQ_44_urutan_ganti_ke_halaman_1_dan_judul_az_menghapus_urut", () => {
    const f = filterKatalogDariParam({ ...SEMUA, urut: "tahun_terlama" });
    expect(urlUrutan(f, "tahun_terbaru")).toBe(urlKatalog({ ...f, urut: "tahun_terbaru" }));
    expect(urlUrutan(f, "judul_az")).not.toContain("urut=");
    expect(urlUrutan(f, "judul_az")).not.toContain("halaman=");
  });

  it("OQ_44_chip_hapus_satu_parameter_saja", () => {
    const f = filterKatalogDariParam(SEMUA);
    const kategori = [
      { id: 3, nama: "Sejarah" },
      { id: 5, nama: "Sains" },
    ];
    const chip = chipFilter(f, kategori);
    expect(chip.map((c) => c.label)).toEqual([
      "Kata kunci: sejarah & budaya",
      "Kategori: Sejarah",
      "Kategori tidak dikenal",
      "Tersedia sekarang",
      "Tahun dari: 2000",
      "Tahun sampai: 2020",
    ]);
    const href = Object.fromEntries(chip.map((c) => [c.label, c.href]));
    // Tiap chip membuang tepat satu parameter; sisanya (termasuk urut) tetap, halaman kembali ke 1.
    expect(href["Kata kunci: sejarah & budaya"]).toBe(urlKatalog({ ...f, q: undefined }));
    expect(href["Kategori: Sejarah"]).toBe(urlKatalog({ ...f, kategori_id: ["12"] }));
    expect(href["Kategori tidak dikenal"]).toBe(urlKatalog({ ...f, kategori_id: ["3"] }));
    expect(href["Tersedia sekarang"]).toBe(urlKatalog({ ...f, tersedia: undefined }));
    expect(href["Tahun dari: 2000"]).toBe(urlKatalog({ ...f, tahun_dari: undefined }));
    expect(href["Tahun sampai: 2020"]).toBe(urlKatalog({ ...f, tahun_sampai: undefined }));
    expect(Object.values(href).every((h) => !h.includes("halaman="))).toBe(true);
    expect(chipFilter({ halaman: 1 }, kategori)).toEqual([]);
  });

  it("FR_KTL_04_OQ_44_params_paginasi_membawa_semua_parameter", () => {
    expect(paramsPaginasi(filterKatalogDariParam(SEMUA))).toEqual({
      q: "sejarah & budaya",
      kategori_id: ["3", "12"],
      tersedia: "true",
      tahun_dari: "2000",
      tahun_sampai: "2020",
      urut: "tahun_terbaru",
    });
  });

  it("OQ_44_teks_judul_hasil_menggabungkan_kata_kunci_dan_filter", () => {
    const kategori = [
      { id: 3, nama: "Sejarah" },
      { id: 5, nama: "Sains" },
    ];
    const teks = (p: Record<string, string | string[]>) =>
      teksJudulHasil(filterKatalogDariParam(p), kategori);
    expect(teks({})).toBeUndefined();
    expect(teks({ urut: "tahun_terbaru" })).toBeUndefined(); // urutan bukan filter
    expect(teks({ q: "sejarah" })).toBe("sejarah");
    expect(
      teks({
        q: "jawa",
        kategori_id: ["3", "5", "99"],
        tersedia: "true",
        tahun_dari: "2000",
        tahun_sampai: "2020",
      }),
    ).toBe("jawa, Sejarah, Sains, Kategori tidak dikenal, Tersedia sekarang, tahun 2000–2020");
    expect(teks({ tahun_dari: "2000" })).toBe("tahun 2000 ke atas");
    expect(teks({ tahun_sampai: "2020" })).toBe("tahun 2020 ke bawah");
    expect(teks({ kategori_id: "5", tersedia: "true" })).toBe("Sains, Tersedia sekarang");
  });
});

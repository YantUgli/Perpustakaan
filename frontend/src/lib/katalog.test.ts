import { describe, expect, it } from "vitest";

import {
  filterKatalogDariParam,
  queryKatalog,
  tautanKategori,
  teksKetersediaan,
  teksRak,
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

  it("OQ_43_tautan_kategori_ke_katalog_q_nama_ter_encode", () => {
    expect(tautanKategori("Sains & Teknologi")).toBe("/katalog?q=Sains+%26+Teknologi");
  });

  it("FR_KTL_03_teks_x_dari_y_dari_field_api", () => {
    expect(teksKetersediaan({ tersedia: 2, total: 5 })).toBe("2 dari 5 eksemplar tersedia");
    expect(teksKetersediaan({ tersedia: 1200, total: 1500 })).toBe(
      "1.200 dari 1.500 eksemplar tersedia",
    );
  });

  it("OQ_23_judul_tanpa_eksemplar_nol_dari_nol", () => {
    expect(teksKetersediaan({ tersedia: 0, total: 0 })).toBe("0 dari 0 eksemplar tersedia");
  });

  it("OQ_22_rak_kode_plus_lokasi_bila_ada", () => {
    expect(teksRak({ kode: "R-01", lokasi: "Lantai 1" })).toBe("R-01 (Lantai 1)");
    expect(teksRak({ kode: "R-02", lokasi: null })).toBe("R-02");
  });
});

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  bodyPenyelesaian,
  caraTersedia,
  filterDariParam,
  pesanSukses,
  queryDaftar,
  validasiPenyelesaian,
} from "./tagihan-admin";

describe("filterDariParam (FR-TGH-01, OQ-29)", () => {
  it("OQ_29_filter_dari_param: nilai sah dipertahankan", () => {
    expect(
      filterDariParam({ status: "LUNAS", jenis: "DENDA", anggota: " agt-000123 ", halaman: "2" }),
    ).toEqual({ status: "LUNAS", jenis: "DENDA", anggota: "agt-000123", halaman: 2 });
  });

  it("status/jenis tak dikenal dibuang; anggota kosong dibuang; halaman tidak sah → 1", () => {
    expect(
      filterDariParam({ status: "PROSES", jenis: "E-WALLET", anggota: "   ", halaman: "abc" }),
    ).toEqual({ halaman: 1 });
    expect(filterDariParam({ status: ["LUNAS", "BELUM_LUNAS"] })).toEqual({ halaman: 1 });
  });

  it("anggota tidak dinormalisasi huruf (backend yang menormalisasi, OQ-29)", () => {
    expect(filterDariParam({ anggota: "agt-000123" }).anggota).toBe("agt-000123");
  });
});

describe("queryDaftar", () => {
  it("hanya filter yang terisi; halaman selalu ada", () => {
    expect(queryDaftar({ halaman: 1 })).toBe("halaman=1");
    expect(queryDaftar({ status: "BELUM_LUNAS", anggota: "AGT-000001", halaman: 3 })).toBe(
      "status=BELUM_LUNAS&anggota=AGT-000001&halaman=3",
    );
  });

  it("nilai anggota di-encode", () => {
    expect(queryDaftar({ anggota: "AGT 1&x", halaman: 1 })).toBe("anggota=AGT+1%26x&halaman=1");
  });
});

describe("caraTersedia (FR-TGH-02/03)", () => {
  it("FR_TGH_03_buku_pengganti_hanya_untuk_penggantian", () => {
    expect(caraTersedia("DENDA")).toEqual(["TUNAI", "TRANSFER"]);
    expect(caraTersedia("PENGGANTIAN")).toEqual(["TUNAI", "TRANSFER", "BUKU_PENGGANTI"]);
  });
});

describe("validasiPenyelesaian (FR-TGH-02/03, OQ-28) — kecocokan nominal diputuskan backend", () => {
  const tagihan = { nominal: 35555 };

  it("cara & tanggal wajib", () => {
    expect(validasiPenyelesaian({ cara: "", nominal: "", tanggal: "" }, tagihan)).toEqual({
      cara: "Pilih cara penyelesaian.",
      tanggal: "Tanggal penyelesaian wajib diisi.",
    });
  });

  it("FR_TGH_02_nominal_wajib_untuk_tunai_transfer (pesan sama dengan backend)", () => {
    for (const cara of ["TUNAI", "TRANSFER"] as const) {
      expect(
        validasiPenyelesaian({ cara, nominal: "", tanggal: "2026-10-05" }, tagihan).nominal,
      ).toBe("Nominal pembayaran wajib diisi (Rp35.555).");
    }
  });

  it("nominal harus bilangan bulat Rupiah tanpa tanda baca; pesan menyebut nominal tagihan", () => {
    for (const nominal of ["35.555", "35555.5", "-1", "abc", "1e5"]) {
      expect(
        validasiPenyelesaian({ cara: "TUNAI", nominal, tanggal: "2026-10-05" }, tagihan).nominal,
      ).toBe("Nominal harus berupa angka Rupiah bulat tanpa titik atau koma (Rp35.555).");
    }
  });

  it("FR_TGH_02_tidak_membandingkan_nominal_dengan_tagihan (keputusan di backend)", () => {
    expect(
      validasiPenyelesaian({ cara: "TUNAI", nominal: "10000", tanggal: "2026-10-05" }, tagihan),
    ).toEqual({});
  });

  it("OQ_08_buku_pengganti_tanpa_nominal; label tanggal penerimaan", () => {
    expect(
      validasiPenyelesaian({ cara: "BUKU_PENGGANTI", nominal: "", tanggal: "" }, tagihan),
    ).toEqual({ tanggal: "Tanggal penerimaan buku wajib diisi." });
  });

  it("OQ_28_tidak_menghitung_batas_hari_ini_di_klien", () => {
    expect(
      validasiPenyelesaian({ cara: "TRANSFER", nominal: "35555", tanggal: "2999-01-01" }, tagihan),
    ).toEqual({});
  });
});

describe("bodyPenyelesaian (OQ-08)", () => {
  it("Tunai/Transfer membawa nominal integer", () => {
    expect(bodyPenyelesaian({ cara: "TUNAI", nominal: "35555", tanggal: "2026-10-05" })).toEqual({
      cara: "TUNAI",
      nominal: 35555,
      tanggal: "2026-10-05",
    });
  });

  it("Buku Pengganti tanpa nominal sama sekali", () => {
    expect(
      bodyPenyelesaian({ cara: "BUKU_PENGGANTI", nominal: "35555", tanggal: "2026-10-05" }),
    ).toEqual({ cara: "BUKU_PENGGANTI", tanggal: "2026-10-05" });
  });
});

describe("pesanSukses (P3, FR-TGH-04, Brief §6.5)", () => {
  it("Tunai/Transfer", () => {
    expect(pesanSukses("TUNAI", "EKS-000012")).toBe("Tagihan telah lunas.");
    expect(pesanSukses("TRANSFER", "EKS-000012")).toBe("Tagihan telah lunas.");
  });

  it("Buku Pengganti menyebut kode eksemplar & pengingat label", () => {
    expect(pesanSukses("BUKU_PENGGANTI", "EKS-000012")).toBe(
      "Tagihan telah lunas. Eksemplar EKS-000012 kembali berstatus Tersedia dengan kode yang sama; " +
        "pasang label EKS-000012 pada buku pengganti.",
    );
  });
});

describe("pesan sama dengan backend/app/services/tagihan.py", () => {
  it("pesan_nominal_wajib_sama_dengan_backend", () => {
    const sumber = readFileSync(
      fileURLToPath(new URL("../../../backend/app/services/tagihan.py", import.meta.url)),
      "utf8",
    );
    const pola = 'f"Nominal pembayaran wajib diisi ({format_rupiah(t.nominal)})."';
    if (!sumber.includes(pola)) {
      throw new Error(`Teks ${pola} tidak ditemukan di backend/app/services/tagihan.py`);
    }
  });
});

describe("setiap pesan galat nominal menyebut nominal tagihan (keterangan tersembunyi saat galat)", () => {
  it.each(["", "35.555", "abc"])("nominal %j", (nominal) => {
    const pesan = validasiPenyelesaian(
      { cara: "TUNAI", nominal, tanggal: "2026-10-05" },
      { nominal: 1250000 },
    ).nominal;
    expect(pesan).toContain("Rp1.250.000");
  });
});

import { describe, expect, it } from "vitest";

import {
  bodyKategori,
  bodyRak,
  bodyUbahAnggota,
  filterAnggotaDariParam,
  pesanSuksesUbahAnggota,
  queryAnggota,
  validasiKategori,
  validasiRak,
  validasiUbahAnggota,
} from "./data-admin";

const DATA = {
  nama: "Aulia Rahma",
  alamat: "Jl. Melati 1",
  email: "aulia@contoh.example",
  telepon: "0812",
  password_baru: "",
};

describe("Daftar anggota admin (FR-AKN-10, OQ-33)", () => {
  it("OQ_33_filter_dari_param: q di-trim, halaman sah dipertahankan", () => {
    expect(filterAnggotaDariParam({ q: "  Aulia ", halaman: "3" })).toEqual({
      q: "Aulia",
      halaman: 3,
    });
  });

  it("OQ_33_q_kosong_atau_array_dibuang; halaman tak sah → 1", () => {
    expect(filterAnggotaDariParam({ q: "   ", halaman: "0" })).toEqual({ halaman: 1 });
    expect(filterAnggotaDariParam({ q: ["a", "b"] })).toEqual({ halaman: 1 });
  });

  it("OQ_33_q_tidak_dinormalisasi_di_klien (backend yang mencocokkan kode/NIK)", () => {
    expect(filterAnggotaDariParam({ q: "agt-000001" }).q).toBe("agt-000001");
  });

  it("FR_AKN_10_query_daftar: urutan q lalu halaman, q di-encode", () => {
    expect(queryAnggota({ q: "Budi & Ani", halaman: 2 })).toBe("q=Budi+%26+Ani&halaman=2");
    expect(queryAnggota({ halaman: 1 })).toBe("halaman=1");
  });
});

describe("Ubah anggota oleh admin (FR-AKN-11, K-03, K-05)", () => {
  it("K_05_body_ubah_anggota_tidak_pernah_memuat_nik_kode_foto", () => {
    // Walau nilai asing terselip di objek sumber, body hanya memuat isian yang boleh diubah.
    const sumber = {
      ...DATA,
      password_baru: "rahasia123",
      nik: "3171000000000001",
      kode: "AGT-000001",
      foto: "x.jpg",
    };
    const body = bodyUbahAnggota(sumber);
    expect(Object.keys(body).sort()).toEqual(
      ["alamat", "email", "nama", "password_baru", "telepon"].sort(),
    );
    for (const dilarang of ["nik", "kode", "foto", "id"]) expect(body).not.toHaveProperty(dilarang);
  });

  it("K_03_password_baru_kosong_tidak_dikirim", () => {
    const body = bodyUbahAnggota(DATA);
    expect(body).not.toHaveProperty("password_baru");
    expect(Object.keys(body).sort()).toEqual(["alamat", "email", "nama", "telepon"]);
  });

  it("K_03_password_baru_diisi_dikirim_apa_adanya (tidak di-trim)", () => {
    expect(bodyUbahAnggota({ ...DATA, password_baru: " abc 12345 " }).password_baru).toBe(
      " abc 12345 ",
    );
  });

  it("FR_AKN_11_validasi_wajib_dan_email (pesan sama dengan backend)", () => {
    expect(validasiUbahAnggota({ ...DATA, nama: " ", email: "salah" })).toEqual({
      nama: "Nama wajib diisi.",
      email: "Format email tidak valid.",
    });
  });

  it("NFR_SEC_02_password_baru_diisi_kurang_8_ditahan; kosong boleh; tepat 8 boleh", () => {
    expect(validasiUbahAnggota({ ...DATA, password_baru: "1234567" })).toEqual({
      password_baru: "Password baru minimal 8 karakter.",
    });
    expect(validasiUbahAnggota({ ...DATA, password_baru: "" })).toEqual({});
    expect(validasiUbahAnggota({ ...DATA, password_baru: "12345678" })).toEqual({});
  });

  it("OQ_32_pesan_sukses_menyebut_sesi_diakhiri_hanya_bila_password_diubah", () => {
    expect(pesanSuksesUbahAnggota(false)).toBe("Data anggota berhasil disimpan.");
    const dgPassword = pesanSuksesUbahAnggota(true);
    expect(dgPassword).toContain("Data anggota berhasil disimpan.");
    expect(dgPassword).toContain("Password baru ditetapkan");
    expect(dgPassword).toContain("semua sesi anggota ini diakhiri");
  });
});

describe("Kategori & rak (FR-BKU-01, DR-03/04, OQ-08)", () => {
  it("FR_BKU_01_kategori_nama_wajib_trim", () => {
    expect(validasiKategori({ nama: "  " })).toEqual({ nama: "Nama wajib diisi." });
    expect(validasiKategori({ nama: "Sastra" })).toEqual({});
    expect(bodyKategori({ nama: "  Sastra " })).toEqual({ nama: "Sastra" });
  });

  it("OQ_08_rak_kode_wajib_lokasi_opsional", () => {
    expect(validasiRak({ kode: "", lokasi: "Lantai 1" })).toEqual({ kode: "Kode wajib diisi." });
    expect(validasiRak({ kode: "R-01", lokasi: "" })).toEqual({});
  });

  it("OQ_08_body_rak_lokasi_kosong_menjadi_null_dan_teks_di_trim", () => {
    expect(bodyRak({ kode: " R-01 ", lokasi: "   " })).toEqual({ kode: "R-01", lokasi: null });
    expect(bodyRak({ kode: "R-02", lokasi: " Lantai 2 " })).toEqual({
      kode: "R-02",
      lokasi: "Lantai 2",
    });
  });
});

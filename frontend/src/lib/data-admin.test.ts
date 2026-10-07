import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  UKURAN_MAKS_COVER,
  aksiEksemplar,
  bacaBulat,
  bodyJudul,
  bodyKategori,
  bodyRak,
  bodyTambahEksemplar,
  bodyUbahAnggota,
  filterAnggotaDariParam,
  pesanCoverGagal,
  pesanSuksesTambah,
  pesanSuksesUbahAnggota,
  queryAnggota,
  teksKonfirmasiTambah,
  validasiJudul,
  validasiKategori,
  validasiRak,
  validasiTambahEksemplar,
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

const JUDUL = {
  isbn: "978-602-03-1234-5",
  judul: "Langit yang Sama",
  penulis: "Sari Dewi",
  penerbit: "Penerbit Nusa",
  tahun: "2020",
  kategori_id: "3",
  harga: "98000",
};
const berkas = (ukuran: number, type = "image/png") => {
  const f = new File(["x"], "c.png", { type });
  Object.defineProperty(f, "size", { value: ukuran });
  return f;
};

describe("bacaBulat: integer murni tanpa parseFloat (DR-05)", () => {
  it.each([
    ["98000", 98000],
    [" 2020 ", 2020],
    ["0", 0],
    ["0098", 98],
  ])("DR_05_bacaBulat('%s') = %s", (teks, hasil) => {
    expect(bacaBulat(teks)).toBe(hasil);
  });

  it.each(["", "  ", "98.000", "98000,5", "9.8e4", "1e3", "-5", "+5", "12abc", "NaN", "0x10", "٣"])(
    "DR_05_bacaBulat('%s') ditahan (null)",
    (teks) => {
      expect(bacaBulat(teks)).toBeNull();
    },
  );

  it("DR_05_bilangan_melebihi_batas_aman_ditahan", () => {
    expect(bacaBulat("9007199254740993")).toBeNull();
  });
});

describe("Form judul (FR-BKU-02, FR-BKU-03, DR-05, NFR-SEC-06)", () => {
  it("FR_BKU_02_judul_sah_tanpa_galat", () => {
    expect(validasiJudul(JUDUL, null)).toEqual({});
  });

  it.each(["isbn", "judul", "penulis", "penerbit"] as const)(
    "FR_BKU_02_%s_kosong_wajib (teks spasi dianggap kosong)",
    (isian) => {
      expect(validasiJudul({ ...JUDUL, [isian]: "  " }, null)[isian]).toMatch(/ wajib diisi\.$/);
    },
  );

  it("FR_BKU_02_kategori_wajib_dipilih", () => {
    expect(validasiJudul({ ...JUDUL, kategori_id: "" }, null).kategori_id).toBe("Pilih kategori.");
  });

  it("DR_05_tahun_dan_harga_wajib_bulat; pecahan, koma, titik ribuan ditahan", () => {
    const g = validasiJudul({ ...JUDUL, tahun: "20.20", harga: "98.000" }, null);
    expect(g.tahun).toBe("Tahun harus berupa bilangan bulat.");
    expect(g.harga).toBe("Harga harus berupa bilangan bulat Rupiah tanpa titik atau koma.");
    expect(validasiJudul({ ...JUDUL, harga: "" }, null).harga).toBe("Harga wajib diisi.");
    expect(validasiJudul({ ...JUDUL, tahun: "" }, null).tahun).toBe("Tahun wajib diisi.");
  });

  it("DR_05_harga_nol_atau_negatif_diserahkan_ke_backend (klien tidak memutuskan aturan harga)", () => {
    expect(validasiJudul({ ...JUDUL, harga: "0" }, null).harga).toBeUndefined();
  });

  it("DR_05_harga_tahun_dikirim_integer: body bertipe number bulat, bukan teks", () => {
    const b = bodyJudul({ ...JUDUL, isbn: " 978 ", harga: " 98000 " });
    expect(b).toEqual({
      isbn: "978",
      judul: "Langit yang Sama",
      penulis: "Sari Dewi",
      penerbit: "Penerbit Nusa",
      tahun: 2020,
      kategori_id: 3,
      harga: 98000,
    });
    for (const k of ["tahun", "kategori_id", "harga"] as const) {
      expect(typeof b[k]).toBe("number");
      expect(Number.isInteger(b[k])).toBe(true);
    }
  });

  it("DR_05_tanpa_parseFloat_di_kode_klien_judul (uang tidak boleh lewat float)", () => {
    for (const rel of ["./data-admin.ts", "../app/admin/judul/FormJudul.tsx"]) {
      const sumber = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
      expect(sumber).not.toMatch(/parseFloat|parseInt|Number\.parseFloat/);
    }
  });

  it("NFR_SEC_06_cover_tepat_2_MB_boleh; lebih 1 byte ditahan", () => {
    expect(UKURAN_MAKS_COVER).toBe(2_097_152);
    expect(validasiJudul(JUDUL, berkas(UKURAN_MAKS_COVER)).cover).toBeUndefined();
    expect(validasiJudul(JUDUL, berkas(UKURAN_MAKS_COVER + 1)).cover).toBe(
      "Ukuran berkas melebihi batas 2 MB.",
    );
  });

  it("NFR_SEC_06_cover_jenis_diketahui_bukan_JPG_PNG_ditahan; jenis kosong diserahkan ke backend", () => {
    expect(validasiJudul(JUDUL, berkas(10, "image/gif")).cover).toBe(
      "Cover harus berupa gambar JPG atau PNG.",
    );
    expect(validasiJudul(JUDUL, berkas(10, "image/jpeg")).cover).toBeUndefined();
    expect(validasiJudul(JUDUL, berkas(10, "")).cover).toBeUndefined();
  });

  it("FR_BKU_02_cover_gagal_pesan_judul_tersimpan", () => {
    expect(pesanCoverGagal("Cover harus berupa gambar JPG atau PNG.")).toBe(
      "Judul tersimpan, tetapi cover gagal diunggah: Cover harus berupa gambar JPG atau PNG.",
    );
  });
});

describe("Tambah eksemplar (FR-BKU-04, OQ-20)", () => {
  it("FR_BKU_04_validasi_jumlah_dan_rak (batas 1–100 diputuskan backend)", () => {
    expect(validasiTambahEksemplar({ jumlah: "5", rak_id: "2" })).toEqual({});
    expect(validasiTambahEksemplar({ jumlah: "", rak_id: "" })).toEqual({
      jumlah: "Jumlah eksemplar wajib diisi.",
      rak_id: "Pilih rak.",
    });
    expect(validasiTambahEksemplar({ jumlah: "2.5", rak_id: "2" }).jumlah).toBe(
      "Jumlah eksemplar harus berupa bilangan bulat.",
    );
    expect(validasiTambahEksemplar({ jumlah: "500", rak_id: "2" })).toEqual({});
    expect(validasiTambahEksemplar({ jumlah: "0", rak_id: "2" })).toEqual({});
  });

  it("FR_BKU_04_body_tambah_integer", () => {
    expect(bodyTambahEksemplar({ jumlah: " 5 ", rak_id: "2" })).toEqual({ jumlah: 5, rak_id: 2 });
  });

  it("OQ_20_teks_konfirmasi_menyebut_jumlah_judul_rak_dan_tak_dapat_dihapus", () => {
    const t = teksKonfirmasiTambah({ jumlah: 5, judul: "Langit yang Sama", rak: "R-01" });
    expect(t).toContain("5 eksemplar");
    expect(t).toContain("Langit yang Sama");
    expect(t).toContain("R-01");
    expect(t).toContain("tidak dapat dihapus");
  });

  it("FR_BKU_04_pesan_sukses_rentang_kode", () => {
    expect(pesanSuksesTambah(["EKS-000012"])).toBe("1 eksemplar ditambahkan: EKS-000012.");
    expect(pesanSuksesTambah(["EKS-000012", "EKS-000013", "EKS-000016"])).toBe(
      "3 eksemplar ditambahkan: EKS-000012 s.d. EKS-000016.",
    );
  });
});

describe("Aksi eksemplar menurut status (FR-BKU-07/08, K-02, OQ-20)", () => {
  it("FR_BKU_07_tandai_rusak_hanya_untuk_TERSEDIA", () => {
    expect(aksiEksemplar("TERSEDIA")).toEqual({ tandaiRusak: true, keterangan: null });
  });

  it("FR_BKU_08_DIPINJAM_tanpa_tombol_dengan_keterangan_sirkulasi", () => {
    expect(aksiEksemplar("DIPINJAM")).toEqual({
      tandaiRusak: false,
      keterangan: "Diubah lewat sirkulasi",
    });
  });

  it.each(["HILANG", "RUSAK"])("K_02_%s_tanpa_aksi_dan_tanpa_pemulihan", (status) => {
    expect(aksiEksemplar(status)).toEqual({ tandaiRusak: false, keterangan: null });
  });
});

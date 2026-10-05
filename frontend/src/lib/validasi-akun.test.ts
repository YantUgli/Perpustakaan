import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  type NilaiDaftar,
  PANJANG_MIN_PASSWORD,
  PESAN_AKUN,
  UKURAN_MAKS_FOTO,
  validasiDaftar,
  validasiGantiPassword,
  validasiMasuk,
  validasiProfil,
} from "./validasi-akun";

const SAH: NilaiDaftar = {
  nama: "Aulia Rahma",
  alamat: "Jl. Melati No. 12, Jakarta",
  email: "aulia@contoh.example",
  telepon: "0812 3456 7890",
  nik: "3171012345678901",
  password: "rahasia12",
  foto: null,
};

function berkas(ukuran: number, jenis: string, nama = "foto.jpg"): File {
  return new File([new Uint8Array(ukuran)], nama, { type: jenis });
}

describe("validasiDaftar (validasi klien, keputusan tetap di backend)", () => {
  it("data sah tidak menghasilkan galat", () => {
    expect(validasiDaftar(SAH)).toEqual({});
  });

  it.each([
    ["nama", "Nama"],
    ["alamat", "Alamat"],
    ["email", "Email"],
    ["telepon", "Telepon"],
    ["nik", "NIK"],
    ["password", "Password"],
  ] as const)("FR_AKN_01_isian_wajib: %s kosong → '%s wajib diisi.'", (isian, label) => {
    expect(validasiDaftar({ ...SAH, [isian]: "" })[isian]).toBe(`${label} wajib diisi.`);
  });

  it("FR_AKN_01_teks_hanya_spasi_dianggap_kosong (backend men-trim teks)", () => {
    const g = validasiDaftar({ ...SAH, nama: "   ", telepon: " " });
    expect(g.nama).toBe("Nama wajib diisi.");
    expect(g.telepon).toBe("Telepon wajib diisi.");
  });

  it("FR_AKN_01_foto_opsional", () => {
    expect(validasiDaftar({ ...SAH, foto: null }).foto).toBeUndefined();
  });

  it("semua galat dikumpulkan sekaligus (IR-UI-04)", () => {
    const g = validasiDaftar({ ...SAH, nama: "", nik: "123", email: "x", password: "pendek" });
    expect(Object.keys(g).sort()).toEqual(["email", "nama", "nik", "password"]);
  });

  it.each(["317101234567890", "31710123456789012", "317101234567890a", "3171 0123 4567 8901"])(
    "FR_AKN_03_nik_bukan_16_digit_ditolak: %j",
    (nik) => {
      expect(validasiDaftar({ ...SAH, nik }).nik).toBe("NIK harus tepat 16 digit angka.");
    },
  );

  it("FR_AKN_03_nik_16_digit_diterima (spasi tepi di-trim)", () => {
    expect(validasiDaftar({ ...SAH, nik: " 3171012345678901 " }).nik).toBeUndefined();
  });

  it.each(["aulia", "aulia@", "@contoh.example", "aulia@contoh", "au lia@contoh.example"])(
    "FR_AKN_03_email_format_ditolak: %j",
    (email) => {
      expect(validasiDaftar({ ...SAH, email }).email).toBe("Format email tidak valid.");
    },
  );

  it("FR_AKN_03_email_wajar_diterima (pola longgar; backend tetap memutuskan)", () => {
    expect(validasiDaftar({ ...SAH, email: "a.b+c@sub.contoh.example" }).email).toBeUndefined();
  });

  it("NFR_SEC_02_password_minimal_8", () => {
    expect(validasiDaftar({ ...SAH, password: "1234567" }).password).toBe(
      "Password minimal 8 karakter.",
    );
    expect(validasiDaftar({ ...SAH, password: "12345678" }).password).toBeUndefined();
    // Password tidak di-trim (sama dengan backend): 8 karakter termasuk spasi tetap sah.
    expect(validasiDaftar({ ...SAH, password: "  123456" }).password).toBeUndefined();
  });

  it("OQ_31_telepon_tanpa_validasi_format", () => {
    expect(validasiDaftar({ ...SAH, telepon: "abc-123" }).telepon).toBeUndefined();
  });

  it("NFR_SEC_06_foto_ukuran: tepat 2 MB diterima, 1 byte lebih ditolak", () => {
    expect(
      validasiDaftar({ ...SAH, foto: berkas(UKURAN_MAKS_FOTO, "image/jpeg") }).foto,
    ).toBeUndefined();
    expect(validasiDaftar({ ...SAH, foto: berkas(UKURAN_MAKS_FOTO + 1, "image/png") }).foto).toBe(
      "Ukuran berkas melebihi batas 2 MB.",
    );
  });

  it.each(["image/gif", "application/pdf", "image/webp"])(
    "NFR_SEC_06_foto_jenis_dikenal_selain_jpg_png_ditolak: %s",
    (jenis) => {
      expect(validasiDaftar({ ...SAH, foto: berkas(10, jenis, "x") }).foto).toBe(
        "Foto harus berupa gambar JPG atau PNG.",
      );
    },
  );

  it("NFR_SEC_06_foto_type_kosong_dikirim_backend_memutuskan (P3)", () => {
    expect(validasiDaftar({ ...SAH, foto: berkas(10, "", "foto.heic") }).foto).toBeUndefined();
  });

  it("NFR_SEC_06_ukuran_tetap_ditahan_walau_type_kosong", () => {
    expect(validasiDaftar({ ...SAH, foto: berkas(UKURAN_MAKS_FOTO + 1, "") }).foto).toBe(
      "Ukuran berkas melebihi batas 2 MB.",
    );
  });
});

describe("validasiMasuk (FR-AKN-05, OQ-16)", () => {
  it("hanya memeriksa isian wajib; format email tidak diperiksa (satu pesan gagal dari backend)", () => {
    expect(validasiMasuk({ email: "", password: "" })).toEqual({
      email: "Email wajib diisi.",
      password: "Password wajib diisi.",
    });
    expect(validasiMasuk({ email: "bukan-email", password: "x" })).toEqual({});
  });
});

describe("pesan klien sama dengan backend", () => {
  const baca = (p: string) =>
    readFileSync(fileURLToPath(new URL(`../../../backend/${p}`, import.meta.url)), "utf8");

  function harusMemuat(sumber: string, teks: string, berkasPy: string) {
    if (!sumber.includes(teks)) {
      throw new Error(`Teks ${JSON.stringify(teks)} tidak ditemukan di backend/${berkasPy}`);
    }
  }

  it("pesan_klien_sama_dengan_backend", () => {
    const pendaftaran = baca("app/services/pendaftaran.py");
    const berkasPy = baca("app/services/berkas.py");
    const validasi = baca("app/core/validasi.py");

    harusMemuat(pendaftaran, `"${PESAN_AKUN.nik}"`, "app/services/pendaftaran.py");
    harusMemuat(pendaftaran, `"${PESAN_AKUN.email}"`, "app/services/pendaftaran.py");
    harusMemuat(pendaftaran, 'f"{LABEL_ISIAN[k]} wajib diisi."', "app/services/pendaftaran.py");
    harusMemuat(
      pendaftaran,
      'f"Password minimal {PANJANG_MIN_PASSWORD} karakter."',
      "app/services/pendaftaran.py",
    );
    harusMemuat(berkasPy, `"${PESAN_AKUN.fotoTerlaluBesar}"`, "app/services/berkas.py");
    harusMemuat(berkasPy, 'f"{label} harus berupa gambar JPG atau PNG."', "app/services/berkas.py");
    harusMemuat(pendaftaran, 'label="Foto"', "app/services/pendaftaran.py");

    const min = /^PANJANG_MIN_PASSWORD\s*=\s*(\d+)/m.exec(validasi);
    if (!min)
      throw new Error("PANJANG_MIN_PASSWORD tidak ditemukan di backend/app/core/validasi.py");
    expect(PANJANG_MIN_PASSWORD).toBe(Number(min[1]));

    const maks = /^UKURAN_MAKS_GAMBAR\s*=\s*2 \* 1024 \* 1024/m.exec(berkasPy);
    if (!maks) throw new Error("UKURAN_MAKS_GAMBAR = 2 * 1024 * 1024 tidak ditemukan di berkas.py");
    expect(UKURAN_MAKS_FOTO).toBe(2 * 1024 * 1024);
  });
});

describe("validasiProfil (FR-AKN-07/08, K-05: tanpa NIK & foto)", () => {
  const PROFIL = {
    nama: "Aulia Rahma",
    alamat: "Jl. Melati 12",
    email: "aulia@contoh.example",
    telepon: "0812",
  };

  it("data sah tanpa galat", () => {
    expect(validasiProfil(PROFIL)).toEqual({});
  });

  it("FR_AKN_07_validasi_profil_wajib_setelah_trim", () => {
    expect(validasiProfil({ nama: " ", alamat: "", email: "", telepon: "  " })).toEqual({
      nama: "Nama wajib diisi.",
      alamat: "Alamat wajib diisi.",
      email: "Email wajib diisi.",
      telepon: "Telepon wajib diisi.",
    });
  });

  it("FR_AKN_08_validasi_profil_format_email", () => {
    expect(validasiProfil({ ...PROFIL, email: "aulia@" }).email).toBe("Format email tidak valid.");
  });
});

describe("validasiGantiPassword (FR-AKN-09, NFR-SEC-02)", () => {
  const SAH = { password_lama: "lama-123", password_baru: "baru-1234", konfirmasi: "baru-1234" };

  it("data sah tanpa galat", () => {
    expect(validasiGantiPassword(SAH)).toEqual({});
  });

  it("FR_AKN_09_password_lama_wajib", () => {
    expect(validasiGantiPassword({ ...SAH, password_lama: "" }).password_lama).toBe(
      "Password lama wajib diisi.",
    );
  });

  it("NFR_SEC_02_password_baru_minimal_8 (kosong pun memakai pesan yang sama dengan backend)", () => {
    expect(
      validasiGantiPassword({ ...SAH, password_baru: "1234567", konfirmasi: "1234567" })
        .password_baru,
    ).toBe("Password baru minimal 8 karakter.");
    expect(validasiGantiPassword({ ...SAH, password_baru: "", konfirmasi: "" }).password_baru).toBe(
      "Password baru minimal 8 karakter.",
    );
  });

  it("konfirmasi harus sama (hanya di klien)", () => {
    expect(validasiGantiPassword({ ...SAH, konfirmasi: "beda-1234" }).konfirmasi).toBe(
      "Konfirmasi password tidak sama dengan password baru.",
    );
  });
});

describe("pesan profil & password sama dengan backend/app/services/anggota.py", () => {
  it("pesan_klien_sama_dengan_backend_anggota", () => {
    const sumber = readFileSync(
      fileURLToPath(new URL("../../../backend/app/services/anggota.py", import.meta.url)),
      "utf8",
    );
    for (const teks of [
      '"Password lama wajib diisi."',
      'f"Password baru minimal {PANJANG_MIN_PASSWORD} karakter."',
      'f"{_LABEL[k]} wajib diisi."',
      '"Format email tidak valid."',
    ]) {
      if (!sumber.includes(teks)) {
        throw new Error(`Teks ${teks} tidak ditemukan di backend/app/services/anggota.py`);
      }
    }
  });
});

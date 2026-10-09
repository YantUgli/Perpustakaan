// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = { refresh: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { FormProfil } = await import("./profil/FormProfil");
const { FormPassword, PESAN_PASSWORD_BERHASIL } = await import("./profil/FormPassword");
const { UbahFoto, PESAN_FOTO_BERHASIL, URL_FOTO } = await import("./profil/UbahFoto");

const fetchPalsu = vi.fn();
beforeEach(() => {
  fetchPalsu.mockReset();
  router.refresh.mockReset();
  vi.stubGlobal("fetch", fetchPalsu);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PROFIL = {
  kode: "AGT-000123",
  nama: "Aulia Rahma",
  alamat: "Jl. Melati 12",
  email: "aulia@contoh.example",
  telepon: "0812",
  nik: "3171012345678901",
  tanggal_daftar: "2026-01-12",
  // OQ-42: sengaja true — body PUT tetap 4 isian; `ada_foto` tidak pernah dikirim (extra="forbid" → 422).
  ada_foto: true,
};

const galat = (status: number, kode: string, pesan: string, isian: Record<string, string>) =>
  Response.json({ detail: { kode, pesan, rujukan: "FR-AKN-08", isian } }, { status });

describe("FormProfil (FR-AKN-07/08)", () => {
  it("FR_AKN_07_profil_kirim_hanya_4_field", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ ...PROFIL, nama: "Aulia R." }));
    render(<FormProfil awal={PROFIL} />);
    fireEvent.change(screen.getByLabelText(/Nama Lengkap/), { target: { value: "Aulia R." } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Data Diri" }));
    expect(await screen.findByText("Data diri berhasil disimpan.")).toBeTruthy();
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("/api/v1/anggota/profil");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      nama: "Aulia R.",
      alamat: "Jl. Melati 12",
      email: "aulia@contoh.example",
      telepon: "0812",
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("FR_AKN_08_email_duplikat_per_isian", async () => {
    fetchPalsu.mockResolvedValue(
      galat(409, "AKN_DATA_DUPLIKAT", "Email sudah terdaftar.", {
        email: "Email sudah terdaftar.",
      }),
    );
    render(<FormProfil awal={PROFIL} />);
    fireEvent.click(screen.getByRole("button", { name: "Simpan Data Diri" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Email sudah terdaftar.");
    expect(screen.getByLabelText(/^Email/).getAttribute("aria-invalid")).toBe("true");
  });

  it("validasi klien menahan pengiriman", () => {
    render(<FormProfil awal={PROFIL} />);
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "bukan-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Data Diri" }));
    expect(screen.getByText("Format email tidak valid.")).toBeTruthy();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });
});

describe("FormPassword (FR-AKN-09, OQ-32)", () => {
  function isi(lama: string, baru: string, konfirmasi: string) {
    fireEvent.change(screen.getByLabelText(/^Password Lama/), { target: { value: lama } });
    fireEvent.change(screen.getByLabelText(/^Password Baru/), { target: { value: baru } });
    fireEvent.change(screen.getByLabelText(/^Konfirmasi/), { target: { value: konfirmasi } });
    fireEvent.click(screen.getByRole("button", { name: "Ubah Password" }));
  }

  it("OQ_32_pesan_sesi_lain_diakhiri dan hanya mengirim password lama & baru", async () => {
    fetchPalsu.mockResolvedValue(new Response(null, { status: 204 }));
    render(<FormPassword />);
    isi("lama-1234", "baru-12345", "baru-12345");
    expect(await screen.findByText(PESAN_PASSWORD_BERHASIL)).toBeTruthy();
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("/api/v1/anggota/profil/password");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      password_lama: "lama-1234",
      password_baru: "baru-12345",
    });
    await waitFor(() =>
      expect((screen.getByLabelText(/^Password Lama/) as HTMLInputElement).value).toBe(""),
    );
  });

  it("FR_AKN_09_password_lama_salah_per_isian", async () => {
    fetchPalsu.mockResolvedValue(
      galat(422, "AKN_ISIAN_TIDAK_VALID", "Periksa isian: Password lama.", {
        password_lama: "Password lama salah.",
      }),
    );
    render(<FormPassword />);
    isi("salah-123", "baru-12345", "baru-12345");
    expect(await screen.findByText("Password lama salah.")).toBeTruthy();
    expect(screen.getByLabelText(/^Password Lama/).getAttribute("aria-invalid")).toBe("true");
  });

  it("konfirmasi tidak cocok menahan pengiriman", () => {
    render(<FormPassword />);
    isi("lama-1234", "baru-12345", "beda-12345");
    expect(screen.getByText("Konfirmasi password tidak sama dengan password baru.")).toBeTruthy();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("tiga_tombol_mata_saling_bebas_menggantikan_checkbox", () => {
    render(<FormPassword />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    const isian = {
      lama: screen.getByLabelText(/^Password Lama/) as HTMLInputElement,
      baru: screen.getByLabelText(/^Password Baru/) as HTMLInputElement,
      konfirmasi: screen.getByLabelText(/^Konfirmasi/) as HTMLInputElement,
    };
    const tombol = {
      lama: screen.getByRole("button", { name: "Tampilkan password lama" }),
      baru: screen.getByRole("button", { name: "Tampilkan password baru" }),
      konfirmasi: screen.getByRole("button", { name: "Tampilkan konfirmasi password" }),
    };
    for (const t of Object.values(tombol)) {
      expect(t.getAttribute("type")).toBe("button");
      expect(t.getAttribute("aria-pressed")).toBe("false");
    }
    fireEvent.click(tombol.baru);
    expect(tombol.baru.getAttribute("aria-pressed")).toBe("true");
    expect(isian.baru.type).toBe("text");
    expect(isian.lama.type).toBe("password");
    expect(isian.konfirmasi.type).toBe("password");
    expect(tombol.lama.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(tombol.baru);
    expect(isian.baru.type).toBe("password");
    // Placeholder & autocomplete.
    expect(isian.lama.placeholder).toBe("Masukkan password lama Anda");
    expect(isian.baru.placeholder).toBe("Minimal 8 karakter");
    expect(isian.konfirmasi.placeholder).toBe("Masukkan kembali password baru");
    expect(isian.lama.getAttribute("autocomplete")).toBe("current-password");
    expect(isian.baru.getAttribute("autocomplete")).toBe("new-password");
    expect(isian.konfirmasi.getAttribute("autocomplete")).toBe("new-password");
    // Tombol mata tidak mengirim form.
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("NFR_SEC_02_hanya_syarat_minimal_8 (tanpa aturan kompleksitas karangan)", () => {
    render(<FormPassword />);
    expect(screen.getByText("Minimal 8 karakter.")).toBeTruthy();
    expect(screen.queryByText(/huruf besar|karakter khusus|angka/i)).toBeNull();
  });
});

describe("UbahFoto (OQ-48, NFR-SEC-06)", () => {
  // jsdom tidak menyediakan object URL; pratinjau memakai URL palsu yang bisa dilacak.
  let nomor = 0;
  const dibuat: string[] = [];
  const dibebaskan: string[] = [];
  beforeEach(() => {
    nomor = 0;
    dibuat.length = 0;
    dibebaskan.length = 0;
    URL.createObjectURL = vi.fn(() => {
      const u = `blob:pratinjau-${++nomor}`;
      dibuat.push(u);
      return u;
    });
    URL.revokeObjectURL = vi.fn((u: string) => void dibebaskan.push(u));
  });

  const berkas = (nama: string, jenis: string, ukuran = 1000) =>
    new File([new Uint8Array(ukuran)], nama, { type: jenis });
  const isianFoto = () => screen.getByLabelText("Foto Profil") as HTMLInputElement;
  const pilih = (f: File) => fireEvent.change(isianFoto(), { target: { files: [f] } });
  const avatar = () => screen.getByRole("img", { name: /Aulia Rahma/ });

  it("OQ_48_ubah_foto_put_multipart_isian_foto", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ ...PROFIL, ada_foto: true }));
    render(<UbahFoto nama="Aulia Rahma" adaFoto={false} />);
    const f = berkas("saya.png", "image/png");
    pilih(f);
    // Pratinjau sebelum disimpan.
    expect(avatar().getAttribute("src")).toBe("blob:pratinjau-1");
    fireEvent.click(screen.getByRole("button", { name: "Simpan Foto" }));
    expect(await screen.findByText(PESAN_FOTO_BERHASIL)).toBeTruthy();
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("/api/v1/anggota/profil/foto");
    expect(init.method).toBe("PUT");
    expect(init.body).toBeInstanceOf(FormData);
    expect([...(init.body as FormData).keys()]).toEqual(["foto"]);
    expect((init.body as FormData).get("foto")).toBe(f);
    expect(router.refresh).toHaveBeenCalled();
    // Pesan sukses lewat komponen Pesan (status).
    expect(screen.getByText(PESAN_FOTO_BERHASIL).closest('[role="status"]')).not.toBeNull();
  });

  it("OQ_48_sukses_avatar_dimuat_ulang_dengan_penanda_versi", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ ...PROFIL, ada_foto: true }));
    render(<UbahFoto nama="Aulia Rahma" adaFoto={true} />);
    expect(avatar().getAttribute("src")).toBe(URL_FOTO);
    pilih(berkas("baru.jpg", "image/jpeg"));
    fireEvent.click(screen.getByRole("button", { name: "Simpan Foto" }));
    await screen.findByText(PESAN_FOTO_BERHASIL);
    expect(avatar().getAttribute("src")).toMatch(/^\/api\/v1\/anggota\/profil\/foto\?v=\d+$/);
    // Pratinjau dibebaskan setelah selesai; tombol simpan/batal hilang.
    expect(dibebaskan).toEqual(["blob:pratinjau-1"]);
    expect(screen.queryByRole("button", { name: "Simpan Foto" })).toBeNull();
  });

  it("OQ_48_avatar_gagal_lalu_unggah_sukses_foto_baru_tampil_bukan_inisial", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ ...PROFIL, ada_foto: true }));
    render(<UbahFoto nama="Aulia Rahma" adaFoto={true} />);
    // Foto lama gagal dimuat → AvatarFoto jatuh ke inisial.
    fireEvent.error(avatar());
    expect(avatar().tagName).toBe("SPAN");
    expect(avatar().textContent).toBe("AR");
    pilih(berkas("baru.jpg", "image/jpeg"));
    fireEvent.click(screen.getByRole("button", { name: "Simpan Foto" }));
    await screen.findByText(PESAN_FOTO_BERHASIL);
    // key={src}: state `gagal` lama tidak terbawa → foto baru tampil.
    expect(avatar().tagName).toBe("IMG");
    expect(avatar().getAttribute("src")).toMatch(/\?v=\d+$/);
  });

  it("OQ_48_foto_terlalu_besar_ditahan_klien", () => {
    render(<UbahFoto nama="Aulia Rahma" adaFoto={false} />);
    pilih(berkas("besar.jpg", "image/jpeg", 2 * 1024 * 1024 + 1));
    expect(screen.getByText("Ukuran berkas melebihi batas 2 MB.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Simpan Foto" })).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("OQ_48_tepat_2_mb_diterima_klien", () => {
    render(<UbahFoto nama="Aulia Rahma" adaFoto={false} />);
    pilih(berkas("pas.jpg", "image/jpeg", 2 * 1024 * 1024));
    expect(screen.getByRole("button", { name: "Simpan Foto" })).toBeTruthy();
  });

  it("OQ_48_jenis_bukan_jpg_png_ditahan_hanya_bila_type_terisi", () => {
    render(<UbahFoto nama="Aulia Rahma" adaFoto={false} />);
    pilih(berkas("animasi.gif", "image/gif"));
    expect(screen.getByText("Foto harus berupa gambar JPG atau PNG.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Simpan Foto" })).toBeNull();
    // Jenis kosong → dikirim; backend memeriksa isi berkas (P3).
    pilih(berkas("tanpa-jenis", ""));
    expect(screen.queryByText("Foto harus berupa gambar JPG atau PNG.")).toBeNull();
    expect(screen.getByRole("button", { name: "Simpan Foto" })).toBeTruthy();
  });

  it("OQ_48_galat_backend_apa_adanya", async () => {
    fetchPalsu.mockResolvedValue(
      galat(422, "AKN_FOTO_FORMAT", "Foto harus berupa gambar JPG atau PNG.", {
        foto: "Foto harus berupa gambar JPG atau PNG.",
      }),
    );
    render(<UbahFoto nama="Aulia Rahma" adaFoto={false} />);
    pilih(berkas("palsu.png", "image/png"));
    fireEvent.click(screen.getByRole("button", { name: "Simpan Foto" }));
    const pesan = await screen.findAllByText("Foto harus berupa gambar JPG atau PNG.");
    expect(pesan.some((p) => p.closest('[role="alert"]'))).toBe(true);
    expect(isianFoto().getAttribute("aria-invalid")).toBe("true");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("OQ_48_galat_503_penyimpanan_apa_adanya", async () => {
    const teks = "Berkas tidak dapat disimpan. Coba lagi nanti.";
    fetchPalsu.mockResolvedValue(
      Response.json(
        { detail: { kode: "BERKAS_PENYIMPANAN_GAGAL", pesan: teks, rujukan: "NFR-REL-01" } },
        { status: 503 },
      ),
    );
    render(<UbahFoto nama="Aulia Rahma" adaFoto={true} />);
    pilih(berkas("baru.jpg", "image/jpeg"));
    fireEvent.click(screen.getByRole("button", { name: "Simpan Foto" }));
    expect(await screen.findByText(teks)).toBeTruthy();
    // Pratinjau tetap; avatar belum berganti ke URL server baru.
    expect(avatar().getAttribute("src")).toBe("blob:pratinjau-1");
  });

  it("OQ_48_batal_kembali_ke_foto_lama", () => {
    render(<UbahFoto nama="Aulia Rahma" adaFoto={true} />);
    pilih(berkas("baru.jpg", "image/jpeg"));
    expect(avatar().getAttribute("src")).toBe("blob:pratinjau-1");
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    expect(avatar().getAttribute("src")).toBe(URL_FOTO);
    expect(dibebaskan).toEqual(["blob:pratinjau-1"]);
    expect(screen.getByText("Belum ada foto baru dipilih")).toBeTruthy();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("OQ_48_pratinjau_dibebaskan_saat_unmount_dan_tanpa_hapus_foto", () => {
    const { unmount } = render(<UbahFoto nama="Aulia Rahma" adaFoto={false} />);
    expect(screen.queryByRole("button", { name: /hapus/i })).toBeNull();
    pilih(berkas("baru.png", "image/png"));
    unmount();
    expect(dibebaskan).toEqual(["blob:pratinjau-1"]);
  });
});

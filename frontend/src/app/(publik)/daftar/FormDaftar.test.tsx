// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { FormDaftar } = await import("./FormDaftar");

const fetchPalsu = vi.fn();

beforeEach(() => {
  router.replace.mockReset();
  router.push.mockReset();
  fetchPalsu.mockReset();
  vi.stubGlobal("fetch", fetchPalsu);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function ketik(label: RegExp, nilai: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: nilai } });
}

function isiSah() {
  ketik(/Nama Lengkap/, "Aulia Rahma");
  ketik(/^NIK/, "3171012345678901");
  ketik(/^Email/, "aulia@contoh.example");
  ketik(/Nomor Telepon/, "0812 3456 7890");
  ketik(/Alamat/, "Jl. Melati No. 12");
  ketik(/^Password/, "rahasia12");
}

const kirim = () => fireEvent.click(screen.getByRole("button", { name: "Daftar Menjadi Anggota" }));

function galatBackend(status: number, kode: string, pesan: string, isian: Record<string, string>) {
  return Response.json({ detail: { kode, pesan, rujukan: "FR-AKN-02", isian } }, { status });
}

describe("FormDaftar (FR-AKN-01..04)", () => {
  it("FR_AKN_01_kirim_multipart_semua_isian_tanpa_foto", async () => {
    fetchPalsu.mockResolvedValue(
      Response.json(
        {
          kode: "AGT-000123",
          nama: "Aulia Rahma",
          email: "aulia@contoh.example",
          isi_qr: "AGT-000123",
        },
        { status: 201 },
      ),
    );
    render(<FormDaftar />);
    isiSah();
    kirim();
    await screen.findByText("AGT-000123");
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("/api/v1/auth/daftar");
    expect(init.method).toBe("POST");
    const data = init.body as FormData;
    expect(Object.fromEntries(data.entries())).toEqual({
      nama: "Aulia Rahma",
      nik: "3171012345678901",
      email: "aulia@contoh.example",
      telepon: "0812 3456 7890",
      alamat: "Jl. Melati No. 12",
      password: "rahasia12",
    });
    expect(data.has("foto")).toBe(false);
    // Multipart: content-type diisi peramban (boundary), bukan application/json.
    expect(new Headers(init.headers).get("content-type")).toBeNull();
  });

  it("FR_AKN_01_foto_ikut_dikirim_bila_dipilih", async () => {
    fetchPalsu.mockResolvedValue(
      Response.json(
        { kode: "AGT-000124", nama: "A", email: "a@contoh.example", isi_qr: "AGT-000124" },
        { status: 201 },
      ),
    );
    render(<FormDaftar />);
    isiSah();
    const foto = new File([new Uint8Array(10)], "foto.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/Foto/), { target: { files: [foto] } });
    kirim();
    await screen.findByText("AGT-000124");
    expect((fetchPalsu.mock.calls[0][1].body as FormData).get("foto")).toBeInstanceOf(File);
  });

  it("FR_AKN_04_OQ_30_sukses_tampil_kode_anggota_tanpa_login", async () => {
    fetchPalsu.mockResolvedValue(
      Response.json(
        {
          kode: "AGT-000123",
          nama: "Aulia Rahma",
          email: "aulia@contoh.example",
          isi_qr: "AGT-000123",
        },
        { status: 201 },
      ),
    );
    render(<FormDaftar />);
    isiSah();
    kirim();
    expect(await screen.findByText("AGT-000123")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Masuk" }).getAttribute("href")).toBe("/masuk");
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(fetchPalsu).toHaveBeenCalledTimes(1); // tidak ada panggilan login otomatis
  });

  it("FR_AKN_02_duplikat_ditempel_per_isian", async () => {
    fetchPalsu.mockResolvedValue(
      galatBackend(409, "AKN_DATA_DUPLIKAT", "NIK dan email sudah terdaftar.", {
        nik: "NIK sudah terdaftar.",
        email: "Email sudah terdaftar.",
      }),
    );
    render(<FormDaftar />);
    isiSah();
    kirim();
    expect((await screen.findByRole("alert")).textContent).toBe("NIK dan email sudah terdaftar.");
    expect(screen.getByText("NIK sudah terdaftar.")).toBeTruthy();
    expect(screen.getByText("Email sudah terdaftar.")).toBeTruthy();
    expect(screen.getByLabelText(/^NIK/).getAttribute("aria-invalid")).toBe("true");
  });

  it("IR_UI_04_galat_422_backend_per_isian (mis. isi foto ditolak backend)", async () => {
    fetchPalsu.mockResolvedValue(
      galatBackend(422, "AKN_ISIAN_TIDAK_VALID", "Periksa isian: Foto.", {
        foto: "Foto harus berupa gambar JPG atau PNG.",
      }),
    );
    render(<FormDaftar />);
    isiSah();
    // Jenis kosong: klien meneruskan ke backend (P3), backend menolak dari isi berkas.
    const foto = new File([new Uint8Array(10)], "foto.heic", { type: "" });
    fireEvent.change(screen.getByLabelText(/Foto/), { target: { files: [foto] } });
    kirim();
    expect(await screen.findByText("Foto harus berupa gambar JPG atau PNG.")).toBeTruthy();
    expect(fetchPalsu).toHaveBeenCalledTimes(1);
  });

  it("validasi_klien_menahan_pengiriman_dan_menampilkan_pesan", () => {
    render(<FormDaftar />);
    isiSah();
    ketik(/^NIK/, "123");
    ketik(/^Password/, "pendek");
    kirim();
    expect(screen.getByText("NIK harus tepat 16 digit angka.")).toBeTruthy();
    expect(screen.getByText("Password minimal 8 karakter.")).toBeTruthy();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("NFR_SEC_06_foto_terlalu_besar_ditahan_di_klien", () => {
    render(<FormDaftar />);
    isiSah();
    const besar = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "besar.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(screen.getByLabelText(/Foto/), { target: { files: [besar] } });
    kirim();
    expect(screen.getByText("Ukuran berkas melebihi batas 2 MB.")).toBeTruthy();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("NFR_SEC_02_keterangan_password_minimal_8 (bukan 6 seperti desain)", () => {
    render(<FormDaftar />);
    expect(screen.getByText("Minimal 8 karakter.")).toBeTruthy();
    expect(screen.queryByText(/6 karakter/)).toBeNull();
  });

  it("NFR_SEC_02_placeholder_password_minimal_8", () => {
    render(<FormDaftar />);
    const isian = screen.getByLabelText(/^Password/) as HTMLInputElement;
    expect(isian.placeholder).toBe("Minimal 8 karakter");
  });

  it("NFR_SEC_02_tombol_mata_tidak_mengirim_form_dan_mengubah_type", () => {
    render(<FormDaftar />);
    const isian = screen.getByLabelText(/^Password/) as HTMLInputElement;
    const mata = screen.getByRole("button", { name: "Tampilkan password" });
    expect(mata.getAttribute("type")).toBe("button");
    expect(isian.type).toBe("password");
    expect(mata.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("checkbox")).toBeNull();

    fireEvent.click(mata);
    expect(isian.type).toBe("text");
    expect(mata.getAttribute("aria-pressed")).toBe("true");
    expect(mata.getAttribute("aria-label")).toBe("Tampilkan password");
    expect(fetchPalsu).not.toHaveBeenCalled();
    // Validasi klien tidak terpicu: tombol mata bukan submit.
    expect(screen.queryByText("Periksa kembali isian yang ditandai.")).toBeNull();
  });

  it("ikon_dekoratif_di_setiap_isian", () => {
    const { container } = render(<FormDaftar />);
    const ikon = [...container.querySelectorAll('form [aria-hidden="true"] > svg[data-ikon]')].map(
      (s) => s.getAttribute("data-ikon"),
    );
    for (const nama of ["orang", "ktp", "amplop", "telepon", "pin", "gembok", "gambar"]) {
      expect(ikon).toContain(nama);
    }
  });

  it("tombol_kirim_dan_tautan_masuk_berpanah_nama_aksesibel_tetap", () => {
    render(<FormDaftar />);
    const tombol = screen.getByRole("button", { name: "Daftar Menjadi Anggota" });
    expect(tombol.querySelector('svg[data-ikon="panah"]')).not.toBeNull();
    const tautan = screen.getByRole("link", { name: "Masuk di sini" });
    expect(tautan.getAttribute("href")).toBe("/masuk");
    expect(tautan.querySelector('svg[data-ikon="panah"]')).not.toBeNull();
  });

  it("di luar lingkup tidak ikut: tanpa e-book/digital & rekomendasi", () => {
    render(<FormDaftar />);
    expect(screen.queryByText(/digital|rekomendasi|e-book/i)).toBeNull();
  });
});

describe("FormDaftar di layar sempit", () => {
  it("kedua grid satu kolom di bawah md (grid-cols-1), dua kolom di md", () => {
    const { container } = render(<FormDaftar />);
    const grid = [...container.querySelectorAll("form > div.grid")];
    expect(grid.length).toBe(2);
    for (const g of grid) {
      expect(g.className).toContain("grid-cols-1");
      expect(g.className).toContain("md:grid-cols-2");
    }
  });

  it("isian foto memakai tombol 'Pilih Foto' berbahasa Indonesia", () => {
    render(<FormDaftar />);
    expect(screen.getByText("Pilih Foto")).toBeTruthy();
    expect(screen.getByText("Belum ada foto dipilih")).toBeTruthy();
  });
});

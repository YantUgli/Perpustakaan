// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = { refresh: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { FormProfil } = await import("./profil/FormProfil");
const { FormPassword, PESAN_PASSWORD_BERHASIL } = await import("./profil/FormPassword");

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

  it("NFR_SEC_02_hanya_syarat_minimal_8 (tanpa aturan kompleksitas karangan)", () => {
    render(<FormPassword />);
    expect(screen.getByText("Minimal 8 karakter.")).toBeTruthy();
    expect(screen.queryByText(/huruf besar|karakter khusus|angka/i)).toBeNull();
  });
});

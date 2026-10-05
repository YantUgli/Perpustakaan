// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = { replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { FormMasuk } = await import("./FormMasuk");
const { PESAN_JARINGAN } = await import("@/lib/galat");

const fetchPalsu = vi.fn();

beforeEach(() => {
  router.replace.mockReset();
  router.refresh.mockReset();
  fetchPalsu.mockReset();
  vi.stubGlobal("fetch", fetchPalsu);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function isiDanKirim(email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
}

describe("FormMasuk (FR-AKN-05)", () => {
  it("FR_AKN_05_login_kirim_json_ke_auth_login", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ role: "ANGGOTA", nama: "Aulia" }));
    render(<FormMasuk />);
    isiDanKirim("  aulia@contoh.example ", "rahasia12");
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("/api/v1/auth/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "aulia@contoh.example", password: "rahasia12" });
  });

  it.each([
    ["ADMIN", "/admin"],
    ["ANGGOTA", "/anggota"],
  ])("FR_AKN_05_arah_per_role: %s → %s", async (role, tujuan) => {
    fetchPalsu.mockResolvedValue(Response.json({ role, nama: "X" }));
    render(<FormMasuk />);
    isiDanKirim("x@contoh.example", "rahasia12");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(tujuan));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("OQ_16_pesan_gagal_login_apa_adanya", async () => {
    fetchPalsu.mockResolvedValue(
      Response.json(
        {
          detail: {
            kode: "AKN_LOGIN_GAGAL",
            pesan: "Email atau password salah.",
            rujukan: "FR-AKN-05",
          },
        },
        { status: 401 },
      ),
    );
    render(<FormMasuk />);
    isiDanKirim("x@contoh.example", "salahsalah");
    expect((await screen.findByRole("alert")).textContent).toBe("Email atau password salah.");
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Masuk" })).not.toHaveProperty("disabled", true);
  });

  it("isian kosong ditahan di klien tanpa memanggil backend", () => {
    render(<FormMasuk />);
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    expect(screen.getByText("Email wajib diisi.")).toBeTruthy();
    expect(screen.getByText("Password wajib diisi.")).toBeTruthy();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("galat jaringan menampilkan pesan jaringan", async () => {
    fetchPalsu.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<FormMasuk />);
    isiDanKirim("x@contoh.example", "rahasia12");
    expect((await screen.findByRole("alert")).textContent).toBe(PESAN_JARINGAN);
  });

  it("tombol nonaktif selama proses (cegah kirim ganda)", async () => {
    fetchPalsu.mockReturnValue(new Promise(() => {}));
    render(<FormMasuk />);
    isiDanKirim("x@contoh.example", "rahasia12");
    expect(await screen.findByRole("button", { name: "Memproses…" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("K_03_FR_AKN_12_tidak_ada_lupa_kata_sandi", () => {
    render(<FormMasuk />);
    expect(screen.queryByText(/lupa/i)).toBeNull();
  });

  it("BR_02_info_peran_hanya_anggota_atau_admin", () => {
    render(<FormMasuk />);
    expect(screen.queryByText(/pustakawan/i)).toBeNull();
  });
});

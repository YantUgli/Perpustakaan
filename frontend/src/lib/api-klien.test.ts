import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ambil } from "./api-klien";
import { PESAN_JARINGAN } from "./galat";

const fetchPalsu = vi.fn();

beforeEach(() => {
  fetchPalsu.mockReset();
  vi.stubGlobal("fetch", fetchPalsu);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ambil (browser, decisions §B satu origin)", () => {
  it("api_klien_path_relatif_same_origin", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ data: [] }));
    await expect(ambil("/katalog/judul?q=sejarah")).resolves.toEqual({ data: [] });
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("/api/v1/katalog/judul?q=sejarah");
    expect(init.credentials).toBe("same-origin");
  });

  it("mengirim body JSON", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ role: "ANGGOTA", nama: "A" }));
    await ambil("/auth/login", {
      method: "POST",
      json: { email: "a@x.example", password: "rahasia123" },
    });
    const init = fetchPalsu.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ email: "a@x.example", password: "rahasia123" });
  });

  it("204 tanpa isi → undefined", async () => {
    fetchPalsu.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(ambil("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("IR_UI_04_galat_bisnis_dilempar_dengan_pesan_backend", async () => {
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
    await expect(ambil("/auth/login", { method: "POST", json: {} })).rejects.toMatchObject({
      pesan: "Email atau password salah.",
      sistem: false,
    });
  });

  it("galat jaringan → pesan jaringan", async () => {
    fetchPalsu.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(ambil("/health")).rejects.toMatchObject({ pesan: PESAN_JARINGAN });
  });
});

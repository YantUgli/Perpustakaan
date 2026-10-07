import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const urutan: string[] = [];
const cookieStore = { get: vi.fn() };

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => {
    urutan.push("cookies");
    return cookieStore;
  }),
}));

vi.mock("./alamat-backend", () => ({
  alamatBackend: vi.fn(() => {
    urutan.push("alamatBackend");
    return "http://backend.internal:8000";
  }),
}));

const { ambilServer, ambilSesiServer } = await import("./api-server");
const { GalatApi } = await import("./galat");

const fetchPalsu = vi.fn();

beforeEach(() => {
  urutan.length = 0;
  cookieStore.get.mockReset();
  fetchPalsu.mockReset();
  vi.stubGlobal("fetch", fetchPalsu);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function json(status: number, isi: unknown): Response {
  return new Response(JSON.stringify(isi), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ambilServer (decisions §B satu origin, server Next.js)", () => {
  it("api_server_cookies_dulu_sebelum_alamat_backend (tidak memanggil backend saat prerender statis)", async () => {
    fetchPalsu.mockResolvedValue(json(200, { status: "ok" }));
    await ambilServer("/health");
    expect(urutan).toEqual(["cookies", "alamatBackend"]);
  });

  it("api_server_teruskan_cookie_sesi_perpus", async () => {
    cookieStore.get.mockImplementation((nama: string) =>
      nama === "sesi_perpus" ? { name: nama, value: "tok123" } : undefined,
    );
    fetchPalsu.mockResolvedValue(
      json(200, { role: "ADMIN", nama: "Raisya", email: "r@x.example" }),
    );
    const hasil = await ambilServer("/auth/saya");
    expect(hasil).toEqual({ role: "ADMIN", nama: "Raisya", email: "r@x.example" });
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("http://backend.internal:8000/api/v1/auth/saya");
    expect(new Headers(init.headers).get("cookie")).toBe("sesi_perpus=tok123");
    expect(init.cache).toBe("no-store");
  });

  it("api_server_tanpa_cookie_tanpa_header", async () => {
    cookieStore.get.mockReturnValue(undefined);
    fetchPalsu.mockResolvedValue(json(200, {}));
    await ambilServer("/katalog/judul");
    expect(new Headers(fetchPalsu.mock.calls[0][1].headers).has("cookie")).toBe(false);
  });

  it("IR_UI_04_galat_backend_dilempar_sebagai_GalatApi", async () => {
    fetchPalsu.mockResolvedValue(
      json(404, {
        detail: {
          kode: "KTL_JUDUL_TIDAK_ADA",
          pesan: "Judul tidak ditemukan.",
          rujukan: "FR-KTL-03",
        },
      }),
    );
    await expect(ambilServer("/katalog/judul/9")).rejects.toMatchObject({
      kode: "KTL_JUDUL_TIDAK_ADA",
      pesan: "Judul tidak ditemukan.",
    });
  });

  it("galat jaringan menjadi GalatApi JARINGAN", async () => {
    fetchPalsu.mockRejectedValue(new TypeError("fetch failed"));
    await expect(ambilServer("/health")).rejects.toBeInstanceOf(GalatApi);
  });
});

describe("ambilSesiServer (FR-AKN-05)", () => {
  it("401 berarti belum login → null", async () => {
    fetchPalsu.mockResolvedValue(
      json(401, {
        detail: { kode: "AKN_BELUM_LOGIN", pesan: "Silakan masuk.", rujukan: "NFR-SEC-03" },
      }),
    );
    await expect(ambilSesiServer()).resolves.toBeNull();
  });

  it("galat lain tidak disamarkan sebagai belum login", async () => {
    fetchPalsu.mockResolvedValue(new Response("<html>", { status: 502 }));
    await expect(ambilSesiServer()).rejects.toMatchObject({ kode: "SISTEM" });
  });
});

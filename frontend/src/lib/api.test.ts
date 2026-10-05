import { afterEach, describe, expect, it, vi } from "vitest";

import { alamatBackend, urlApi, urlApiServer } from "./api";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("urlApi", () => {
  it("menghasilkan path relatif dengan prefix /api/v1 (IR-COM-01, satu origin)", () => {
    expect(urlApi("/health")).toBe("/api/v1/health");
  });

  it("menambahkan garis miring awal bila path tidak diawali '/'", () => {
    expect(urlApi("health")).toBe("/api/v1/health");
  });
});

describe("alamatBackend", () => {
  it("memakai API_INTERNAL_URL dan merapikan garis miring di akhir", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_INTERNAL_URL", "http://backend:8000/");
    expect(alamatBackend()).toBe("http://backend:8000");
  });

  it("memakai fallback 127.0.0.1:8000 hanya saat development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("API_INTERNAL_URL", "");
    expect(alamatBackend()).toBe("http://127.0.0.1:8000");
  });

  it.each(["production", "test"])(
    "melempar error saat NODE_ENV=%s dan API_INTERNAL_URL kosong",
    (nodeEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("API_INTERNAL_URL", "");
      expect(() => alamatBackend()).toThrow(/API_INTERNAL_URL belum diset/);
    },
  );
});

describe("urlApiServer", () => {
  it("menggabungkan alamat backend dengan path API", () => {
    vi.stubEnv("API_INTERNAL_URL", "http://127.0.0.1:9000");
    expect(urlApiServer("/katalog/judul")).toBe("http://127.0.0.1:9000/api/v1/katalog/judul");
  });
});

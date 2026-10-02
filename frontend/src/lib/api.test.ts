import { describe, expect, it } from "vitest";

import { urlApi } from "./api";

describe("urlApi", () => {
  it("menambahkan prefix /api/v1 (IR-COM-01)", () => {
    expect(urlApi("/health", "https://perpus.example")).toBe(
      "https://perpus.example/api/v1/health",
    );
  });

  it("menormalkan garis miring di base URL dan path", () => {
    expect(urlApi("health", "https://perpus.example/")).toBe(
      "https://perpus.example/api/v1/health",
    );
  });
});

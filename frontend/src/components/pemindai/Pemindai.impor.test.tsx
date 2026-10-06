// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

// Menghitung kapan library benar-benar dimuat (decisions §B "QR scan (frontend)": dimuat dinamis).
let libraryDimuat = 0;
vi.mock("@zxing/browser", () => {
  libraryDimuat += 1;
  return {
    BrowserQRCodeReader: class {
      decodeFromConstraints() {
        return Promise.resolve({ stop: () => {} });
      }
    },
  };
});

afterEach(cleanup);

it("test_modul_pemindai_tidak_memuat_library_sampai_kamera_dinyalakan", async () => {
  const { Pemindai } = await import("./Pemindai");
  expect(libraryDimuat).toBe(0);

  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn() },
    configurable: true,
  });
  render(<Pemindai label="Kode eksemplar" onHasil={() => {}} />);
  await waitFor(() => expect(libraryDimuat).toBe(1));
});

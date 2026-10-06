import { describe, expect, it, vi } from "vitest";

const stop = vi.fn();
const decodeFromConstraints = vi.fn();
vi.mock("@zxing/browser", () => ({
  BrowserQRCodeReader: class {
    decodeFromConstraints = decodeFromConstraints;
  },
}));

const { mulaiPindai } = await import("./kamera-qr");
const video = {} as HTMLVideoElement;

describe("mulaiPindai (IR-HW-01)", () => {
  it("test_IR_HW_01_meminta_kamera_belakang_tanpa_audio", async () => {
    decodeFromConstraints.mockResolvedValueOnce({ stop });
    await mulaiPindai(video, () => {});
    expect(decodeFromConstraints).toHaveBeenCalledWith(
      { video: { facingMode: { ideal: "environment" } }, audio: false },
      video,
      expect.any(Function),
    );
  });

  it("teks QR diteruskan apa adanya; callback tanpa hasil diabaikan", async () => {
    decodeFromConstraints.mockResolvedValueOnce({ stop });
    const onTeks = vi.fn();
    await mulaiPindai(video, onTeks);
    const cb = decodeFromConstraints.mock.calls.at(-1)![2];
    cb(undefined, new Error("tidak ada QR"), { stop });
    cb({ getText: () => " eks-000001 " }, undefined, { stop });
    expect(onTeks.mock.calls).toEqual([[" eks-000001 "]]);
  });

  it("hentikan() menghentikan kamera", async () => {
    decodeFromConstraints.mockResolvedValueOnce({ stop });
    const kendali = await mulaiPindai(video, () => {});
    kendali.hentikan();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("test_IR_UI_04_galat_getUserMedia_dilempar_apa_adanya", async () => {
    const galat = Object.assign(new Error("x"), { name: "NotAllowedError" });
    decodeFromConstraints.mockRejectedValueOnce(galat);
    await expect(mulaiPindai(video, () => {})).rejects.toBe(galat);
  });
});

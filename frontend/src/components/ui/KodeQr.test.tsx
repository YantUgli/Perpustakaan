// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const propsTerakhir: Record<string, unknown>[] = [];
vi.mock("qrcode.react", () => ({
  QRCodeSVG: (props: Record<string, unknown>) => {
    propsTerakhir.push(props);
    return <svg />;
  },
}));

const { KodeQr } = await import("./KodeQr");

afterEach(cleanup);

describe("KodeQr (FR-AGT-01, kelak label IR-HW-02)", () => {
  it("koreksi galat M, quiet zone 4 modul, hitam di atas putih, isi apa adanya", () => {
    render(<KodeQr isi="AGT-000123" judul="QR anggota AGT-000123" />);
    expect(propsTerakhir.at(-1)).toMatchObject({
      value: "AGT-000123",
      size: 256,
      level: "M",
      marginSize: 4,
      fgColor: "#000000",
      bgColor: "#FFFFFF",
      title: "QR anggota AGT-000123",
    });
  });
});

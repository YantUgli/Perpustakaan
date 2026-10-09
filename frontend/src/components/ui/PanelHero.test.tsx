// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PanelHero } from "./PanelHero";

const foto = { src: "/foto.jpg", width: 640, height: 424 };

afterEach(cleanup);

describe("PanelHero (foto dekoratif, decisions §B)", () => {
  it("tanpa prop sisi: kelas sama dengan sebelumnya (beranda, katalog, Tentang)", () => {
    const { container } = render(<PanelHero foto={foto} />);
    const panel = container.firstElementChild as HTMLElement;
    expect(panel.className).toBe(
      "absolute inset-y-0 right-0 hidden w-[57%] bg-line/40 mask-l-from-65% mask-l-to-100% lg:block",
    );
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(panel.querySelector("img")?.getAttribute("sizes")).toBe("57vw");
  });

  it("sisi kiri (/masuk hal-07): left-0, tepi kanan memudar, hanya mulai lg, alt kosong", () => {
    const { container } = render(<PanelHero foto={foto} sisi="kiri" />);
    const panel = container.firstElementChild as HTMLElement;
    const kelas = panel.className.split(" ");
    expect(kelas).toEqual(expect.arrayContaining(["left-0", "mask-r-from-65%", "mask-r-to-100%"]));
    expect(kelas).toEqual(expect.arrayContaining(["hidden", "lg:block"]));
    expect(kelas).not.toContain("right-0");
    expect(kelas.some((k) => k.startsWith("mask-l"))).toBe(false);
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    const img = panel.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("sizes")).toBe("55vw");
  });
});

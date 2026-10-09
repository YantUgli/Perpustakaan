// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { KepalaHalamanArea } from "./KepalaHalamanArea";

const foto = { src: "/hero-beranda.jpg", width: 640, height: 424 };
const KOLOM = "lg:max-w-[calc(43%-0.28rem)]";

/** Kolom teks berfoto: leluhur terdekat yang memakai batas lebar kolom (tepi kanan = tepi kiri foto). */
function kolomTeks(el: Element) {
  for (let e: Element | null = el; e; e = e.parentElement) {
    if (e.getAttribute("class")?.split(" ").includes(KOLOM)) return e;
  }
  return null;
}

afterEach(cleanup);

describe("KepalaHalamanArea (decisions §B Kepala halaman area, IR-UI-03)", () => {
  it("tanpa_foto_judul_subjudul_tanpa_img_tanpa_offset_dan_batas_kolom", () => {
    const { container } = render(<KepalaHalamanArea judul="Tambah Judul" subjudul="Isi data." />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Tambah Judul");
    expect(screen.getByText("Isi data.").tagName).toBe("P");
    expect(container.querySelector("img")).toBeNull();
    const html = container.innerHTML;
    expect(html).not.toContain("-mx-4");
    expect(html).not.toContain("lg:max-w-");
  });

  it("dengan_foto_satu_img_dekoratif_mulai_lg_kolom_teks_sampai_tepi_foto_dan_offset_main", () => {
    const { container } = render(
      <KepalaHalamanArea judul="Pinjaman Saya" subjudul="Buku Anda." foto={foto} />,
    );
    const header = container.querySelector("header")!;
    expect(header.className.split(" ")).toEqual(
      expect.arrayContaining(["relative", "overflow-hidden", "-mx-4", "-mt-6", "sm:-mx-8", "pb-2"]),
    );
    const img = container.querySelectorAll("img");
    expect(img).toHaveLength(1);
    expect(img[0].getAttribute("alt")).toBe("");
    expect(img[0].getAttribute("src")).toContain("hero-beranda");
    const panel = img[0].closest('[aria-hidden="true"]')!;
    expect(panel.className.split(" ")).toEqual(expect.arrayContaining(["hidden", "lg:block"]));
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(kolomTeks(h1)).toBeTruthy();
    // Butir 3: h1 berfoto tidak membesar di mobile.
    expect(h1.className.split(" ")).toEqual(
      expect.arrayContaining(["text-3xl", "sm:text-4xl", "xl:text-5xl"]),
    );
  });

  it("aksi_tampil_di_kolom_teks_bukan_di_panel_foto", () => {
    render(
      <KepalaHalamanArea
        judul="Data Buku"
        aksi={<button type="button">Tambah Judul</button>}
        foto={foto}
      />,
    );
    const tombol = screen.getByRole("button", { name: "Tambah Judul" });
    expect(tombol.closest('[aria-hidden="true"]')).toBeNull();
    expect(kolomTeks(tombol)).toBeTruthy();
  });

  it("aksi_tanpa_foto_tetap_tampil", () => {
    render(<KepalaHalamanArea judul="Cetak Label" aksi={<button type="button">Cetak</button>} />);
    expect(screen.getByRole("button", { name: "Cetak" })).toBeTruthy();
  });

  it("subjudul_kosong_tanpa_paragraf", () => {
    const { container } = render(<KepalaHalamanArea judul="Rak" foto={foto} />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("IR_UI_01_padat_h1_text_2xl_subjudul_tersembunyi_tanpa_pb_mobile", () => {
    const { container } = render(
      <KepalaHalamanArea judul="Peminjaman" subjudul="Pindai kode." foto={foto} padat />,
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className.split(" ")).toEqual(
      expect.arrayContaining(["text-2xl", "lg:text-4xl", "xl:text-5xl"]),
    );
    expect(h1.className.split(" ")).not.toContain("text-3xl");
    expect(screen.getByText("Pindai kode.").className.split(" ")).toEqual(
      expect.arrayContaining(["hidden", "lg:block"]),
    );
    const kelas = container.querySelector("header")!.className.split(" ");
    expect(kelas).toContain("lg:pb-2");
    expect(kelas).not.toContain("pb-2");
  });

  it("berfoto_tanpa_padat_aksi_baris_tersendiri_setelah_subjudul", () => {
    render(
      <KepalaHalamanArea
        judul="Data Buku"
        subjudul="Judul koleksi."
        aksi={<button type="button">Tambah Judul</button>}
        foto={foto}
      />,
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    const sub = screen.getByText("Judul koleksi.");
    const tombol = screen.getByRole("button", { name: "Tambah Judul" });
    // Urutan dokumen: h1 → subjudul → aksi; aksi tidak sebaris dengan h1.
    expect(h1.compareDocumentPosition(sub) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sub.compareDocumentPosition(tombol) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tombol.parentElement).not.toBe(h1.parentElement);
  });

  it("IR_UI_01_padat_aksi_sebaris_dengan_h1", () => {
    render(
      <KepalaHalamanArea
        judul="Peminjaman"
        subjudul="Pindai kode."
        aksi={<button type="button">Reset</button>}
        foto={foto}
        padat
      />,
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    const tombol = screen.getByRole("button", { name: "Reset" });
    expect(tombol.parentElement).toBe(h1.parentElement);
    expect(kolomTeks(tombol)).toBeTruthy();
  });

  it("tanpa_foto_aksi_tetap_di_kanan_header", () => {
    const { container } = render(
      <KepalaHalamanArea judul="Cetak Label" aksi={<button type="button">Cetak</button>} />,
    );
    const header = container.querySelector("header")!;
    expect(header.className.split(" ")).toEqual(expect.arrayContaining(["justify-between"]));
    expect(screen.getByRole("button", { name: "Cetak" }).parentElement).toBe(header);
  });
});

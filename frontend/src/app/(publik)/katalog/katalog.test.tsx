// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const respons = new Map<string, unknown>();
const dipanggil: string[] = [];
vi.mock("@/lib/api-server", () => ({
  ambilServer: async (path: string) => {
    dipanggil.push(path);
    if (!respons.has(path)) throw new Error(`respons palsu belum diatur: ${path}`);
    const r = respons.get(path);
    if (r instanceof Error) throw r;
    return r;
  },
}));

class TidakDitemukan extends Error {}
const dorong = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new TidakDitemukan("404");
  },
  useRouter: () => ({ push: dorong }),
}));

const { default: Beranda } = await import("../page");
const { default: Katalog } = await import("./page");
const { default: DetailBuku } = await import("./[id]/page");
const { default: Tentang } = await import("../tentang/page");
const { GalatApi } = await import("@/lib/galat");
const { BAGIAN_TENTANG, bagianTentang } = await import("@/lib/info-perpustakaan");
const { IsiTentang } = await import("@/components/publik/IsiTentang");
const { ikonKategori, IKON_KATEGORI_BAWAAN } = await import("@/components/katalog/ikon-kategori");

beforeEach(() => {
  respons.clear();
  dipanggil.length = 0;
  dorong.mockClear();
  // /katalog juga memuat daftar kategori untuk panel filter (OQ-44); test yang peduli menimpanya.
  respons.set("/katalog/kategori", []);
});
afterEach(cleanup);

// `tersedia`/`total` sengaja tidak bisa diturunkan dari isian lain: X/Y wajib dari respons apa adanya.
const JUDUL = {
  id: 7,
  isbn: "978-602-03-1234-5",
  judul: "Langit yang Sama",
  penulis: "Sari Dewi",
  penerbit: "Penerbit Nusa",
  tahun: 2020,
  kategori: { id: 3, nama: "Sejarah" },
  harga: 98000,
  cover_url: "/api/v1/katalog/judul/7/cover",
  rak: [
    { kode: "R-01", lokasi: "Lantai 1" },
    { kode: "R-02", lokasi: null },
  ],
  tersedia: 2,
  total: 5,
};
const KOSONG_EKSEMPLAR = {
  ...JUDUL,
  id: 8,
  judul: "Tanpa Sampul",
  isbn: "9786020000001",
  cover_url: null,
  rak: [],
  tersedia: 0,
  total: 0,
};
const halamanKatalog = (data: unknown[], total = data.length, halaman = 1) => ({
  data,
  total,
  halaman,
  per_halaman: 20,
});
const params = (p: Record<string, string>) => ({ searchParams: Promise.resolve(p) });
const detail = (id: string) => ({ params: Promise.resolve({ id }) });

/**
 * Foto dekoratif halaman publik di dalam `wadah`: `alt=""` dan pembungkus `aria-hidden` yang `hidden` di bawah
 * breakpoint-nya (tidak diunduh di layar kecil). Mengembalikan `src` setiap foto.
 */
function fotoDekoratif(wadah: Element) {
  return [...wadah.querySelectorAll("img")].map((img) => {
    expect(img.getAttribute("alt")).toBe("");
    expect(img.closest('[aria-hidden="true"]')?.classList.contains("hidden")).toBe(true);
    return img.getAttribute("src")!;
  });
}

describe("Katalog /katalog (FR-KTL-01/02/04, IR-UI-05)", () => {
  it("FR_KTL_02_q_dikirim_apa_adanya_dan_di_encode", async () => {
    const q = "  Bumi & Langit/100%";
    respons.set("/katalog/judul?q=++Bumi+%26+Langit%2F100%25&halaman=1", halamanKatalog([JUDUL]));
    render(await Katalog(params({ q })));
    expect(dipanggil).toContain("/katalog/judul?q=++Bumi+%26+Langit%2F100%25&halaman=1");
    // Isian q diisi dari URL apa adanya (tanpa trim).
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(q);
  });

  it("IR_UI_05_kolom_cari_di_atas_daftar_form_get_tanpa_halaman", async () => {
    respons.set("/katalog/judul?halaman=2", halamanKatalog([JUDUL], 25, 2));
    const { container } = render(await Katalog(params({ halaman: "2" })));
    const form = screen.getByRole("search");
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/katalog");
    // Hanya `q` yang dikirim: pencarian baru kembali ke halaman 1.
    expect([...form.querySelectorAll("[name]")].map((e) => e.getAttribute("name"))).toEqual(["q"]);
    // Kolom cari berada sebelum daftar buku.
    const daftar = container.querySelector("ul")!;
    expect(form.compareDocumentPosition(daftar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Menampilkan 21–21 dari 25 buku")).toBeTruthy();
  });

  it("FR_KTL_04_paginasi_mempertahankan_q", async () => {
    respons.set("/katalog/judul?q=sains+%26+alam&halaman=2", halamanKatalog([JUDUL], 65, 2));
    render(await Katalog(params({ q: "sains & alam", halaman: "2" })));
    expect(screen.getByRole("link", { name: "Berikutnya" }).getAttribute("href")).toBe(
      "/katalog?q=sains+%26+alam&halaman=3",
    );
    expect(screen.getByRole("link", { name: "Sebelumnya" }).getAttribute("href")).toBe(
      "/katalog?q=sains+%26+alam&halaman=1",
    );
  });

  it("FR_KTL_02_state_kosong_saat_data_kosong", async () => {
    respons.set("/katalog/judul?q=zzz&halaman=1", halamanKatalog([]));
    const { container } = render(await Katalog(params({ q: "zzz" })));
    expect(screen.getByText("Buku tidak ditemukan")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Lihat semua buku" }).getAttribute("href")).toBe(
      "/katalog",
    );
    expect(container.querySelector("article")).toBeNull();
  });

  it("FR_KTL_01_kartu_katalog_memuat_seluruh_isian", async () => {
    respons.set("/katalog/judul?halaman=1", halamanKatalog([JUDUL]));
    render(await Katalog(params({})));
    const kartu = screen.getByRole("article");
    const k = within(kartu);
    expect(kartu.querySelector("img")?.getAttribute("src")).toBe("/api/v1/katalog/judul/7/cover");
    expect(k.getByRole("link", { name: "Langit yang Sama" }).getAttribute("href")).toBe(
      "/katalog/7",
    );
    for (const teks of [
      "Sari Dewi",
      "Sejarah",
      "978-602-03-1234-5",
      "R-01 (Lantai 1), R-02",
      "Rp98.000",
      "2 dari 5 eksemplar tersedia",
    ]) {
      expect(k.getByText(teks)).toBeTruthy();
    }
    expect(kartu.textContent).toContain("Penerbit Nusa");
    expect(kartu.textContent).toContain("2020");
  });

  it("FR_KTL_03_OQ_23_x_dari_y_dan_0_dari_0_dari_respons", async () => {
    respons.set("/katalog/judul?halaman=1", halamanKatalog([JUDUL, KOSONG_EKSEMPLAR]));
    render(await Katalog(params({})));
    const [pertama, kedua] = screen.getAllByRole("article");
    expect(within(pertama).getByText("2 dari 5 eksemplar tersedia")).toBeTruthy();
    // OQ-23: judul tanpa eksemplar tetap tampil, rak kosong.
    expect(within(kedua).getByText("0 dari 0 eksemplar tersedia")).toBeTruthy();
    expect(within(kedua).getByText("—")).toBeTruthy();
  });

  it("FR_KTL_01_gambar_pengganti_saat_cover_url_null", async () => {
    respons.set("/katalog/judul?halaman=1", halamanKatalog([KOSONG_EKSEMPLAR]));
    render(await Katalog(params({})));
    const kartu = screen.getByRole("article");
    expect(kartu.querySelector("img")).toBeNull();
    expect(kartu.querySelector('[data-cover="pengganti"]')).not.toBeNull();
  });
});

describe("Detail /katalog/[id] (FR-KTL-01/03, hal-05)", () => {
  // OQ-46: detail memuat `deskripsi`; OQ-47: judul sekategori dari `kategori_id` (OQ-44), per_halaman 7.
  const DETAIL = { ...JUDUL, deskripsi: "Paragraf pertama.\nParagraf kedua." };
  const DETAIL_KOSONG = { ...KOSONG_EKSEMPLAR, deskripsi: null };
  const SEKATEGORI = "/katalog/judul?kategori_id=3&per_halaman=7";
  const lain = (id: number) => ({ ...JUDUL, id, judul: `Judul Lain ${id}` });

  it("FR_KTL_03_detail_x_dari_y_dan_OQ_22_rak_kode_plus_lokasi", async () => {
    respons.set("/katalog/judul/7", DETAIL);
    respons.set(SEKATEGORI, halamanKatalog([]));
    render(await DetailBuku(detail("7")));
    expect(screen.getByRole("heading", { level: 1, name: "Langit yang Sama" })).toBeTruthy();
    expect(screen.getByText("2 dari 5 eksemplar tersedia")).toBeTruthy();
    expect(screen.getByText("R-01 (Lantai 1)")).toBeTruthy();
    expect(screen.getByText("R-02")).toBeTruthy();
    expect(screen.getByText("Rp98.000")).toBeTruthy();
    expect(screen.getByText("978-602-03-1234-5")).toBeTruthy();
    // Breadcrumb hal-05: item terakhir "Detail Buku"; judul tetap di h1.
    const remah = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(remah).getByRole("link", { name: "Beranda" }).getAttribute("href")).toBe("/");
    expect(within(remah).getByText("Detail Buku").getAttribute("aria-current")).toBe("page");
  });

  it("BR_07_info_peminjaman_teks_baru_tanpa_angka", async () => {
    respons.set("/katalog/judul/7", DETAIL);
    respons.set(SEKATEGORI, halamanKatalog([]));
    render(await DetailBuku(detail("7")));
    expect(
      screen.getByRole("heading", { level: 2, name: "Peminjaman melalui petugas perpustakaan" }),
    ).toBeTruthy();
    const info = screen.getByText(/Kunjungi perpustakaan/);
    expect(info.textContent).toBe(
      "Kunjungi perpustakaan dan tunjukkan QR anggota kepada petugas. Peminjaman tidak dapat dilakukan secara online.",
    );
    expect(info.textContent).not.toMatch(/\d/);
  });

  it("FR_KTL_03_kotak_ketersediaan_besar_hijau_bila_ada_gold_bila_0", async () => {
    respons.set("/katalog/judul/7", DETAIL);
    respons.set(SEKATEGORI, halamanKatalog([]));
    render(await DetailBuku(detail("7")));
    const ada = screen.getByText("2 dari 5 eksemplar tersedia");
    expect(ada.getAttribute("data-tersedia")).toBe("ya");
    expect(ada.className).toContain("bg-status-tersedia-bg");
    expect(ada.className).toContain("text-lg");
    // Keputusan 1 (09/10/2026): tanpa pil "Tersedia".
    expect(screen.queryByText("Tersedia", { exact: true })).toBeNull();
    cleanup();

    respons.set("/katalog/judul/8", DETAIL_KOSONG);
    render(await DetailBuku(detail("8")));
    const kosong = screen.getByText("0 dari 0 eksemplar tersedia");
    expect(kosong.getAttribute("data-tersedia")).toBe("tidak");
    expect(kosong.className).not.toContain("status-tersedia");
    expect(kosong.className).toContain("text-gold-700");
    expect(kosong.className).toContain("bg-surface");
  });

  it("OQ_23_detail_0_dari_0_dan_gambar_pengganti", async () => {
    respons.set("/katalog/judul/8", DETAIL_KOSONG);
    respons.set(SEKATEGORI, halamanKatalog([]));
    const { container } = render(await DetailBuku(detail("8")));
    expect(screen.getByText("0 dari 0 eksemplar tersedia")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-cover="pengganti"]')).not.toBeNull();
    // Rak kosong → "—".
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("OQ_46_sinopsis_tampil_dengan_baris_baru", async () => {
    respons.set("/katalog/judul/7", { ...DETAIL, deskripsi: "Baris <b>satu</b>.\nBaris dua." });
    respons.set(SEKATEGORI, halamanKatalog([]));
    const { container } = render(await DetailBuku(detail("7")));
    const bagian = screen.getByRole("region", { name: "Sinopsis" });
    const p = bagian.querySelector("p")!;
    // Teks apa adanya (tanpa HTML), baris baru dipertahankan lewat whitespace-pre-line.
    expect(p.textContent).toBe("Baris <b>satu</b>.\nBaris dua.");
    expect(p.className).toContain("whitespace-pre-line");
    expect(container.querySelector("b")).toBeNull();
  });

  it("OQ_46_tanpa_deskripsi_bagian_sinopsis_tidak_tampil", async () => {
    respons.set("/katalog/judul/8", DETAIL_KOSONG);
    respons.set(SEKATEGORI, halamanKatalog([]));
    render(await DetailBuku(detail("8")));
    expect(screen.queryByText("Sinopsis")).toBeNull();
    expect(screen.queryByRole("region", { name: "Sinopsis" })).toBeNull();
  });

  it("OQ_47_buku_sekategori_tanpa_judul_ini_maks_6", async () => {
    respons.set("/katalog/judul/7", DETAIL);
    // Urutan API (A–Z) dipertahankan; judul yang sedang dibuka dibuang; sisanya dipotong 6.
    respons.set(
      SEKATEGORI,
      halamanKatalog([lain(1), JUDUL, lain(2), lain(3), lain(4), lain(5), lain(6)]),
    );
    render(await DetailBuku(detail("7")));
    expect(dipanggil).toEqual(["/katalog/judul/7", SEKATEGORI]);
    const bagian = screen.getByRole("region", { name: "Buku Lain dalam Kategori Sejarah" });
    const judul = within(bagian)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(judul).toEqual([1, 2, 3, 4, 5, 6].map((i) => `Judul Lain ${i}`));
    expect(within(bagian).queryByText("Langit yang Sama")).toBeNull();
    // Tanpa bookmark.
    expect(within(bagian).queryByRole("button")).toBeNull();
  });

  it("OQ_47_tanpa_judul_lain_bagian_tidak_tampil", async () => {
    respons.set("/katalog/judul/7", DETAIL);
    respons.set(SEKATEGORI, halamanKatalog([JUDUL]));
    render(await DetailBuku(detail("7")));
    expect(screen.queryByText(/Buku Lain dalam Kategori/)).toBeNull();
  });

  it("OQ_47_galat_sekategori_detail_tetap_tampil", async () => {
    respons.set("/katalog/judul/7", DETAIL);
    respons.set(SEKATEGORI, new GalatApi(500, "SISTEM", "x", null, {}, true));
    render(await DetailBuku(detail("7")));
    expect(screen.getByRole("heading", { level: 1, name: "Langit yang Sama" })).toBeTruthy();
    expect(screen.queryByText(/Buku Lain dalam Kategori/)).toBeNull();
  });

  it("OQ_47_tautan_lihat_semua_ke_kategori", async () => {
    respons.set("/katalog/judul/7", DETAIL);
    respons.set(SEKATEGORI, halamanKatalog([lain(1)]));
    render(await DetailBuku(detail("7")));
    const bagian = screen.getByRole("region", { name: "Buku Lain dalam Kategori Sejarah" });
    expect(within(bagian).getByRole("link", { name: "Lihat semua" }).getAttribute("href")).toBe(
      "/katalog?kategori_id=3",
    );
  });

  it("FR_KTL_03_detail_404_notFound", async () => {
    respons.set(
      "/katalog/judul/99",
      new GalatApi(404, "KTL_JUDUL_TIDAK_ADA", "Judul tidak ditemukan.", "FR-KTL-03", {}, false),
    );
    await expect(DetailBuku(detail("99"))).rejects.toBeInstanceOf(TidakDitemukan);
    // id bukan bilangan bulat positif → 404 tanpa memanggil API.
    await expect(DetailBuku(detail("abc"))).rejects.toBeInstanceOf(TidakDitemukan);
    expect(dipanggil).toEqual(["/katalog/judul/99"]);
  });

  it("detail_galat_selain_404_diteruskan_ke_batas_galat", async () => {
    const galat = new GalatApi(500, "SISTEM", "x", null, {}, true);
    respons.set("/katalog/judul/7", galat);
    await expect(DetailBuku(detail("7"))).rejects.toBe(galat);
  });
});

describe("Katalog /katalog — filter & urutan (OQ-44, hal-03/04)", () => {
  const KATEGORI = Array.from({ length: 11 }, (_, i) => ({
    id: i + 1,
    nama: `Kategori ${String.fromCharCode(65 + i)}`,
  }));
  const SEMUA = {
    q: "sejarah",
    kategori_id: ["2", "10"],
    tersedia: "true",
    tahun_dari: "2000",
    tahun_sampai: "2020",
    urut: "tahun_terbaru",
    halaman: "2",
  };
  const PATH_SEMUA =
    "/katalog/judul?q=sejarah&kategori_id=2&kategori_id=10&tersedia=true&tahun_dari=2000" +
    "&tahun_sampai=2020&urut=tahun_terbaru&halaman=2";
  const URL_SEMUA =
    "/katalog?q=sejarah&kategori_id=2&kategori_id=10&tersedia=true&tahun_dari=2000" +
    "&tahun_sampai=2020&urut=tahun_terbaru";
  const searchParams = (p: Record<string, string | string[]>) => ({
    searchParams: Promise.resolve(p),
  });
  const renderSemua = async (data = halamanKatalog([JUDUL], 45, 2)) => {
    respons.set("/katalog/kategori", KATEGORI);
    respons.set(PATH_SEMUA, data);
    return render(await Katalog(searchParams(SEMUA)));
  };
  const namaIsian = (form: HTMLElement) =>
    [...form.querySelectorAll("input[type=hidden]")].map((e) => [
      e.getAttribute("name"),
      (e as HTMLInputElement).value,
    ]);

  it("OQ_44_semua_parameter_dikirim_ke_api_dan_kategori_dimuat", async () => {
    await renderSemua();
    expect(dipanggil).toEqual(expect.arrayContaining([PATH_SEMUA, "/katalog/kategori"]));
  });

  it("OQ_44_panel_filter_form_get_hidden_q_urut_tanpa_halaman", async () => {
    await renderSemua();
    const form = screen.getByRole("form", { name: "Filter Pencarian" });
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/katalog");
    expect(namaIsian(form)).toEqual([
      ["q", "sejarah"],
      ["urut", "tahun_terbaru"],
    ]);
    expect(form.querySelector("[name=halaman]")).toBeNull();
    expect(within(form).getByRole("button", { name: "Terapkan" })).toBeTruthy();
  });

  it("OQ_44_checkbox_dan_isian_sesuai_url", async () => {
    await renderSemua();
    const form = screen.getByRole("form", { name: "Filter Pencarian" });
    const centang = (nama: string) =>
      (within(form).getByRole("checkbox", { name: nama }) as HTMLInputElement).checked;
    expect(centang("Kategori B")).toBe(true);
    expect(centang("Kategori J")).toBe(true);
    expect(centang("Kategori A")).toBe(false);
    expect(centang("Tersedia sekarang")).toBe(true);
    const cb = within(form).getByRole("checkbox", { name: "Kategori B" }) as HTMLInputElement;
    expect([cb.name, cb.value]).toEqual(["kategori_id", "2"]);
    const tersedia = within(form).getByRole("checkbox", { name: "Tersedia sekarang" });
    expect([tersedia.getAttribute("name"), tersedia.getAttribute("value")]).toEqual([
      "tersedia",
      "true",
    ]);
    const dari = within(form).getByRole("textbox", {
      name: "Tahun terbit dari",
    }) as HTMLInputElement;
    const sampai = within(form).getByRole("textbox", {
      name: "Tahun terbit sampai",
    }) as HTMLInputElement;
    expect([dari.name, dari.value, dari.inputMode]).toEqual(["tahun_dari", "2000", "numeric"]);
    expect([sampai.name, sampai.value]).toEqual(["tahun_sampai", "2020"]);
    // Klien tidak memutuskan batas (IR-UI-04): tanpa min/max/pattern.
    expect(["min", "max", "pattern"].some((a) => dari.hasAttribute(a))).toBe(false);
  });

  it("OQ_44_kategori_lebih_dari_8_lihat_lebih_banyak", async () => {
    respons.set("/katalog/kategori", KATEGORI);
    respons.set("/katalog/judul?halaman=1", halamanKatalog([JUDUL]));
    render(await Katalog(searchParams({})));
    const form = screen.getByRole("form", { name: "Filter Pencarian" });
    const details = form.querySelector("details")!;
    expect(details.querySelector("summary")!.textContent).toContain("Lihat lebih banyak");
    const diLuar = (nama: string) =>
      !details.contains(within(form).getByRole("checkbox", { name: nama }));
    expect(KATEGORI.slice(0, 8).every((k) => diLuar(k.nama))).toBe(true);
    expect(KATEGORI.slice(8).some((k) => diLuar(k.nama))).toBe(false);
  });

  it("OQ_44_kategori_tercentang_di_luar_8_teratas_tetap_tampil", async () => {
    await renderSemua(); // Kategori J (id 10) tercentang, urutan ke-10
    const form = screen.getByRole("form", { name: "Filter Pencarian" });
    const details = form.querySelector("details")!;
    expect(details.contains(within(form).getByRole("checkbox", { name: "Kategori J" }))).toBe(
      false,
    );
    expect(details.contains(within(form).getByRole("checkbox", { name: "Kategori I" }))).toBe(true);
  });

  it("OQ_44_tanpa_details_bila_kategori_maks_8", async () => {
    respons.set("/katalog/kategori", KATEGORI.slice(0, 8));
    respons.set("/katalog/judul?halaman=1", halamanKatalog([JUDUL]));
    render(await Katalog(searchParams({})));
    expect(
      screen.getByRole("form", { name: "Filter Pencarian" }).querySelector("details"),
    ).toBeNull();
  });

  it("OQ_44_reset_semua_mempertahankan_q", async () => {
    await renderSemua();
    expect(screen.getByRole("link", { name: "Reset Semua" }).getAttribute("href")).toBe(
      "/katalog?q=sejarah",
    );
  });

  it("OQ_44_chip_hapus_satu_parameter", async () => {
    await renderSemua();
    const chip = screen.getByRole("list", { name: "Filter aktif" });
    const href = (nama: string) =>
      within(chip)
        .getByRole("link", { name: `Hapus filter ${nama}` })
        .getAttribute("href");
    expect(href("Kata kunci: sejarah")).toBe(URL_SEMUA.replace("q=sejarah&", ""));
    expect(href("Kategori: Kategori B")).toBe(URL_SEMUA.replace("kategori_id=2&", ""));
    expect(href("Tersedia sekarang")).toBe(URL_SEMUA.replace("tersedia=true&", ""));
    expect(href("Tahun dari: 2000")).toBe(URL_SEMUA.replace("tahun_dari=2000&", ""));
    expect(within(chip).getAllByRole("link")).toHaveLength(6);
  });

  it("OQ_44_chip_kategori_tidak_dikenal", async () => {
    respons.set("/katalog/kategori", KATEGORI);
    respons.set("/katalog/judul?kategori_id=99&halaman=1", halamanKatalog([]));
    render(await Katalog(searchParams({ kategori_id: "99" })));
    expect(
      screen
        .getByRole("link", { name: "Hapus filter Kategori tidak dikenal" })
        .getAttribute("href"),
    ).toBe("/katalog");
  });

  it("OQ_44_urutkan_ganti_ke_halaman_1", async () => {
    await renderSemua();
    const pilih = screen.getByRole("combobox", { name: "Urutkan" }) as HTMLSelectElement;
    expect([...pilih.options].map((o) => o.textContent)).toEqual([
      "Judul A–Z",
      "Tahun terbit (terbaru)",
      "Tahun terbit (terlama)",
    ]);
    expect(pilih.value).toBe("tahun_terbaru");
    fireEvent.change(pilih, { target: { value: "tahun_terlama" } });
    expect(dorong).toHaveBeenLastCalledWith(URL_SEMUA.replace("tahun_terbaru", "tahun_terlama"));
    fireEvent.change(pilih, { target: { value: "judul_az" } });
    expect(dorong).toHaveBeenLastCalledWith(URL_SEMUA.replace("&urut=tahun_terbaru", ""));
  });

  it("FR_KTL_04_OQ_44_paginasi_membawa_semua_parameter", async () => {
    await renderSemua();
    expect(screen.getByRole("link", { name: "Berikutnya" }).getAttribute("href")).toBe(
      `${URL_SEMUA}&halaman=3`,
    );
    expect(screen.getByRole("link", { name: "Sebelumnya" }).getAttribute("href")).toBe(
      `${URL_SEMUA}&halaman=1`,
    );
  });

  it("FR_KTL_02_OQ_44_ditemukan_n_buku_untuk_kata_kunci_dan_filter", async () => {
    await renderSemua(halamanKatalog([JUDUL], 1234, 2));
    expect(screen.getByRole("heading", { level: 2, name: /^Ditemukan/ }).textContent).toBe(
      "Ditemukan 1.234 buku untuk “sejarah, Kategori B, Kategori J, Tersedia sekarang, tahun 2000–2020”",
    );
  });

  it("FR_KTL_02_ditemukan_n_buku_untuk_q_saja", async () => {
    respons.set("/katalog/judul?q=sejarah&halaman=1", halamanKatalog([JUDUL], 32));
    render(await Katalog(searchParams({ q: "sejarah" })));
    expect(screen.getByRole("heading", { level: 2, name: /^Ditemukan/ }).textContent).toBe(
      "Ditemukan 32 buku untuk “sejarah”",
    );
  });

  it("OQ_44_judul_ditemukan_hanya_filter_tanpa_kata_kunci", async () => {
    respons.set("/katalog/kategori", KATEGORI);
    respons.set("/katalog/judul?kategori_id=2&halaman=1", halamanKatalog([JUDUL], 32));
    render(await Katalog(searchParams({ kategori_id: "2" })));
    expect(screen.getByRole("heading", { level: 2, name: /^Ditemukan/ }).textContent).toBe(
      "Ditemukan 32 buku untuk “Kategori B”",
    );
  });

  it("OQ_44_tanpa_kata_kunci_dan_filter_tanpa_judul_ditemukan", async () => {
    respons.set("/katalog/judul?urut=tahun_terlama&halaman=1", halamanKatalog([JUDUL]));
    render(await Katalog(searchParams({ urut: "tahun_terlama" })));
    expect(screen.queryByRole("heading", { level: 2, name: /^Ditemukan/ })).toBeNull();
  });

  it("OQ_44_form_cari_katalog_membawa_filter_urutan_tanpa_halaman", async () => {
    await renderSemua();
    const form = screen.getByRole("search");
    expect(form.getAttribute("action")).toBe("/katalog");
    expect(namaIsian(form)).toEqual([
      ["kategori_id", "2"],
      ["kategori_id", "10"],
      ["tersedia", "true"],
      ["tahun_dari", "2000"],
      ["tahun_sampai", "2020"],
      ["urut", "tahun_terbaru"],
    ]);
    expect(form.querySelector("[name=halaman]")).toBeNull();
    expect((within(form).getByRole("searchbox") as HTMLInputElement).value).toBe("sejarah");
  });

  it("OQ_44_form_cari_beranda_hanya_q", async () => {
    respons.set("/katalog/judul?halaman=1&per_halaman=6", halamanKatalog([JUDUL]));
    render(await Beranda());
    const form = screen.getByRole("search");
    expect([...form.querySelectorAll("[name]")].map((e) => e.getAttribute("name"))).toEqual(["q"]);
  });

  it("IR_UI_04_OQ_44_galat_422_tampil_apa_adanya_panel_tetap", async () => {
    const pesan = "Rentang tahun tidak valid: tahun awal 2024 setelah tahun akhir 2020.";
    respons.set("/katalog/kategori", KATEGORI);
    respons.set(
      "/katalog/judul?tahun_dari=2024&tahun_sampai=2020&halaman=1",
      new GalatApi(422, "KTL_RENTANG_TAHUN_TIDAK_VALID", pesan, "OQ-44", {}, false),
    );
    const { container } = render(
      await Katalog(searchParams({ tahun_dari: "2024", tahun_sampai: "2020" })),
    );
    expect(screen.getByRole("alert").textContent).toContain(pesan);
    expect(screen.getByRole("form", { name: "Filter Pencarian" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Filter aktif" })).toBeTruthy();
    expect(container.querySelector("article")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Navigasi halaman" })).toBeNull();
  });

  it("OQ_44_galat_non_422_diteruskan_ke_error_tsx", async () => {
    const galat = new GalatApi(500, "SISTEM", "x", null, {}, true);
    respons.set("/katalog/judul?tersedia=true&halaman=1", galat);
    await expect(Katalog(searchParams({ tersedia: "true" }))).rejects.toBe(galat);
  });

  it("OQ_44_state_kosong_dengan_filter", async () => {
    respons.set("/katalog/kategori", KATEGORI);
    respons.set("/katalog/judul?q=zzz&tersedia=true&halaman=1", halamanKatalog([]));
    const { container } = render(await Katalog(searchParams({ q: "zzz", tersedia: "true" })));
    expect(screen.getByText("Tidak ada buku yang cocok dengan filter")).toBeTruthy();
    const reset = screen.getAllByRole("link", { name: "Reset Semua" });
    expect(reset.every((r) => r.getAttribute("href") === "/katalog?q=zzz")).toBe(true);
    expect(reset.length).toBe(2); // panel + state kosong
    expect(container.querySelector("article")).toBeNull();
  });

  it("OQ_44_tombol_filter_mobile_aria_expanded", async () => {
    await renderSemua();
    const tombol = screen.getByRole("button", { name: "Filter" });
    const panel = document.getElementById(tombol.getAttribute("aria-controls")!)!;
    expect(tombol.getAttribute("aria-expanded")).toBe("false");
    expect(panel.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(panel.className).toContain("lg:block");
    fireEvent.click(tombol);
    expect(tombol.getAttribute("aria-expanded")).toBe("true");
    expect(panel.className).not.toMatch(/(^|\s)hidden(\s|$)/);
  });

  it("hal_03_hero_katalog_foto_dekoratif_kolom_cari_di_dalamnya", async () => {
    await renderSemua();
    const hero = screen.getByRole("heading", { level: 1 }).closest("header")!;
    expect(within(hero).getByRole("search")).toBeTruthy();
    expect(fotoDekoratif(hero)).toEqual([expect.stringContaining("banner-katalog")]);
  });

  it("FR_KTL_01_OQ_44_kartu_vertikal_cover_di_atas", async () => {
    await renderSemua();
    const kartu = screen.getByRole("article");
    expect(kartu.className).toContain("flex-col");
    expect(within(kartu).getByText("2 dari 5 eksemplar tersedia")).toBeTruthy();
  });
});

describe("Beranda / (FR-KTL-05, OQ-43)", () => {
  it("OQ_43_OQ_44_beranda_tautan_kategori_ke_katalog_kategori_id", async () => {
    respons.set("/katalog/kategori", [
      { id: 1, nama: "Fiksi" },
      { id: 2, nama: "Sains & Teknologi" },
    ]);
    respons.set("/katalog/judul?halaman=1&per_halaman=6", halamanKatalog([JUDUL]));
    render(await Beranda());
    const bagian = screen.getByRole("region", { name: "Kategori Populer" });
    expect(
      within(bagian)
        .getByRole("link", { name: /Sains & Teknologi/ })
        .getAttribute("href"),
    ).toBe("/katalog?kategori_id=2");
    expect(within(bagian).getByRole("link", { name: /Fiksi/ }).getAttribute("href")).toBe(
      "/katalog?kategori_id=1",
    );
    // OQ-43 (perubahan 2026-10-06): judul "Kategori Populer" hanya label. OQ-44: tautan → kategori_id (hasil tepat).
    expect(screen.getByRole("heading", { level: 2, name: "Kategori Populer" })).toBeTruthy();
  });

  it("FR_KTL_05_beranda_kolom_cari_dan_cuplikan_koleksi_dari_api", async () => {
    respons.set("/katalog/kategori", []);
    respons.set("/katalog/judul?halaman=1&per_halaman=6", halamanKatalog([JUDUL]));
    render(await Beranda());
    expect(screen.getByRole("search").getAttribute("action")).toBe("/katalog");
    expect(screen.getByText("Belum ada kategori")).toBeTruthy();
    const koleksi = screen.getByRole("region", { name: "Koleksi Buku" });
    expect(within(koleksi).getByText("2 dari 5 tersedia")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Daftar Anggota" }).getAttribute("href")).toBe(
      "/daftar",
    );
    // Tanpa bagian di luar sumber (keputusan review): tanpa "terbaru"/"rekomendasi".
    expect(screen.queryByText(/terbaru|rekomendasi/i)).toBeNull();
  });

  it("OQ_43_beranda_semua_kategori_tampil_dengan_ikon_generik", async () => {
    const nama = [
      "Agama",
      "Anak",
      "Fiksi",
      "Komputer",
      "Nonfiksi",
      "Referensi",
      "Sains",
      "Sejarah",
    ];
    respons.set(
      "/katalog/kategori",
      nama.map((n, i) => ({ id: i + 1, nama: n })),
    );
    respons.set("/katalog/judul?halaman=1&per_halaman=6", halamanKatalog([]));
    render(await Beranda());
    const tautan = within(screen.getByRole("region", { name: "Kategori Populer" })).getAllByRole(
      "link",
    );
    // Semua kategori dari API, urutan apa adanya: "Populer" hanya label, tanpa penyaringan/peringkat.
    expect(tautan.map((t) => t.textContent)).toEqual(nama);
    // Ikon tiap kartu mengikuti ikonKategori(nama); kategori data uji tidak semuanya berikon sama.
    const ikon = tautan.map((t) => t.querySelector("svg")?.innerHTML);
    expect(new Set(ikon).size).toBe(nama.length);
  });

  it("OQ_43_ikon_kategori_dari_kata_kunci_nama_dengan_cadangan", () => {
    expect(ikonKategori("Fiksi")).toBe("bukuIsi");
    // "nonfiksi" tidak boleh tertangkap aturan "fiksi".
    expect(ikonKategori("Nonfiksi")).toBe("bohlamIsi");
    expect(ikonKategori("Non-Fiksi")).toBe("bohlamIsi");
    expect(ikonKategori("  SEJARAH Indonesia ")).toBe("gedungIsi");
    expect(ikonKategori("Sains")).toBe("atom");
    expect(ikonKategori("Komputer")).toBe("laptopIsi");
    expect(ikonKategori("Buku Anak")).toBe("beruangIsi");
    expect(ikonKategori("Biografi")).toBe("orangIsi");
    expect(ikonKategori("Agama")).toBe("lenteraIsi");
    expect(ikonKategori("Referensi")).toBe("bukuTutupIsi");
    // Nama tak dikenali (kategori baru/diganti nama admin) → ikon buku generik, bukan galat.
    expect(ikonKategori("Pengembangan Diri")).toBe(IKON_KATEGORI_BAWAAN);
    expect(ikonKategori("")).toBe(IKON_KATEGORI_BAWAAN);
  });

  it("FR_KTL_05_beranda_kartu_ringkas_cover_judul_penulis_kategori_ketersediaan", async () => {
    respons.set("/katalog/kategori", []);
    respons.set(
      "/katalog/judul?halaman=1&per_halaman=6",
      halamanKatalog([JUDUL, KOSONG_EKSEMPLAR]),
    );
    render(await Beranda());
    const koleksi = screen.getByRole("region", { name: "Koleksi Buku" });
    const [kartu, kartuKosong] = within(koleksi).getAllByRole("article");
    expect(within(kartu).getByRole("link", { name: "Langit yang Sama" }).getAttribute("href")).toBe(
      "/katalog/7",
    );
    expect(within(kartu).getByText("Sari Dewi")).toBeTruthy();
    expect(within(kartu).getByText("Sejarah")).toBeTruthy();
    // Keputusan 2026-10-06: teks ringkas di kartu beranda; teks lengkap tetap di `title`; hijau bila ada.
    const badge = within(kartu).getByText("2 dari 5 tersedia");
    expect(badge.getAttribute("title")).toBe("2 dari 5 eksemplar tersedia");
    expect(badge.getAttribute("data-tersedia")).toBe("ya");
    expect(badge.className).toContain("bg-status-tersedia-bg");
    expect(kartu.querySelector("img")?.getAttribute("src")).toBe("/api/v1/katalog/judul/7/cover");
    // X/Y apa adanya dari API; cover null → gambar pengganti; tanpa badge hijau "Tersedia".
    // 0 tersedia: bukan hijau (tetap gold-700).
    const badgeKosong = within(kartuKosong).getByText("0 dari 0 tersedia");
    expect(badgeKosong.getAttribute("data-tersedia")).toBe("tidak");
    expect(badgeKosong.className).not.toContain("status-tersedia");
    expect(badgeKosong.className).toContain("text-gold-700");
    expect(kartuKosong.querySelector('[data-cover="pengganti"]')).not.toBeNull();
    expect(within(koleksi).queryByText(/^Tersedia$/)).toBeNull();
    // D4: isian lengkap FR-KTL-01 hanya di /katalog & detail, tidak di kartu ringkas beranda.
    expect(koleksi.textContent).not.toContain(JUDUL.isbn);
    expect(koleksi.textContent).not.toContain(JUDUL.penerbit);
    expect(koleksi.textContent).not.toContain("Rp98.000");
  });

  it("FR_KTL_05_beranda_hero_tentang_profil_dan_cta_daftar_BR_03", async () => {
    respons.set("/katalog/kategori", []);
    respons.set("/katalog/judul?halaman=1&per_halaman=6", halamanKatalog([]));
    const { container } = render(await Beranda());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Temukan Buku, Jelajahi Pengetahuan",
    );
    // Hero: satu foto dekoratif (menggantikan panel CSS D1), hanya mulai `lg`.
    const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
    expect(fotoDekoratif(hero)).toEqual([expect.stringContaining("hero-beranda")]);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    // D5: teks Tentang = paragraf Profil dari sumber bersama, bukan teks baru.
    const tentang = screen.getByRole("region", { name: "Tentang Perpustakaan Naratif" });
    const profil = bagianTentang("Profil")?.paragraf?.[0];
    expect(profil).toBeTruthy();
    expect(within(tentang).getByText(profil!)).toBeTruthy();
    expect(
      within(tentang).getByRole("link", { name: "Pelajari Lebih Lanjut" }).getAttribute("href"),
    ).toBe("/tentang");
    for (const t of [
      "Katalog Daring Tanpa Login",
      "Pinjam dengan QR Anggota",
      "Ruang Baca di Tempat",
    ]) {
      expect(screen.getByText(t)).toBeTruthy();
    }
    const cta = screen.getByRole("region", { name: /Daftar Sekarang/ });
    expect(cta.textContent).toContain("akun anggota langsung aktif");
    expect(within(cta).getByRole("link", { name: "Daftar Anggota" }).getAttribute("href")).toBe(
      "/daftar",
    );
    // Tanpa klaim di luar sumber (angka koleksi, kegiatan literasi).
    expect(container.textContent).not.toMatch(/ribuan|kegiatan literasi/i);
  });
});

describe("Tentang /tentang (FR-KTL-05)", () => {
  it("FR_KTL_05_tentang_bagian_terisi_bukan_penanda", () => {
    const { container } = render(<Tentang />);
    const judul = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(judul).toEqual([
      "Profil",
      "Nilai / Visi",
      "Fasilitas & Layanan",
      "Alamat",
      "Jam Buka",
      "Kontak",
      "Daftar Sekarang, Mulai Perjalanan Membaca Anda",
    ]);
    // Bagian yang datanya lengkap tidak memuat penanda sama sekali.
    for (const nama of judul) {
      const bagian = screen.getByRole("heading", { level: 2, name: nama }).parentElement!;
      expect(bagian.querySelector("[data-penanda]")).toBeNull();
      expect(bagian.textContent).not.toMatch(/PENANDA|\[/);
    }
    expect(container.textContent).toContain("Perpustakaan Naratif adalah perpustakaan umum");
    expect(container.textContent).toContain(
      "Peminjaman buku fisik: maksimal 3 buku dipinjam pada saat yang sama, masa pinjam 30 hari.",
    );
    expect(container.textContent).toContain("Senin–Jumat: 08.00–17.00 WIB");
    expect(container.textContent).toContain("Telepon: (021) 555-0123");
    expect(container.textContent).toContain("Email: info@naratif.id");
    // "Dalam Angka" tidak diisi pemilik proyek → dihapus, bukan dikarang.
    expect(screen.queryByText(/dalam angka/i)).toBeNull();
    // Tanpa layanan di luar lingkup (domain-rules §13).
    expect(container.textContent).not.toMatch(/e-book|digital|reservasi|booking|perpanjang/i);
  });

  it("FR_KTL_05_tentang_tanpa_penanda_tersisa", () => {
    const { container } = render(<Tentang />);
    expect(container.querySelectorAll("[data-penanda]")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/PENANDA|Menunggu data/);
    const alamat = screen.getByRole("heading", { level: 2, name: "Alamat" }).parentElement!;
    expect(alamat.textContent).toContain(
      "Jl. Surya Kencana No. 58, Pamulang Barat, Kec. Pamulang, Kota Tangerang Selatan, Banten 15417",
    );
  });

  it("FR_KTL_05_tentang_tata_letak_isi_apa_adanya", () => {
    const { container } = render(<Tentang />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Tentang Perpustakaan Naratif",
    );
    // hal-06: foto hero + foto di samping Profil, keduanya dekoratif (bukan foto ruangan sebenarnya).
    expect(fotoDekoratif(container)).toEqual([
      expect.stringContaining("hero-tentang"),
      expect.stringContaining("profil-tentang"),
    ]);

    // Keputusan 1: paragraf pertama Profil UTUH jadi pembuka hero, tidak diulang di bagian Profil.
    const [pembuka, ...sisaProfil] = bagianTentang("Profil")!.paragraf!;
    const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
    expect(within(hero).getByText(pembuka).textContent).toBe(pembuka);
    expect(container.textContent!.split(pembuka)).toHaveLength(2);
    const profil = screen.getByRole("heading", { level: 2, name: "Profil" }).parentElement!;
    expect(profil.textContent).not.toContain(pembuka);
    for (const p of sisaProfil) expect(within(profil).getByText(p).textContent).toBe(p);

    // Keputusan 3: kartu nilai tanpa judul, hanya ikon + kalimat apa adanya.
    const nilai = screen.getByRole("heading", { level: 2, name: "Nilai / Visi" }).parentElement!;
    expect(
      within(nilai)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(bagianTentang("Nilai / Visi")!.daftar);
    expect(within(nilai).queryAllByRole("heading", { level: 3 })).toHaveLength(0);

    // Label fasilitas = bagian sebelum titik dua PERTAMA; textContent item tetap sama persis dengan data.
    const fasilitas = screen.getByRole("heading", {
      level: 2,
      name: "Fasilitas & Layanan",
    }).parentElement!;
    const data = bagianTentang("Fasilitas & Layanan")!.daftar!;
    const item = within(fasilitas).getAllByRole("listitem");
    expect(item.map((li) => li.textContent)).toEqual(data);
    item.forEach((li, i) => {
      const titik = data[i].indexOf(":");
      const label = li.querySelector("strong");
      if (titik < 0) expect(label).toBeNull();
      else expect(label?.textContent).toBe(data[i].slice(0, titik + 1));
    });

    // Keputusan 4: tanpa tautan peta.
    expect(container.textContent).not.toMatch(/peta/i);
    expect(container.querySelector('a[href*="maps"]')).toBeNull();

    // Keputusan 5: kartu CTA bersama beranda (BR-03).
    const cta = screen.getByRole("region", { name: /Daftar Sekarang/ });
    expect(within(cta).getByRole("link", { name: "Daftar Anggota" }).getAttribute("href")).toBe(
      "/daftar",
    );
  });

  it("FR_KTL_05_tentang_penanda_tampil_di_setiap_slot_bagian", () => {
    // Bila satu bagian kehilangan datanya (`menunggu` terisi), slotnya wajib menampilkan penanda,
    // tidak boleh kosong diam-diam (halaman tidak lolos UAT selama penanda ada).
    for (const { judul } of BAGIAN_TENTANG) {
      const bagian = BAGIAN_TENTANG.map((b) =>
        b.judul === judul ? { judul, menunggu: `uji ${judul}` } : b,
      );
      const { container } = render(<IsiTentang bagian={bagian} />);
      const slot = screen.getByRole("heading", { level: 2, name: judul }).parentElement!;
      const penanda = slot.querySelectorAll("[data-penanda]");
      expect(penanda, judul).toHaveLength(1);
      expect(penanda[0].textContent).toBe(
        `[PENANDA] Menunggu data dari pengelola perpustakaan: uji ${judul}.`,
      );
      expect(container.querySelectorAll("[data-penanda]"), judul).toHaveLength(1);
      cleanup();
    }
  });
});

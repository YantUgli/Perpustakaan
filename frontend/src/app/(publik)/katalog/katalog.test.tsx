// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
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
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new TidakDitemukan("404");
  },
}));

const { default: Beranda } = await import("../page");
const { default: Katalog } = await import("./page");
const { default: DetailBuku } = await import("./[id]/page");
const { default: Tentang } = await import("../tentang/page");
const { GalatApi } = await import("@/lib/galat");

beforeEach(() => {
  respons.clear();
  dipanggil.length = 0;
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

describe("Katalog /katalog (FR-KTL-01/02/04, IR-UI-05)", () => {
  it("FR_KTL_02_q_dikirim_apa_adanya_dan_di_encode", async () => {
    const q = "  Bumi & Langit/100%";
    respons.set("/katalog/judul?q=++Bumi+%26+Langit%2F100%25&halaman=1", halamanKatalog([JUDUL]));
    render(await Katalog(params({ q })));
    expect(dipanggil).toEqual(["/katalog/judul?q=++Bumi+%26+Langit%2F100%25&halaman=1"]);
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

describe("Detail /katalog/[id] (FR-KTL-01/03)", () => {
  it("FR_KTL_03_detail_x_dari_y_dan_OQ_22_rak_kode_plus_lokasi", async () => {
    respons.set("/katalog/judul/7", JUDUL);
    render(await DetailBuku(detail("7")));
    expect(screen.getByRole("heading", { level: 1, name: "Langit yang Sama" })).toBeTruthy();
    expect(screen.getByText("2 dari 5 eksemplar tersedia")).toBeTruthy();
    expect(screen.getByText("R-01 (Lantai 1)")).toBeTruthy();
    expect(screen.getByText("R-02")).toBeTruthy();
    expect(screen.getByText("Rp98.000")).toBeTruthy();
    expect(screen.getByText("978-602-03-1234-5")).toBeTruthy();
    // BR-07, keputusan review: tanpa angka batas pinjam / lama pinjam.
    const info = screen.getByText(/Peminjaman dilayani petugas/);
    expect(info.textContent).toBe(
      "Peminjaman dilayani petugas di perpustakaan dengan menunjukkan QR anggota.",
    );
  });

  it("OQ_23_detail_0_dari_0_dan_gambar_pengganti", async () => {
    respons.set("/katalog/judul/8", KOSONG_EKSEMPLAR);
    const { container } = render(await DetailBuku(detail("8")));
    expect(screen.getByText("0 dari 0 eksemplar tersedia")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-cover="pengganti"]')).not.toBeNull();
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

describe("Beranda / (FR-KTL-05, OQ-43)", () => {
  it("OQ_43_tautan_kategori_ke_katalog_q_nama_ter_encode", async () => {
    respons.set("/katalog/kategori", [
      { id: 1, nama: "Fiksi" },
      { id: 2, nama: "Sains & Teknologi" },
    ]);
    respons.set("/katalog/judul?halaman=1&per_halaman=6", halamanKatalog([JUDUL]));
    render(await Beranda());
    const bagian = screen.getByRole("region", { name: "Kategori" });
    expect(
      within(bagian)
        .getByRole("link", { name: /Sains & Teknologi/ })
        .getAttribute("href"),
    ).toBe("/katalog?q=Sains+%26+Teknologi");
    expect(within(bagian).getByRole("link", { name: /Fiksi/ }).getAttribute("href")).toBe(
      "/katalog?q=Fiksi",
    );
    // OQ-43: judul bagian "Kategori", tanpa konsep "populer".
    expect(screen.queryByText(/populer/i)).toBeNull();
  });

  it("FR_KTL_05_beranda_kolom_cari_dan_cuplikan_koleksi_dari_api", async () => {
    respons.set("/katalog/kategori", []);
    respons.set("/katalog/judul?halaman=1&per_halaman=6", halamanKatalog([JUDUL]));
    render(await Beranda());
    expect(screen.getByRole("search").getAttribute("action")).toBe("/katalog");
    expect(screen.getByText("Belum ada kategori")).toBeTruthy();
    const koleksi = screen.getByRole("region", { name: "Koleksi Buku" });
    expect(within(koleksi).getByText("2 dari 5 eksemplar tersedia")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Daftar Sekarang" }).getAttribute("href")).toBe(
      "/daftar",
    );
    // Tanpa bagian di luar sumber (keputusan review): tanpa "terbaru"/"rekomendasi".
    expect(screen.queryByText(/terbaru|rekomendasi/i)).toBeNull();
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
});

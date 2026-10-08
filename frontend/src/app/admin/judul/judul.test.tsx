// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
const router = { refresh: vi.fn(), replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  notFound: () => {
    throw new TidakDitemukan("404");
  },
}));

const { default: DaftarJudul } = await import("./page");
const { default: JudulBaru } = await import("./baru/page");
const { default: DetailJudul } = await import("./[id]/page");
const { default: UbahJudul } = await import("./[id]/ubah/page");
const { FormJudul } = await import("./FormJudul");
const { PanelEksemplar } = await import("./[id]/PanelEksemplar");
const { HapusJudul } = await import("./[id]/HapusJudul");
const { GalatApi } = await import("@/lib/galat");

// jsdom belum mengimplementasikan <dialog>.showModal/close.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

const fetchPalsu = vi.fn();
beforeEach(() => {
  respons.clear();
  dipanggil.length = 0;
  router.refresh.mockReset();
  router.push.mockReset();
  fetchPalsu.mockReset();
  vi.stubGlobal("fetch", fetchPalsu);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const KATEGORI = [
  { id: 1, nama: "Fiksi" },
  { id: 3, nama: "Sejarah" },
];
const RAK = [
  { id: 1, kode: "R-01", lokasi: "Lantai 1" },
  { id: 2, kode: "R-02", lokasi: null },
];
const JUDUL = {
  id: 7,
  isbn: "978-602-03-1234-5",
  judul: "Langit yang Sama",
  penulis: "Sari Dewi",
  penerbit: "Penerbit Nusa",
  tahun: 2020,
  kategori: { id: 3, nama: "Sejarah" },
  harga: 98000,
  cover_path: "cover/abc.png",
  cover_url: "/api/v1/katalog/judul/7/cover",
};
const TANPA_COVER = {
  ...JUDUL,
  id: 8,
  judul: "Tanpa Sampul",
  kategori: { id: 1, nama: "Fiksi" },
  harga: 45000,
  cover_path: null,
  cover_url: null,
};
const STOK = {
  judul_id: 7,
  // Total sengaja tidak sama dengan jumlah baris: rekap harus dari API, bukan dihitung ulang di klien.
  rekap: { total: 9, tersedia: 4, dipinjam: 2, hilang: 1, rusak: 2 },
  data: [
    { id: 11, kode: "EKS-000011", status: "TERSEDIA", rak: RAK[0] },
    { id: 12, kode: "EKS-000012", status: "DIPINJAM", rak: RAK[0] },
    { id: 13, kode: "EKS-000013", status: "HILANG", rak: RAK[1] },
    { id: 14, kode: "EKS-000014", status: "RUSAK", rak: RAK[1] },
  ],
};

function galat(status: number, kode: string, pesan: string, isian?: Record<string, string>) {
  return Response.json({ detail: { kode, pesan, rujukan: "FR-BKU-02", isian } }, { status });
}
const berkas = (ukuran: number, type = "image/png") => {
  const f = new File(["x"], "sampul.png", { type });
  Object.defineProperty(f, "size", { value: ukuran });
  return f;
};

describe("Daftar judul (FR-BKU-02)", () => {
  it("FR_BKU_02_daftar_berhalaman_dan_tautan_kelola", async () => {
    respons.set("/admin/judul?halaman=2", {
      data: [JUDUL, TANPA_COVER],
      total: 45,
      halaman: 2,
      per_halaman: 20,
    });
    const { container } = render(
      await DaftarJudul({ searchParams: Promise.resolve({ halaman: "2" }) }),
    );
    expect(dipanggil).toEqual(["/admin/judul?halaman=2"]);
    expect(screen.getByText("Langit yang Sama")).toBeTruthy();
    expect(screen.getByText("Rp98.000")).toBeTruthy();
    expect(screen.getByText("Sejarah")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Kelola Langit yang Sama/ }).getAttribute("href")).toBe(
      "/admin/judul/7",
    );
    expect(screen.getByRole("link", { name: "Tambah Judul" }).getAttribute("href")).toBe(
      "/admin/judul/baru",
    );
    expect(screen.getByRole("link", { name: "Berikutnya" }).getAttribute("href")).toBe(
      "/admin/judul?halaman=3",
    );
    // Tanpa kolom stok (OQ-45: stok hanya di detail judul, FR-BKU-09).
    const kepala = Array.from(container.querySelectorAll("th")).map((th) => th.textContent);
    expect(kepala.join(" ")).not.toMatch(/stok|tersedia|eksemplar/i);
    // Cover dari `cover_url` API; tanpa cover → pengganti, bukan gambar rusak.
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/api/v1/katalog/judul/7/cover",
    );
  });

  it("FR_BKU_02_daftar_kosong_state_kosong", async () => {
    respons.set("/admin/judul?halaman=1", { data: [], total: 0, halaman: 1, per_halaman: 20 });
    render(await DaftarJudul({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Belum ada judul")).toBeTruthy();
    expect(screen.queryByText("Judul tidak ditemukan")).toBeNull();
  });

  it("FR_BKU_02_daftar_dengan_penanda_dihapus_tampil_pesan_sukses", async () => {
    respons.set("/admin/judul?halaman=1", { data: [JUDUL], total: 1, halaman: 1, per_halaman: 20 });
    render(await DaftarJudul({ searchParams: Promise.resolve({ dihapus: "1" }) }));
    expect(screen.getByRole("status").textContent).toBe("Judul berhasil dihapus.");
    expect(dipanggil).toEqual(["/admin/judul?halaman=1"]); // penanda tidak dikirim ke API
  });

  it("FR_BKU_02_daftar_tanpa_penanda_tidak_tampil_pesan", async () => {
    respons.set("/admin/judul?halaman=1", { data: [JUDUL], total: 1, halaman: 1, per_halaman: 20 });
    render(await DaftarJudul({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByText("Judul berhasil dihapus.")).toBeNull();
  });

  it("FR_BKU_02_penanda_tak_sah_tidak_tampil_pesan", async () => {
    respons.set("/admin/judul?halaman=1", { data: [JUDUL], total: 1, halaman: 1, per_halaman: 20 });
    for (const dihapus of ["0", "true", ["1", "1"]]) {
      render(await DaftarJudul({ searchParams: Promise.resolve({ dihapus }) }));
      expect(screen.queryByText("Judul berhasil dihapus.")).toBeNull();
      cleanup();
    }
  });

  it("FR_BKU_02_penanda_dihapus_tidak_terbawa_ke_paginasi_dan_pencarian", async () => {
    respons.set("/admin/judul?q=sejarah&halaman=1", {
      data: [JUDUL],
      total: 45,
      halaman: 1,
      per_halaman: 20,
    });
    const { container } = render(
      await DaftarJudul({ searchParams: Promise.resolve({ dihapus: "1", q: "sejarah" }) }),
    );
    expect(screen.getByText("Judul berhasil dihapus.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Berikutnya" }).getAttribute("href")).toBe(
      "/admin/judul?q=sejarah&halaman=2",
    );
    const form = screen.getByRole("form", { name: "Pencarian judul" });
    expect(form.querySelector('[name="dihapus"]')).toBeNull();
    expect(container.querySelector('a[href*="dihapus"]')).toBeNull();
  });

  it("OQ_45_q_dikirim_ke_api_di_encode_dan_kolom_cari_terisi", async () => {
    respons.set("/admin/judul?q=Bumi+%26+Laut&halaman=1", {
      data: [JUDUL],
      total: 1,
      halaman: 1,
      per_halaman: 20,
    });
    render(await DaftarJudul({ searchParams: Promise.resolve({ q: "  Bumi & Laut " }) }));
    expect(dipanggil).toEqual(["/admin/judul?q=Bumi+%26+Laut&halaman=1"]);
    const kolom = screen.getByLabelText(/Cari judul/) as HTMLInputElement;
    expect(kolom.name).toBe("q");
    expect(kolom.value).toBe("Bumi & Laut");
    expect(screen.getByText("Langit yang Sama")).toBeTruthy();
  });

  it("OQ_45_tanpa_q_path_api_sama_seperti_sebelumnya_dan_kolom_cari_kosong", async () => {
    respons.set("/admin/judul?halaman=2", {
      data: [JUDUL],
      total: 45,
      halaman: 2,
      per_halaman: 20,
    });
    render(await DaftarJudul({ searchParams: Promise.resolve({ halaman: "2", q: "   " }) }));
    expect(dipanggil).toEqual(["/admin/judul?halaman=2"]);
    expect((screen.getByLabelText(/Cari judul/) as HTMLInputElement).value).toBe("");
  });

  it("OQ_45_paginasi_mempertahankan_q", async () => {
    respons.set("/admin/judul?q=sejarah&halaman=2", {
      data: [JUDUL],
      total: 45,
      halaman: 2,
      per_halaman: 20,
    });
    render(await DaftarJudul({ searchParams: Promise.resolve({ q: "sejarah", halaman: "2" }) }));
    expect(screen.getByRole("link", { name: "Berikutnya" }).getAttribute("href")).toBe(
      "/admin/judul?q=sejarah&halaman=3",
    );
    expect(screen.getByRole("link", { name: "Sebelumnya" }).getAttribute("href")).toBe(
      "/admin/judul?q=sejarah&halaman=1",
    );
  });

  it("OQ_45_hasil_cari_kosong_judul_tidak_ditemukan_bukan_belum_ada_judul", async () => {
    respons.set("/admin/judul?q=zzz&halaman=1", {
      data: [],
      total: 0,
      halaman: 1,
      per_halaman: 20,
    });
    render(await DaftarJudul({ searchParams: Promise.resolve({ q: "zzz" }) }));
    expect(screen.getByText("Judul tidak ditemukan")).toBeTruthy();
    expect(screen.queryByText("Belum ada judul")).toBeNull();
  });

  it("OQ_45_form_cari_GET_tanpa_halaman (pencarian baru selalu ke halaman 1)", async () => {
    respons.set("/admin/judul?q=sejarah&halaman=3", {
      data: [JUDUL],
      total: 45,
      halaman: 3,
      per_halaman: 20,
    });
    render(await DaftarJudul({ searchParams: Promise.resolve({ q: "sejarah", halaman: "3" }) }));
    const form = screen.getByRole("form", { name: "Pencarian judul" }) as HTMLFormElement;
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/admin/judul");
    expect(form.querySelector('[name="halaman"]')).toBeNull();
    expect(within(form).getByRole("link", { name: "Reset" }).getAttribute("href")).toBe(
      "/admin/judul",
    );
  });
});

describe("Form judul — tambah (FR-BKU-02, DR-05, NFR-SEC-06)", () => {
  function isi(nilai: Partial<Record<string, string>> = {}) {
    const n = {
      isbn: "978-602-03-1234-5",
      judul: "Langit yang Sama",
      penulis: "Sari Dewi",
      penerbit: "Penerbit Nusa",
      tahun: "2020",
      harga: "98000",
      ...nilai,
    };
    fireEvent.change(screen.getByLabelText(/^ISBN/), { target: { value: n.isbn } });
    fireEvent.change(screen.getByLabelText(/^Judul/), { target: { value: n.judul } });
    fireEvent.change(screen.getByLabelText(/^Penulis/), { target: { value: n.penulis } });
    fireEvent.change(screen.getByLabelText(/^Penerbit/), { target: { value: n.penerbit } });
    fireEvent.change(screen.getByLabelText(/^Tahun/), { target: { value: n.tahun } });
    fireEvent.change(screen.getByLabelText(/^Kategori/), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(/^Harga/), { target: { value: n.harga } });
  }
  const simpan = () => fireEvent.click(screen.getByRole("button", { name: "Simpan Judul" }));
  const pilihCover = (container: HTMLElement, f: File) =>
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [f] },
    });

  it("halaman_baru_memuat_kategori_dari_api", async () => {
    respons.set("/admin/kategori", KATEGORI);
    render(await JudulBaru());
    expect(screen.getByRole("option", { name: "Sejarah" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Pilih kategori" })).toBeTruthy();
  });

  it("DR_05_harga_tahun_dikirim_integer: body JSON bertipe number lalu menuju detail judul", async () => {
    fetchPalsu.mockResolvedValue(Response.json(JUDUL, { status: 201 }));
    render(<FormJudul kategori={KATEGORI} />);
    isi();
    simpan();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/judul/7"));
    expect(fetchPalsu).toHaveBeenCalledTimes(1);
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("/api/v1/admin/judul");
    expect(init.method).toBe("POST");
    const mentah = init.body as string;
    expect(mentah).toContain('"harga":98000');
    expect(mentah).toContain('"tahun":2020');
    expect(mentah).toContain('"kategori_id":3');
    const body = JSON.parse(mentah);
    expect(typeof body.harga).toBe("number");
    expect(typeof body.tahun).toBe("number");
    expect(Object.keys(body).sort()).toEqual(
      ["harga", "isbn", "judul", "kategori_id", "penerbit", "penulis", "tahun"].sort(),
    );
  });

  it.each([["98.000"], ["98000,5"], ["9.8e4"], ["abc"]])(
    "DR_05_harga_%s_ditahan_di_klien_tanpa_kirim",
    (harga) => {
      render(<FormJudul kategori={KATEGORI} />);
      isi({ harga });
      simpan();
      expect(
        screen.getByText("Harga harus berupa bilangan bulat Rupiah tanpa titik atau koma."),
      ).toBeTruthy();
      expect(fetchPalsu).not.toHaveBeenCalled();
    },
  );

  it("DR_05_tahun_pecahan_ditahan_tanpa_kirim", () => {
    render(<FormJudul kategori={KATEGORI} />);
    isi({ tahun: "20.20" });
    simpan();
    expect(screen.getByText("Tahun harus berupa bilangan bulat.")).toBeTruthy();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("FR_BKU_03_keterangan_harga_berlaku_semua_eksemplar", () => {
    render(<FormJudul kategori={KATEGORI} />);
    expect(screen.getByText(/berlaku untuk semua eksemplar/i)).toBeTruthy();
  });

  it("NFR_SEC_06_cover_lebih_2_MB_ditahan_SEBELUM_POST_judul", () => {
    const { container } = render(<FormJudul kategori={KATEGORI} />);
    isi();
    pilihCover(container, berkas(2_097_153));
    simpan();
    expect(screen.getByText("Ukuran berkas melebihi batas 2 MB.")).toBeTruthy();
    expect(fetchPalsu).not.toHaveBeenCalled(); // judul belum dibuat
  });

  it("NFR_SEC_06_cover_bukan_JPG_PNG_ditahan_SEBELUM_POST_judul", () => {
    const { container } = render(<FormJudul kategori={KATEGORI} />);
    isi();
    pilihCover(container, berkas(100, "image/gif"));
    simpan();
    expect(screen.getByText("Cover harus berupa gambar JPG atau PNG.")).toBeTruthy();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("tombol_simpan_nonaktif_selama_proses_dan_tidak_mengirim_dua_kali", async () => {
    fetchPalsu.mockReturnValue(new Promise(() => {})); // tidak pernah selesai
    render(<FormJudul kategori={KATEGORI} />);
    isi();
    simpan();
    const tombol = await screen.findByRole("button", { name: "Menyimpan…" });
    expect((tombol as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(tombol);
    expect(fetchPalsu).toHaveBeenCalledTimes(1);
  });

  it("FR_BKU_02_judul_plus_cover_POST_judul_lalu_PUT_cover_multipart_lalu_detail", async () => {
    fetchPalsu
      .mockResolvedValueOnce(Response.json(JUDUL, { status: 201 }))
      .mockResolvedValueOnce(Response.json(JUDUL));
    const { container } = render(<FormJudul kategori={KATEGORI} />);
    isi();
    const f = berkas(500);
    pilihCover(container, f);
    simpan();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/judul/7"));
    expect(fetchPalsu).toHaveBeenCalledTimes(2);
    const [url, init] = fetchPalsu.mock.calls[1];
    expect(url).toBe("/api/v1/admin/judul/7/cover");
    expect(init.method).toBe("PUT");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("berkas")).toBeInstanceOf(File);
  });

  it("FR_BKU_02_cover_gagal_judul_tetap_tersimpan_pesan_dan_tautan_ke_ubah_tanpa_POST_ulang", async () => {
    const pesanCover = "Cover harus berupa gambar JPG atau PNG.";
    fetchPalsu
      .mockResolvedValueOnce(Response.json(JUDUL, { status: 201 }))
      .mockResolvedValueOnce(galat(422, "BKU_COVER_FORMAT", pesanCover));
    const { container } = render(<FormJudul kategori={KATEGORI} />);
    isi();
    pilihCover(container, berkas(500));
    simpan();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      `Judul tersimpan, tetapi cover gagal diunggah: ${pesanCover}`,
    );
    expect(screen.getByRole("link", { name: /halaman ubah/i }).getAttribute("href")).toBe(
      "/admin/judul/7/ubah",
    );
    expect(router.push).not.toHaveBeenCalled(); // pesan tetap terbaca; tanpa pembatalan otomatis
    expect(fetchPalsu).toHaveBeenCalledTimes(2); // judul tidak dibuat dua kali, tidak dihapus
    expect(fetchPalsu.mock.calls.some(([, i]) => i?.method === "DELETE")).toBe(false);
  });

  it("IR_UI_04_isbn_duplikat_pesan_dan_isian_backend_tanpa_PUT_cover", async () => {
    const pesan = "ISBN 978-602-03-1234-5 sudah dipakai oleh judul 'Lain'.";
    fetchPalsu.mockResolvedValue(
      galat(409, "BKU_ISBN_DUPLIKAT", pesan, { isbn: "ISBN sudah dipakai." }),
    );
    const { container } = render(<FormJudul kategori={KATEGORI} />);
    isi();
    pilihCover(container, berkas(500));
    simpan();
    expect((await screen.findByRole("alert")).textContent).toBe(pesan);
    expect(screen.getByText("ISBN sudah dipakai.")).toBeTruthy();
    expect(fetchPalsu).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("Form judul — ubah (FR-BKU-02, OQ-19)", () => {
  it("halaman_ubah_memuat_judul_dan_kategori", async () => {
    respons.set("/admin/judul/7", JUDUL);
    respons.set("/admin/kategori", KATEGORI);
    render(await UbahJudul({ params: Promise.resolve({ id: "7" }) }));
    expect((screen.getByLabelText(/^Judul/) as HTMLInputElement).value).toBe("Langit yang Sama");
    expect((screen.getByLabelText(/^Harga/) as HTMLInputElement).value).toBe("98000");
  });

  it("OQ_19_cover_hanya_diganti_tanpa_kontrol_hapus_cover", () => {
    const { container } = render(<FormJudul kategori={KATEGORI} awal={JUDUL} />);
    expect(container.textContent).toMatch(/hanya dapat diganti/i);
    expect(screen.queryByRole("button", { name: /hapus/i })).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/api/v1/katalog/judul/7/cover",
    );
  });

  it("FR_BKU_02_ubah_PUT_integer_ke_judul_lalu_detail", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ ...JUDUL, harga: 120000 }));
    render(<FormJudul kategori={KATEGORI} awal={JUDUL} />);
    fireEvent.change(screen.getByLabelText(/^Harga/), { target: { value: "120000" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Judul" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/judul/7"));
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("/api/v1/admin/judul/7");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body).harga).toBe(120000);
    expect(fetchPalsu).toHaveBeenCalledTimes(1); // tanpa cover baru → tanpa PUT cover
  });

  it("FR_BKU_02_ubah_cover_gagal_pesan_tetap_di_halaman", async () => {
    fetchPalsu
      .mockResolvedValueOnce(Response.json(JUDUL))
      .mockResolvedValueOnce(
        galat(422, "BKU_COVER_TERLALU_BESAR", "Ukuran berkas melebihi batas 2 MB."),
      );
    const { container } = render(<FormJudul kategori={KATEGORI} awal={JUDUL} />);
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [berkas(1000)] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Judul" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Judul tersimpan, tetapi cover gagal diunggah: Ukuran berkas melebihi batas 2 MB.",
    );
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("Detail judul (FR-BKU-09)", () => {
  it("FR_BKU_09_detail_memuat_data_rekap_dari_api_dan_eksemplar", async () => {
    respons.set("/admin/judul/7", JUDUL);
    respons.set("/admin/judul/7/eksemplar", STOK);
    respons.set("/admin/rak", RAK);
    render(await DetailJudul({ params: Promise.resolve({ id: "7" }) }));
    expect(screen.getByRole("heading", { level: 1, name: "Langit yang Sama" })).toBeTruthy();
    expect(screen.getByText("Rp98.000")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ubah" }).getAttribute("href")).toBe(
      "/admin/judul/7/ubah",
    );
    expect(screen.getByRole("button", { name: "Hapus Judul" })).toBeTruthy();
    const rekap = screen.getByLabelText("Rekap stok");
    expect(within(rekap).getByText("Total").nextElementSibling?.textContent).toBe("9");
    expect(within(rekap).getByText("Rusak").nextElementSibling?.textContent).toBe("2");
  });

  it("detail_id_tak_sah_atau_tak_ada_404", async () => {
    await expect(DetailJudul({ params: Promise.resolve({ id: "abc" }) })).rejects.toBeInstanceOf(
      TidakDitemukan,
    );
    respons.set(
      "/admin/judul/99",
      new GalatApi(404, "BKU_JUDUL_TIDAK_ADA", "Judul buku tidak ditemukan.", null, {}, false),
    );
    respons.set(
      "/admin/judul/99/eksemplar",
      new GalatApi(404, "BKU_JUDUL_TIDAK_ADA", "Judul buku tidak ditemukan.", null, {}, false),
    );
    respons.set("/admin/rak", RAK);
    await expect(DetailJudul({ params: Promise.resolve({ id: "99" }) })).rejects.toBeInstanceOf(
      TidakDitemukan,
    );
  });
});

describe("Hapus judul (FR-BKU-02, OQ-12)", () => {
  it("OQ_12_modal_menyebut_eksemplar_ikut_terhapus; Batal tidak mengirim", async () => {
    render(<HapusJudul id={7} judul="Langit yang Sama" />);
    fireEvent.click(screen.getByRole("button", { name: "Hapus Judul" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Langit yang Sama");
    expect(dialog.textContent).toMatch(/seluruh eksemplar/i);
    fireEvent.click(within(dialog).getByRole("button", { name: "Batal" }));
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("FR_BKU_02_pernah_dipinjam_ditolak_pesan_backend_apa_adanya", async () => {
    const pesan = "Judul 'Langit yang Sama' pernah dipinjam sehingga tidak dapat dihapus.";
    fetchPalsu.mockResolvedValue(galat(409, "BKU_JUDUL_PERNAH_DIPINJAM", pesan));
    render(<HapusJudul id={7} judul="Langit yang Sama" />);
    fireEvent.click(screen.getByRole("button", { name: "Hapus Judul" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Ya, Hapus" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(pesan);
    expect(fetchPalsu.mock.calls[0][0]).toBe("/api/v1/admin/judul/7");
    expect(fetchPalsu.mock.calls[0][1].method).toBe("DELETE");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("FR_BKU_02_hapus_berhasil_204_kembali_ke_daftar_dengan_penanda", async () => {
    fetchPalsu.mockResolvedValue(new Response(null, { status: 204 }));
    render(<HapusJudul id={7} judul="Langit yang Sama" />);
    fireEvent.click(screen.getByRole("button", { name: "Hapus Judul" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Ya, Hapus" }));
    // Keputusan Ayen 2026-10-07: cukup penanda; judul tidak ditaruh di URL.
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/judul?dihapus=1"));
    expect(String(router.push.mock.calls[0][0])).not.toMatch(/Langit/);
  });
});

describe("Eksemplar per judul (FR-BKU-04..09, K-02, OQ-20, OQ-21)", () => {
  const panel = () =>
    render(<PanelEksemplar judul={{ id: 7, judul: "Langit yang Sama" }} stok={STOK} rak={RAK} />);
  const tambah = (jumlah: string, rak: string) => {
    fireEvent.change(screen.getByLabelText(/^Jumlah eksemplar/), { target: { value: jumlah } });
    fireEvent.change(screen.getByLabelText(/^Rak$/), { target: { value: rak } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah Eksemplar" }));
  };

  it("FR_BKU_09_rekap_dari_api_tanpa_hitung_ulang_dan_label_status_persis", () => {
    panel();
    const rekap = screen.getByLabelText("Rekap stok");
    expect(within(rekap).getByText("Total").nextElementSibling?.textContent).toBe("9");
    for (const [label, n] of [
      ["Tersedia", "4"],
      ["Dipinjam", "2"],
      ["Hilang", "1"],
      ["Rusak", "2"],
    ]) {
      expect(within(rekap).getByText(label).nextElementSibling?.textContent).toBe(n);
    }
  });

  it("OQ_20_konfirmasi_jumlah_sebelum_kirim; Batal tidak mengirim", async () => {
    panel();
    tambah("5", "2");
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("5 eksemplar");
    expect(dialog.textContent).toContain("Langit yang Sama");
    expect(dialog.textContent).toContain("R-02");
    expect(dialog.textContent).toContain("tidak dapat dihapus");
    expect(fetchPalsu).not.toHaveBeenCalled(); // belum ada permintaan sebelum konfirmasi
    fireEvent.click(within(dialog).getByRole("button", { name: "Batal" }));
    expect(fetchPalsu).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("FR_BKU_04_konfirmasi_POST_sekali_integer_lalu_pesan_sukses_dan_tautan_label_baru", async () => {
    const baru = [21, 22, 23, 24, 25].map((id) => ({
      id,
      kode: `EKS-0000${id}`,
      status: "TERSEDIA",
      rak: RAK[1],
    }));
    fetchPalsu.mockResolvedValue(Response.json(baru, { status: 201 }));
    panel();
    tambah("5", "2");
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Ya, Tambahkan" }),
    );
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(fetchPalsu).toHaveBeenCalledTimes(1);
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("/api/v1/admin/judul/7/eksemplar");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ jumlah: 5, rak_id: 2 });
    expect((await screen.findByRole("status")).textContent).toContain(
      "5 eksemplar ditambahkan: EKS-000021 s.d. EKS-000025.",
    );
    expect(
      screen.getByRole("link", { name: /Cetak label eksemplar baru/ }).getAttribute("href"),
    ).toBe("/admin/eksemplar/label?id=21&id=22&id=23&id=24&id=25");
  });

  it("FR_BKU_04_jumlah_kosong_pecahan_dan_rak_kosong_ditahan_tanpa_modal", () => {
    panel();
    fireEvent.change(screen.getByLabelText(/^Jumlah eksemplar/), { target: { value: "" } }); // bawaan "1"
    fireEvent.click(screen.getByRole("button", { name: "Tambah Eksemplar" }));
    expect(screen.getByText("Jumlah eksemplar wajib diisi.")).toBeTruthy();
    expect(screen.getByText("Pilih rak.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Jumlah eksemplar/), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah Eksemplar" }));
    expect(screen.getByText("Jumlah eksemplar harus berupa bilangan bulat.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("FR_BKU_04_penolakan_backend_batas_jumlah_pesan_apa_adanya", async () => {
    const pesan = "Jumlah eksemplar per penambahan 1–100.";
    fetchPalsu.mockResolvedValue(galat(422, "BKU_JUMLAH_EKSEMPLAR", pesan));
    panel();
    tambah("500", "1");
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Ya, Tambahkan" }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(pesan);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("FR_BKU_07_08_K_02_tandai_rusak_hanya_untuk_TERSEDIA_tanpa_pulihkan_atau_hapus_eksemplar", () => {
    panel();
    expect(screen.getByRole("button", { name: "Tandai Rusak EKS-000011" })).toBeTruthy();
    for (const kode of ["EKS-000012", "EKS-000013", "EKS-000014"]) {
      expect(screen.queryByRole("button", { name: `Tandai Rusak ${kode}` })).toBeNull();
    }
    expect(screen.getByText("Diubah lewat sirkulasi")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /pulihkan|hapus|ubah status/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /pulihkan|hapus/i })).toBeNull();
  });

  it("FR_BKU_07_konfirmasi_tandai_rusak_Batal_tidak_mengirim", async () => {
    panel();
    fireEvent.click(screen.getByRole("button", { name: "Tandai Rusak EKS-000011" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("EKS-000011");
    expect(dialog.textContent).toMatch(/tanpa tagihan/i);
    expect(dialog.textContent).toMatch(/tidak dapat dipulihkan/i);
    fireEvent.click(within(dialog).getByRole("button", { name: "Batal" }));
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("FR_BKU_07_konfirmasi_POST_rusak_sekali_lalu_refresh", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ ...STOK.data[0], status: "RUSAK" }));
    panel();
    fireEvent.click(screen.getByRole("button", { name: "Tandai Rusak EKS-000011" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Ya, Tandai Rusak" }),
    );
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(fetchPalsu).toHaveBeenCalledTimes(1);
    expect(fetchPalsu.mock.calls[0][0]).toBe("/api/v1/admin/eksemplar/11/rusak");
    expect(fetchPalsu.mock.calls[0][1].method).toBe("POST");
  });

  it("FR_BKU_08_penolakan_backend_untuk_eksemplar_yang_berubah_pesan_apa_adanya", async () => {
    const pesan = "Eksemplar EKS-000011 sedang Dipinjam; status hanya berubah lewat sirkulasi.";
    fetchPalsu.mockResolvedValue(galat(409, "BKU_EKSEMPLAR_DIPINJAM", pesan));
    panel();
    fireEvent.click(screen.getByRole("button", { name: "Tandai Rusak EKS-000011" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Ya, Tandai Rusak" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(pesan);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("FR_BKU_05_OQ_21_ubah_rak_untuk_status_apa_pun_tombol_simpan_hanya_bila_berubah", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ ...STOK.data[1], rak: RAK[1] }));
    panel();
    expect(screen.queryByRole("button", { name: "Simpan rak EKS-000012" })).toBeNull();
    // EKS-000012 berstatus Dipinjam: rak tetap boleh diubah (lokasi bukan status, OQ-21).
    fireEvent.change(screen.getByLabelText("Rak EKS-000012"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan rak EKS-000012" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(fetchPalsu.mock.calls[0][0]).toBe("/api/v1/admin/eksemplar/12/rak");
    expect(fetchPalsu.mock.calls[0][1].method).toBe("PUT");
    expect(JSON.parse(fetchPalsu.mock.calls[0][1].body)).toEqual({ rak_id: 2 });
  });

  it("FR_BKU_06_pilih_eksemplar_lalu_tautan_cetak_label_berisi_id_terpilih", () => {
    panel();
    expect(screen.queryByRole("link", { name: /Cetak Label/ })).toBeNull();
    fireEvent.click(screen.getByLabelText("Pilih EKS-000011"));
    fireEvent.click(screen.getByLabelText("Pilih EKS-000013"));
    const tautan = screen.getByRole("link", { name: "Cetak Label (2)" });
    expect(tautan.getAttribute("href")).toBe("/admin/eksemplar/label?id=11&id=13");
    expect(tautan.getAttribute("target")).toBe("_blank");
  });

  it("FR_BKU_06_pilih_semua_dan_lepas", () => {
    panel();
    fireEvent.click(screen.getByLabelText("Pilih semua eksemplar"));
    expect(screen.getByRole("link", { name: "Cetak Label (4)" }).getAttribute("href")).toBe(
      "/admin/eksemplar/label?id=11&id=12&id=13&id=14",
    );
    fireEvent.click(screen.getByLabelText("Pilih semua eksemplar"));
    expect(screen.queryByRole("link", { name: /Cetak Label/ })).toBeNull();
  });
});

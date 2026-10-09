// @vitest-environment jsdom
import type { ReactElement } from "react";
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

const { default: DaftarAnggota } = await import("./anggota/page");
const { default: DetailAnggota } = await import("./anggota/[kode]/page");
const { default: UbahAnggota } = await import("./anggota/[kode]/ubah/page");
const { FormUbahAnggota } = await import("./anggota/[kode]/ubah/FormUbahAnggota");
const { default: HalamanKategori } = await import("./kategori/page");
const { default: HalamanRak } = await import("./rak/page");
const { DaftarMaster } = await import("./_komponen/DaftarMaster");
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

const AULIA = {
  kode: "AGT-000001",
  nama: "Aulia Rahma",
  alamat: "Jl. Melati 1",
  email: "aulia@contoh.example",
  telepon: "0812000111",
  nik: "3171000000000001",
  tanggal_daftar: "2026-09-30",
  ada_foto: false,
};
const BUDI = { ...AULIA, kode: "AGT-000002", nama: "Budi Santoso", nik: "3171000000000002" };

function galat(status: number, kode: string, pesan: string, isian?: Record<string, string>) {
  return Response.json({ detail: { kode, pesan, rujukan: "FR-BKU-01", isian } }, { status });
}

describe("Daftar anggota (FR-AKN-10, OQ-33)", () => {
  it("FR_AKN_10_daftar_cari_q_dan_paginasi_mempertahankan_q", async () => {
    respons.set("/admin/anggota?q=Aulia&halaman=2", {
      data: [AULIA, BUDI],
      total: 45,
      halaman: 2,
      per_halaman: 20,
    });
    render(await DaftarAnggota({ searchParams: Promise.resolve({ q: "Aulia", halaman: "2" }) }));
    expect(dipanggil).toEqual(["/admin/anggota?q=Aulia&halaman=2"]);
    expect(screen.getByText("AGT-000001")).toBeTruthy();
    expect(screen.getByText("Budi Santoso")).toBeTruthy();
    const berikut = screen.getByRole("link", { name: "Berikutnya" });
    expect(berikut.getAttribute("href")).toBe("/admin/anggota?q=Aulia&halaman=3");
    expect((screen.getByLabelText(/Cari anggota/) as HTMLInputElement).defaultValue).toBe("Aulia");
  });

  it("OQ_33_kolom_nik_tidak_ditampilkan_di_tabel", async () => {
    respons.set("/admin/anggota?halaman=1", {
      data: [AULIA],
      total: 1,
      halaman: 1,
      per_halaman: 20,
    });
    const { container } = render(await DaftarAnggota({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("columnheader", { name: /NIK/i })).toBeNull();
    expect(container.textContent).not.toContain(AULIA.nik);
  });

  it("FR_AKN_10_tanpa_tambah_hapus_nonaktif_export_dan_foto_inisial", async () => {
    respons.set("/admin/anggota?halaman=1", {
      data: [AULIA],
      total: 1,
      halaman: 1,
      per_halaman: 20,
    });
    const { container } = render(await DaftarAnggota({ searchParams: Promise.resolve({}) }));
    const teks = container.textContent ?? "";
    for (const dilarang of [/Tambah Anggota/i, /Hapus/i, /Nonaktif/i, /Export/i, /Diblokir/i]) {
      expect(teks).not.toMatch(dilarang);
    }
    expect(screen.queryByRole("button", { name: /hapus|tambah/i })).toBeNull();
    // OQ-42: belum ada endpoint foto. Foto dekoratif kepala halaman (decisions §B Kepala halaman area)
    // tidak dihitung.
    expect(
      [...container.querySelectorAll("img")].filter((img) => !img.closest("header")),
    ).toHaveLength(0);
    expect(screen.getByRole("img", { name: "Aulia Rahma" }).textContent).toBe("AR");
    expect(screen.getByRole("link", { name: /Ubah/ }).getAttribute("href")).toBe(
      "/admin/anggota/AGT-000001/ubah",
    );
    expect(screen.getByRole("link", { name: /Lihat/ }).getAttribute("href")).toBe(
      "/admin/anggota/AGT-000001",
    );
  });

  it("FR_AKN_10_hasil_kosong_state_kosong", async () => {
    respons.set("/admin/anggota?q=zzz&halaman=1", {
      data: [],
      total: 0,
      halaman: 1,
      per_halaman: 20,
    });
    render(await DaftarAnggota({ searchParams: Promise.resolve({ q: "zzz" }) }));
    expect(screen.getByText("Anggota tidak ditemukan")).toBeTruthy();
  });
});

describe("Detail anggota (FR-AKN-10, OQ-33)", () => {
  it("FR_AKN_10_detail_menampilkan_profil_nik_dan_tautan_tagihan_tanpa_kelayakan", async () => {
    respons.set("/admin/anggota/AGT-000001", AULIA);
    const { container } = render(
      await DetailAnggota({ params: Promise.resolve({ kode: "AGT-000001" }) }),
    );
    expect(dipanggil).toEqual(["/admin/anggota/AGT-000001"]); // tanpa endpoint kelayakan (FR-PJM-02, 5.4.6)
    expect(screen.getByText(AULIA.nik)).toBeTruthy(); // NIK hanya di detail & ubah
    expect(screen.getByText("30/09/2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Lihat tagihan/ }).getAttribute("href")).toBe(
      "/admin/tagihan?anggota=AGT-000001",
    );
    expect(screen.getByRole("link", { name: /Ubah/ }).getAttribute("href")).toBe(
      "/admin/anggota/AGT-000001/ubah",
    );
    expect(container.textContent).not.toMatch(/layak|pinjaman aktif|diblokir/i);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("OQ_42_detail_admin_ada_foto_true_img_dari_endpoint_admin", async () => {
    respons.set("/admin/anggota/AGT-000001", { ...AULIA, ada_foto: true });
    render(await DetailAnggota({ params: Promise.resolve({ kode: "AGT-000001" }) }));
    const img = screen.getByRole("img", { name: "Foto Aulia Rahma" });
    expect(img.getAttribute("src")).toBe("/api/v1/admin/anggota/AGT-000001/foto");
  });

  it("OQ_42_detail_admin_kode_foto_dari_respons_api_bukan_url", async () => {
    // Kode di URL boleh berbeda bentuk (huruf kecil); path foto memakai kode dari respons API.
    respons.set("/admin/anggota/agt-000001", { ...AULIA, ada_foto: true });
    render(await DetailAnggota({ params: Promise.resolve({ kode: "agt-000001" }) }));
    const img = screen.getByRole("img", { name: "Foto Aulia Rahma" });
    expect(img.getAttribute("src")).toBe("/api/v1/admin/anggota/AGT-000001/foto");
  });

  it("OQ_42_detail_admin_ada_foto_false_inisial_tanpa_img_foto", async () => {
    respons.set("/admin/anggota/AGT-000001", AULIA);
    const { container } = render(
      await DetailAnggota({ params: Promise.resolve({ kode: "AGT-000001" }) }),
    );
    expect(screen.getByRole("img", { name: "Aulia Rahma" }).textContent).toBe("AR");
    // Bukti tanpa request foto: peramban hanya memuat foto bila ada <img> berisi path foto.
    expect(container.querySelector('img[src*="/foto"]')).toBeNull();
  });

  it("detail_kode_tak_ada_404", async () => {
    respons.set(
      "/admin/anggota/AGT-999999",
      new GalatApi(404, "AKN_TIDAK_ADA", "Anggota tidak ditemukan.", null, {}, false),
    );
    await expect(
      DetailAnggota({ params: Promise.resolve({ kode: "AGT-999999" }) }),
    ).rejects.toBeInstanceOf(TidakDitemukan);
  });

  it("halaman_ubah_memuat_profil_lalu_form", async () => {
    respons.set("/admin/anggota/AGT-000001", AULIA);
    render(await UbahAnggota({ params: Promise.resolve({ kode: "AGT-000001" }) }));
    expect((screen.getByLabelText(/Nama Lengkap/) as HTMLInputElement).value).toBe("Aulia Rahma");
  });
});

describe("Form ubah anggota (FR-AKN-11, K-03, K-05, OQ-32)", () => {
  it("K_05_nik_kode_tampil_sebagai_teks_bukan_isian_dan_tanpa_unggah_foto", () => {
    const { container } = render(<FormUbahAnggota awal={AULIA} />);
    expect(screen.getByText(AULIA.nik)).toBeTruthy();
    expect(screen.getByText("AGT-000001")).toBeTruthy();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.querySelector('[name="nik"], [name="kode"], [name="foto"]')).toBeNull();
    const nama = [...container.querySelectorAll("input, textarea")].map((e) =>
      e.getAttribute("name"),
    );
    expect(nama.sort()).toEqual(["alamat", "email", "nama", "password_baru", "telepon"]);
  });

  it("K_03_simpan_tanpa_password_mengirim_PUT_tanpa_password_baru", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ ...AULIA, nama: "Aulia R." }));
    render(<FormUbahAnggota awal={AULIA} />);
    fireEvent.change(screen.getByLabelText(/Nama Lengkap/), { target: { value: "Aulia R." } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    await waitFor(() => expect(fetchPalsu).toHaveBeenCalledTimes(1));
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("/api/v1/admin/anggota/AGT-000001");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      nama: "Aulia R.",
      alamat: AULIA.alamat,
      email: AULIA.email,
      telepon: AULIA.telepon,
    });
    expect((await screen.findByRole("status")).textContent).toBe("Data anggota berhasil disimpan.");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("K_03_OQ_32_password_baru_dikirim_dan_pesan_sesi_diakhiri", async () => {
    fetchPalsu.mockResolvedValue(Response.json(AULIA));
    render(<FormUbahAnggota awal={AULIA} />);
    fireEvent.change(screen.getByLabelText(/Password baru/), { target: { value: "baru12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    await waitFor(() => expect(fetchPalsu).toHaveBeenCalled());
    expect(JSON.parse(fetchPalsu.mock.calls[0][1].body).password_baru).toBe("baru12345");
    const pesan = (await screen.findByRole("status")).textContent ?? "";
    expect(pesan).toContain("semua sesi anggota ini diakhiri");
    expect((screen.getByLabelText(/Password baru/) as HTMLInputElement).value).toBe(""); // dikosongkan
  });

  it("NFR_SEC_02_password_kurang_8_ditahan_tanpa_kirim", () => {
    render(<FormUbahAnggota awal={AULIA} />);
    fireEvent.change(screen.getByLabelText(/Password baru/), { target: { value: "pendek" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    expect(screen.getByText("Password baru minimal 8 karakter.")).toBeTruthy();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("FR_AKN_11_isian_wajib_kosong_ditahan", () => {
    render(<FormUbahAnggota awal={AULIA} />);
    fireEvent.change(screen.getByLabelText(/Nama Lengkap/), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    expect(screen.getByText("Nama wajib diisi.")).toBeTruthy();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("K_06_email_duplikat_pesan_backend_per_isian_apa_adanya", async () => {
    const pesan = "Email budi@contoh.example sudah terdaftar.";
    fetchPalsu.mockResolvedValue(
      galat(409, "AKN_EMAIL_DUPLIKAT", pesan, { email: "Email sudah dipakai." }),
    );
    render(<FormUbahAnggota awal={AULIA} />);
    fireEvent.click(screen.getByRole("button", { name: "Simpan Perubahan" }));
    expect((await screen.findByRole("alert")).textContent).toBe(pesan);
    expect(screen.getByText("Email sudah dipakai.")).toBeTruthy();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("Kategori & rak (FR-BKU-01)", () => {
  it("FR_BKU_01_halaman_kategori_memuat_daftar_dari_api", async () => {
    respons.set("/admin/kategori", [
      { id: 1, nama: "Fiksi" },
      { id: 2, nama: "Sejarah" },
    ]);
    render(await HalamanKategori());
    expect(screen.getByText("Fiksi")).toBeTruthy();
    expect(screen.getByText("Sejarah")).toBeTruthy();
  });

  it("FR_BKU_01_halaman_rak_menampilkan_kode_dan_lokasi", async () => {
    respons.set("/admin/rak", [
      { id: 1, kode: "R-01", lokasi: "Lantai 1" },
      { id: 2, kode: "R-02", lokasi: null },
    ]);
    render(await HalamanRak());
    expect(screen.getByText("R-01")).toBeTruthy();
    expect(screen.getByText("Lantai 1")).toBeTruthy();
    expect(screen.getByText("R-02")).toBeTruthy();
  });

  it("FR_BKU_01_kategori_kosong_state_kosong", () => {
    render(<DaftarMaster jenis="kategori" data={[]} />);
    expect(screen.getByText("Belum ada kategori")).toBeTruthy();
  });

  it("FR_BKU_01_tambah_kategori_POST_lalu_refresh", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ id: 3, nama: "Sains" }, { status: 201 }));
    render(<DaftarMaster jenis="kategori" data={[{ id: 1, nama: "Fiksi" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Tambah Kategori" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Nama/), { target: { value: " Sains " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(fetchPalsu).toHaveBeenCalledTimes(1));
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("/api/v1/admin/kategori");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ nama: "Sains" });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("FR_BKU_01_ubah_kategori_PUT_ke_id", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ id: 1, nama: "Fiksi Baru" }));
    render(<DaftarMaster jenis="kategori" data={[{ id: 1, nama: "Fiksi" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ubah Fiksi" }));
    const dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByLabelText(/Nama/) as HTMLInputElement).value).toBe("Fiksi");
    fireEvent.change(within(dialog).getByLabelText(/Nama/), { target: { value: "Fiksi Baru" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(fetchPalsu).toHaveBeenCalledTimes(1));
    expect(fetchPalsu.mock.calls[0][0]).toBe("/api/v1/admin/kategori/1");
    expect(fetchPalsu.mock.calls[0][1].method).toBe("PUT");
  });

  it("FR_BKU_01_nama_kosong_ditahan_tanpa_kirim", async () => {
    render(<DaftarMaster jenis="kategori" data={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Tambah Kategori" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(within(dialog).getByText("Nama wajib diisi.")).toBeTruthy();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("FR_BKU_01_kategori_duplikat_pesan_backend_di_modal", async () => {
    const pesan = "Kategori 'Fiksi' sudah ada.";
    fetchPalsu.mockResolvedValue(galat(409, "BKU_KATEGORI_DUPLIKAT", pesan, { nama: pesan }));
    render(<DaftarMaster jenis="kategori" data={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Tambah Kategori" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Nama/), { target: { value: "fiksi" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(pesan);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("FR_BKU_01_hapus_kategori_butuh_konfirmasi; Batal tidak mengirim", async () => {
    render(<DaftarMaster jenis="kategori" data={[{ id: 1, nama: "Fiksi" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Hapus Fiksi" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Fiksi/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Batal" }));
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("FR_BKU_01_hapus_kategori_dipakai_ditolak_pesan_backend_apa_adanya", async () => {
    const pesan = "Kategori 'Fiksi' masih dipakai oleh 12 judul.";
    fetchPalsu.mockResolvedValue(galat(409, "BKU_KATEGORI_DIPAKAI", pesan));
    render(<DaftarMaster jenis="kategori" data={[{ id: 1, nama: "Fiksi" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Hapus Fiksi" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Ya, Hapus" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(pesan);
    expect(fetchPalsu.mock.calls[0][0]).toBe("/api/v1/admin/kategori/1");
    expect(fetchPalsu.mock.calls[0][1].method).toBe("DELETE");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("FR_BKU_01_hapus_kategori_berhasil_204_refresh", async () => {
    fetchPalsu.mockResolvedValue(new Response(null, { status: 204 }));
    render(<DaftarMaster jenis="kategori" data={[{ id: 1, nama: "Fiksi" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Hapus Fiksi" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Ya, Hapus" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("OQ_08_tambah_rak_kode_dan_lokasi_opsional_POST", async () => {
    fetchPalsu.mockResolvedValue(
      Response.json({ id: 5, kode: "R-05", lokasi: null }, { status: 201 }),
    );
    render(<DaftarMaster jenis="rak" data={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Tambah Rak" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Kode/), { target: { value: "R-05" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(fetchPalsu).toHaveBeenCalledTimes(1));
    expect(fetchPalsu.mock.calls[0][0]).toBe("/api/v1/admin/rak");
    expect(JSON.parse(fetchPalsu.mock.calls[0][1].body)).toEqual({ kode: "R-05", lokasi: null });
  });

  it("OQ_08_rak_kode_kosong_ditahan", async () => {
    render(<DaftarMaster jenis="rak" data={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Tambah Rak" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(within(dialog).getByText("Kode wajib diisi.")).toBeTruthy();
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("FR_BKU_01_hapus_rak_dipakai_ditolak_pesan_backend_apa_adanya", async () => {
    const pesan = "Rak R-01 masih dipakai oleh 4 eksemplar.";
    fetchPalsu.mockResolvedValue(galat(409, "BKU_RAK_DIPAKAI", pesan));
    render(<DaftarMaster jenis="rak" data={[{ id: 1, kode: "R-01", lokasi: "Lantai 1" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Hapus R-01" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Ya, Hapus" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe(pesan);
    expect(fetchPalsu.mock.calls[0][0]).toBe("/api/v1/admin/rak/1");
  });

  it("FR_BKU_01_ubah_rak_PUT_dengan_lokasi_terisi", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ id: 1, kode: "R-01", lokasi: "Lantai 3" }));
    render(<DaftarMaster jenis="rak" data={[{ id: 1, kode: "R-01", lokasi: "Lantai 1" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ubah R-01" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Lokasi/), { target: { value: "Lantai 3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(fetchPalsu).toHaveBeenCalledTimes(1));
    expect(fetchPalsu.mock.calls[0][0]).toBe("/api/v1/admin/rak/1");
    expect(JSON.parse(fetchPalsu.mock.calls[0][1].body)).toEqual({
      kode: "R-01",
      lokasi: "Lantai 3",
    });
  });
});

/** Foto dekoratif di kepala halaman (decisions §B Kepala halaman area): `alt=""`, panel `aria-hidden` mulai `lg`. */
function fotoKepala(wadah: Element) {
  return [...wadah.querySelectorAll("header img")].map((img) => {
    expect(img.getAttribute("alt")).toBe("");
    expect(img.closest('[aria-hidden="true"]')?.classList.contains("hidden")).toBe(true);
    return img.getAttribute("src")!;
  });
}

describe("Kepala halaman area (decisions §B)", () => {
  it("IR_UI_03_daftar_anggota_kategori_rak_berfoto", async () => {
    respons.set("/admin/anggota?halaman=1", { data: [], total: 0, halaman: 1, per_halaman: 20 });
    respons.set("/admin/kategori", []);
    respons.set("/admin/rak", []);
    const halamanUji: [string, () => Promise<ReactElement>][] = [
      ["Data Anggota", () => DaftarAnggota({ searchParams: Promise.resolve({}) })],
      ["Kategori", () => HalamanKategori()],
      ["Rak", () => HalamanRak()],
    ];
    for (const [judul, buat] of halamanUji) {
      const { container, unmount } = render(await buat());
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(judul);
      expect(fotoKepala(container)).toEqual([expect.stringContaining("hero-beranda")]);
      unmount();
    }
  });

  it("halaman_turunan_ubah_anggota_tanpa_foto_detail_tidak_diubah", async () => {
    respons.set("/admin/anggota/AGT-000001", AULIA);
    const ubah = render(await UbahAnggota({ params: Promise.resolve({ kode: "AGT-000001" }) }));
    expect(screen.getByRole("heading", { level: 1, name: "Ubah Data Anggota" })).toBeTruthy();
    expect(ubah.container.querySelector("img")).toBeNull();
    ubah.unmount();
    const detail = render(await DetailAnggota({ params: Promise.resolve({ kode: "AGT-000001" }) }));
    expect(fotoKepala(detail.container)).toEqual([]);
  });
});

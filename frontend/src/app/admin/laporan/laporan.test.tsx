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

class Dialihkan extends Error {
  constructor(readonly tujuan: string) {
    super(tujuan);
  }
}
let pathAktif = "/admin/laporan/transaksi";
vi.mock("next/navigation", () => ({
  usePathname: () => pathAktif,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  redirect: (tujuan: string) => {
    throw new Dialihkan(tujuan);
  },
}));

const { default: LayoutLaporan } = await import("./layout");
const { default: LaporanAdmin } = await import("./page");
const { default: LaporanTransaksi } = await import("./transaksi/page");
const { default: LaporanTagihan } = await import("./tagihan/page");
const { GalatApi, PESAN_SISTEM } = await import("@/lib/galat");

beforeEach(() => {
  respons.clear();
  dipanggil.length = 0;
  pathAktif = "/admin/laporan/transaksi";
});
afterEach(() => cleanup());

const BARIS_TRX = [
  {
    anggota_kode: "AGT-000001",
    anggota_nama: "Aulia Rahma",
    judul: "Langit yang Sama",
    kode_eksemplar: "EKS-000012",
    tanggal_pinjam: "2026-09-01",
    jatuh_tempo: "2026-10-01",
    tanggal_kembali: null,
    status: "DIPINJAM",
    terlambat: true,
  },
  {
    anggota_kode: "AGT-000001",
    anggota_nama: "Aulia Rahma",
    judul: "Bumi Manusia",
    kode_eksemplar: "EKS-000013",
    tanggal_pinjam: "2026-10-02",
    jatuh_tempo: "2026-11-01",
    tanggal_kembali: null,
    status: "DIPINJAM",
    terlambat: false,
  },
  {
    anggota_kode: "AGT-000002",
    anggota_nama: "Budi Santoso",
    judul: "Laut Bercerita",
    kode_eksemplar: "EKS-000014",
    tanggal_pinjam: "2026-09-20",
    jatuh_tempo: "2026-10-20",
    tanggal_kembali: "2026-10-10",
    status: "DIKEMBALIKAN",
    terlambat: false,
  },
];
const HAL_TRX = { data: BARIS_TRX, total: 45, halaman: 1, per_halaman: 20 };

const BARIS_TGH = [
  {
    id: 1,
    tanggal_dibentuk: "2026-10-01",
    anggota_kode: "AGT-000001",
    anggota_nama: "Aulia Rahma",
    judul: "Langit yang Sama",
    kode_eksemplar: "EKS-000012",
    jenis: "DENDA",
    nominal: 35555,
    status: "BELUM_LUNAS",
    cara_penyelesaian: null,
    tanggal_penyelesaian: null,
    admin_pengonfirmasi: null,
  },
  {
    id: 2,
    tanggal_dibentuk: "2026-10-02",
    anggota_kode: "AGT-000002",
    anggota_nama: "Budi Santoso",
    judul: "Laut Bercerita",
    kode_eksemplar: "EKS-000014",
    jenis: "PENGGANTIAN",
    nominal: 98000,
    status: "LUNAS",
    cara_penyelesaian: "BUKU_PENGGANTI",
    tanggal_penyelesaian: "2026-10-03",
    admin_pengonfirmasi: "Raisya Annisa",
  },
];
// Total sengaja bukan jumlah baris halaman (35.555 + 98.000 = 133.555): harus dari API.
const HAL_TGH = { data: BARIS_TGH, total: 45, total_nominal: 1234500, halaman: 1, per_halaman: 20 };

const PDF_TRX = "/api/v1/admin/laporan/transaksi/ekspor";
const PDF_TGH = "/api/v1/admin/laporan/tagihan/ekspor";

describe("Kerangka laporan (FR-LAP-02/03)", () => {
  it("dua_tab_di_dalam_halaman_dengan_penanda_aktif", () => {
    pathAktif = "/admin/laporan/tagihan";
    render(
      <LayoutLaporan>
        <p>isi halaman</p>
      </LayoutLaporan>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Laporan" })).toBeTruthy();
    expect(screen.getByText("isi halaman")).toBeTruthy();
    const transaksi = screen.getByRole("link", { name: "Transaksi" });
    const tagihan = screen.getByRole("link", { name: "Denda & Penggantian" });
    expect(transaksi.getAttribute("href")).toBe("/admin/laporan/transaksi");
    expect(tagihan.getAttribute("href")).toBe("/admin/laporan/tagihan");
    expect(tagihan.getAttribute("aria-current")).toBe("page");
    expect(transaksi.getAttribute("aria-current")).toBeNull();
  });

  it("laporan_tanpa_jenis_mengarah_ke_transaksi", () => {
    expect(() => LaporanAdmin()).toThrowError(
      expect.objectContaining({ tujuan: "/admin/laporan/transaksi" }),
    );
  });
});

describe("Laporan transaksi (FR-LAP-02, OQ-07, OQ-37, OQ-38, NFR-USA-02)", () => {
  const params = {
    dari: "2026-09-01",
    sampai: "2026-10-31",
    status: "TERLAMBAT",
    halaman: "1",
  };
  const kunci =
    "/admin/laporan/transaksi?dari=2026-09-01&sampai=2026-10-31&status=TERLAMBAT&halaman=1";

  it("FR_LAP_02_memuat_laporan_dengan_filter_dari_url_dan_kolom_oq_07", async () => {
    respons.set(kunci, HAL_TRX);
    render(await LaporanTransaksi({ searchParams: Promise.resolve(params) }));
    expect(dipanggil).toEqual([kunci]);
    const kepala = within(screen.getByRole("table"))
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(kepala).toEqual([
      "Anggota",
      "Judul",
      "Kode eksemplar",
      "Tanggal pinjam",
      "Jatuh tempo",
      "Tanggal kembali",
      "Status",
    ]);
    expect(screen.getByText("Langit yang Sama")).toBeTruthy();
    expect(screen.getAllByText("AGT-000001")).toHaveLength(2);
    expect(screen.getByText("45 baris")).toBeTruthy();
  });

  it("FR_LAP_02_form_filter_terisi_dari_url_dan_menjelaskan_dasar_rentang_oq_07", async () => {
    respons.set(kunci, HAL_TRX);
    render(await LaporanTransaksi({ searchParams: Promise.resolve(params) }));
    expect((screen.getByLabelText("Dari") as HTMLInputElement).value).toBe("2026-09-01");
    expect((screen.getByLabelText("Sampai") as HTMLInputElement).value).toBe("2026-10-31");
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("TERLAMBAT");
    expect(screen.getByText(/^Rentang tanggal dihitung dari tanggal pinjam/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Reset" }).getAttribute("href")).toBe(
      "/admin/laporan/transaksi",
    );
  });

  it("NFR_USA_02_semua_tanggal_lewat_formatTanggal_DD_MM_YYYY_dan_kosong_strip", async () => {
    respons.set(kunci, HAL_TRX);
    const { container } = render(await LaporanTransaksi({ searchParams: Promise.resolve(params) }));
    const teks = container.textContent ?? "";
    for (const iso of [
      "2026-09-01",
      "2026-10-01",
      "2026-10-02",
      "2026-11-01",
      "2026-09-20",
      "2026-10-20",
      "2026-10-10",
    ]) {
      expect(teks).not.toContain(iso);
    }
    for (const dmy of [
      "01/09/2026",
      "01/10/2026",
      "02/10/2026",
      "01/11/2026",
      "20/09/2026",
      "20/10/2026",
      "10/10/2026",
    ]) {
      expect(teks).toContain(dmy);
    }
    const baris = screen.getAllByRole("row")[1]; // baris 1: belum kembali
    expect(within(baris).getAllByRole("cell")[5].textContent).toBe("—");
  });

  it("OQ_37_terlambat_dari_field_terlambat_bukan_dari_status", async () => {
    respons.set(kunci, HAL_TRX);
    render(await LaporanTransaksi({ searchParams: Promise.resolve(params) }));
    const baris = screen.getAllByRole("row");
    expect(within(baris[1]).getByText("Terlambat")).toBeTruthy(); // DIPINJAM + terlambat: true
    expect(within(baris[2]).getByText("Dipinjam")).toBeTruthy(); // DIPINJAM + terlambat: false
    expect(within(baris[2]).queryByText("Terlambat")).toBeNull();
    expect(within(baris[3]).getByText("Dikembalikan")).toBeTruthy();
  });

  it("FR_LAP_04_unduh_pdf_dan_excel_dengan_filter_aktif_label_persis", async () => {
    respons.set(kunci, HAL_TRX);
    const { container } = render(await LaporanTransaksi({ searchParams: Promise.resolve(params) }));
    const pdf = screen.getByRole("link", { name: "Unduh PDF (untuk cetak)" });
    const xlsx = screen.getByRole("link", { name: "Unduh Excel" });
    const f = "dari=2026-09-01&sampai=2026-10-31&status=TERLAMBAT";
    expect(pdf.getAttribute("href")).toBe(`${PDF_TRX}?${f}&format=pdf`);
    expect(xlsx.getAttribute("href")).toBe(`${PDF_TRX}?${f}&format=xlsx`);
    expect(container.textContent).not.toMatch(/Cetak \(PDF\)/);
    expect(pdf.getAttribute("href")).not.toContain("halaman");
  });

  it("FR_LAP_04_filter_tak_sah_dibuang_dan_tidak_ikut_ke_ekspor", async () => {
    respons.set("/admin/laporan/transaksi?halaman=1", HAL_TRX);
    render(
      await LaporanTransaksi({
        searchParams: Promise.resolve({ dari: "kemarin", status: "SELESAI" }),
      }),
    );
    expect(screen.getByRole("link", { name: "Unduh Excel" }).getAttribute("href")).toBe(
      `${PDF_TRX}?format=xlsx`,
    );
  });

  it("FR_LAP_02_paginasi_mempertahankan_filter", async () => {
    respons.set(kunci, HAL_TRX);
    render(await LaporanTransaksi({ searchParams: Promise.resolve(params) }));
    expect(screen.getByRole("link", { name: "Berikutnya" }).getAttribute("href")).toBe(
      "/admin/laporan/transaksi?dari=2026-09-01&sampai=2026-10-31&status=TERLAMBAT&halaman=2",
    );
  });

  it("FR_LAP_02_hasil_kosong_state_kosong_tetap_menawarkan_ekspor_dengan_filter", async () => {
    respons.set("/admin/laporan/transaksi?status=RUSAK&halaman=1", {
      data: [],
      total: 0,
      halaman: 1,
      per_halaman: 20,
    });
    render(await LaporanTransaksi({ searchParams: Promise.resolve({ status: "RUSAK" }) }));
    expect(screen.getByText("Tidak ada data")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("link", { name: "Unduh Excel" }).getAttribute("href")).toBe(
      `${PDF_TRX}?status=RUSAK&format=xlsx`,
    );
  });

  it("OQ_38_rentang_tidak_valid_pesan_backend_apa_adanya_tanpa_tabel_dan_tanpa_ekspor", async () => {
    const pesan = "Rentang tanggal tidak valid: 01/12/2026 lebih besar dari 01/01/2026.";
    respons.set(
      "/admin/laporan/transaksi?dari=2026-12-01&sampai=2026-01-01&halaman=1",
      new GalatApi(422, "LAP_RENTANG_TIDAK_VALID", pesan, "FR-LAP-02", {}, false),
    );
    render(
      await LaporanTransaksi({
        searchParams: Promise.resolve({ dari: "2026-12-01", sampai: "2026-01-01" }),
      }),
    );
    expect(screen.getByRole("alert").textContent).toBe(pesan);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("link", { name: /Unduh/ })).toBeNull();
    expect((screen.getByLabelText("Dari") as HTMLInputElement).value).toBe("2026-12-01"); // dapat dikoreksi
  });

  it("FR_LAP_04_galat_sistem_apa_pun_juga_menyembunyikan_tabel_dan_ekspor", async () => {
    respons.set(
      "/admin/laporan/transaksi?halaman=1",
      new GalatApi(500, "SISTEM", PESAN_SISTEM, null, {}, true),
    );
    render(await LaporanTransaksi({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert").textContent).toBe(PESAN_SISTEM);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("link", { name: /Unduh/ })).toBeNull();
  });

  it("galat_bukan_dari_api_tetap_dilempar_ke_batas_galat", async () => {
    respons.set("/admin/laporan/transaksi?halaman=1", new Error("bug tak terduga"));
    await expect(LaporanTransaksi({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "bug tak terduga",
    );
  });
});

describe("Laporan denda & penggantian (FR-LAP-03, OQ-11, OQ-39, OQ-41)", () => {
  const params = {
    dari: "2026-10-01",
    sampai: "2026-10-31",
    jenis: "DENDA",
    status: "BELUM_LUNAS",
    cara: "TUNAI",
  };
  const kunci =
    "/admin/laporan/tagihan?dari=2026-10-01&sampai=2026-10-31&jenis=DENDA&status=BELUM_LUNAS&cara=TUNAI&halaman=1";

  it("FR_LAP_03_kolom_oq_39_dan_nilai_per_baris", async () => {
    respons.set(kunci, HAL_TGH);
    render(await LaporanTagihan({ searchParams: Promise.resolve(params) }));
    const kepala = within(screen.getByRole("table"))
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(kepala).toEqual([
      "Tanggal dibentuk",
      "Anggota",
      "Buku",
      "Jenis",
      "Nominal",
      "Status",
      "Cara penyelesaian",
      "Tanggal penyelesaian",
      "Admin pengonfirmasi",
    ]);
    const baris = screen.getAllByRole("row");
    expect(within(baris[1]).getByText("Denda")).toBeTruthy();
    expect(within(baris[1]).getByText("Rp35.555")).toBeTruthy();
    expect(within(baris[1]).getByText("Belum Lunas")).toBeTruthy();
    expect(within(baris[2]).getByText("Penggantian")).toBeTruthy();
    expect(within(baris[2]).getByText("Buku Pengganti")).toBeTruthy();
    expect(within(baris[2]).getByText("Raisya Annisa")).toBeTruthy();
    expect(within(baris[2]).getByText("03/10/2026")).toBeTruthy();
  });

  it("FR_LAP_03_total_nominal_dari_api_bukan_jumlah_baris_halaman", async () => {
    respons.set(kunci, HAL_TGH);
    const { container } = render(await LaporanTagihan({ searchParams: Promise.resolve(params) }));
    expect(screen.getByText("Rp1.234.500")).toBeTruthy();
    expect(screen.getByText(/Total nominal/)).toBeTruthy();
    expect(container.textContent).not.toContain("Rp133.555"); // 35.555 + 98.000 dihitung klien
    expect(screen.getByText("45 baris")).toBeTruthy();
  });

  it("OQ_11_form_filter_lengkap_dan_dasar_rentang_tanggal_dibentuk", async () => {
    respons.set(kunci, HAL_TGH);
    render(await LaporanTagihan({ searchParams: Promise.resolve(params) }));
    expect((screen.getByLabelText("Dari") as HTMLInputElement).value).toBe("2026-10-01");
    expect((screen.getByLabelText("Jenis") as HTMLSelectElement).value).toBe("DENDA");
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("BELUM_LUNAS");
    expect((screen.getByLabelText("Metode penyelesaian") as HTMLSelectElement).value).toBe("TUNAI");
    expect(screen.getByText(/^Rentang tanggal dihitung dari tanggal dibentuk/)).toBeTruthy();
    expect(screen.queryByLabelText(/anggota/i)).toBeNull(); // FR-LAP-03 tidak memuat filter anggota
  });

  it("FR_LAP_04_unduh_pdf_dan_excel_tagihan_dengan_filter_aktif", async () => {
    respons.set(kunci, HAL_TGH);
    render(await LaporanTagihan({ searchParams: Promise.resolve(params) }));
    const f = "dari=2026-10-01&sampai=2026-10-31&jenis=DENDA&status=BELUM_LUNAS&cara=TUNAI";
    expect(screen.getByRole("link", { name: "Unduh PDF (untuk cetak)" }).getAttribute("href")).toBe(
      `${PDF_TGH}?${f}&format=pdf`,
    );
    expect(screen.getByRole("link", { name: "Unduh Excel" }).getAttribute("href")).toBe(
      `${PDF_TGH}?${f}&format=xlsx`,
    );
  });

  it("FR_LAP_03_paginasi_mempertahankan_semua_filter", async () => {
    respons.set(kunci, HAL_TGH);
    render(await LaporanTagihan({ searchParams: Promise.resolve(params) }));
    expect(screen.getByRole("link", { name: "Berikutnya" }).getAttribute("href")).toBe(
      "/admin/laporan/tagihan?dari=2026-10-01&sampai=2026-10-31&jenis=DENDA&status=BELUM_LUNAS&cara=TUNAI&halaman=2",
    );
  });

  it("OQ_38_galat_rentang_pesan_backend_tanpa_tabel_total_dan_ekspor", async () => {
    const pesan = "Rentang tanggal tidak valid: 01/12/2026 lebih besar dari 01/01/2026.";
    respons.set(
      "/admin/laporan/tagihan?dari=2026-12-01&sampai=2026-01-01&halaman=1",
      new GalatApi(422, "LAP_RENTANG_TIDAK_VALID", pesan, "FR-LAP-03", {}, false),
    );
    const { container } = render(
      await LaporanTagihan({
        searchParams: Promise.resolve({ dari: "2026-12-01", sampai: "2026-01-01" }),
      }),
    );
    expect(screen.getByRole("alert").textContent).toBe(pesan);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("link", { name: /Unduh/ })).toBeNull();
    expect(container.textContent).not.toMatch(/Total nominal/);
  });

  it("FR_LAP_03_tanpa_baris_tetap_menampilkan_total_dari_api (Rp0)", async () => {
    respons.set("/admin/laporan/tagihan?halaman=1", {
      data: [],
      total: 0,
      total_nominal: 0,
      halaman: 1,
      per_halaman: 20,
    });
    render(await LaporanTagihan({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Tidak ada data")).toBeTruthy();
    expect(screen.getByText("Rp0")).toBeTruthy();
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
  it("IR_UI_03_kepala_laporan_di_layout_berfoto", () => {
    pathAktif = "/admin/laporan/transaksi";
    const { container } = render(
      <LayoutLaporan>
        <p>isi halaman</p>
      </LayoutLaporan>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Laporan" })).toBeTruthy();
    expect(fotoKepala(container)).toEqual([expect.stringContaining("hero-beranda")]);
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GalatApi } from "@/lib/galat";

const respons = new Map<string, unknown>();
const dipanggil: string[] = [];
async function palsu(path: string) {
  dipanggil.push(path);
  if (!respons.has(path)) throw new Error(`respons palsu belum diatur: ${path}`);
  const r = respons.get(path);
  if (r instanceof Error) throw r;
  return r;
}
vi.mock("@/lib/api-server", () => ({
  ambilServer: palsu,
  ambilSesiServer: () => palsu("/auth/saya"),
}));

const { default: DashboardAdmin } = await import("./page");

const P_DASHBOARD = "/admin/dashboard";
const P_SAYA = "/auth/saya";
const P_TERLAMBAT = "/admin/laporan/transaksi?status=TERLAMBAT&halaman=1&per_halaman=5";
const P_TAGIHAN = "/admin/tagihan?status=BELUM_LUNAS&halaman=1&per_halaman=5";

// Angka sengaja berbeda-beda agar tiap tampilan dapat ditelusuri ke satu field API.
const DASHBOARD = {
  jumlah_judul: 2000,
  eksemplar_per_status: { TERSEDIA: 4120, DIPINJAM: 312, HILANG: 7, RUSAK: 15 },
  jumlah_anggota: 980,
  item_dipinjam: 305,
  item_terlambat: 18,
  tagihan_belum_lunas_jumlah: 12,
  tagihan_belum_lunas_total: 456000,
};

const BARIS_TERLAMBAT = {
  anggota_kode: "AGT-000007",
  anggota_nama: "Rina Novita",
  judul: "Laut Bercerita",
  kode_eksemplar: "EKS-000031",
  tanggal_pinjam: "2026-08-01",
  jatuh_tempo: "2026-08-31",
  tanggal_kembali: null,
  status: "DIPINJAM",
  terlambat: true,
};

const TAGIHAN = {
  id: 41,
  jenis: "DENDA",
  nominal: 150000,
  status: "BELUM_LUNAS",
  tanggal_dibentuk: "2026-10-05",
  anggota: { kode: "AGT-000009", nama: "Ahmad Fauzi" },
  eksemplar: { kode: "EKS-000044", judul: "Bumi Manusia" },
  cara_penyelesaian: null,
  nominal_dibayar: null,
  tanggal_penyelesaian: null,
  admin_pengonfirmasi: null,
};

const halaman = <T,>(data: T[]) => ({ data, total: data.length, halaman: 1, per_halaman: 5 });

function aturNormal() {
  respons.set(P_SAYA, { role: "ADMIN", nama: "Raisya Annisa", email: "raisya@perpus.example" });
  respons.set(P_DASHBOARD, DASHBOARD);
  respons.set(P_TERLAMBAT, halaman([BARIS_TERLAMBAT]));
  respons.set(P_TAGIHAN, halaman([TAGIHAN]));
}

beforeEach(() => {
  respons.clear();
  dipanggil.length = 0;
  aturNormal();
});
afterEach(() => cleanup());

/** Kartu ringkas = elemen terdekat (tautan atau kotak) yang memuat label kartu. */
function kartu(label: string): HTMLElement {
  const el = screen
    .getAllByText(label, { exact: true })
    .map((t) => t.closest<HTMLElement>("a, div.rounded-xl"))
    .find((k) => k !== null && k.querySelector("[aria-hidden='true'] svg, svg") !== null);
  if (!el) throw new Error(`kartu "${label}" tidak ditemukan`);
  return el;
}
const panel = (judul: string) =>
  screen.getByRole("heading", { level: 2, name: judul }).closest("section") as HTMLElement;
const legenda = () => screen.getByRole("list", { name: "Rincian status eksemplar" });

describe("Dashboard admin (FR-LAP-01, OQ-40, IR-UI-02, hal-31)", () => {
  it("FR_LAP_01_semua_angka_dari_api_dan_dua_daftar_dari_endpoint_yang_ada", async () => {
    render(await DashboardAdmin());
    expect([...dipanggil].sort()).toEqual([P_SAYA, P_DASHBOARD, P_TAGIHAN, P_TERLAMBAT].sort());
    expect(kartu("Judul Buku").textContent).toContain("2.000");
    expect(kartu("Anggota").textContent).toContain("980");
    expect(kartu("Dipinjam").textContent).toContain("305");
    expect(kartu("Terlambat").textContent).toContain("18");
  });

  it("FR_LAP_01_tagihan_belum_lunas_tampil_jumlah_dan_total", async () => {
    render(await DashboardAdmin());
    const k = kartu("Tagihan Belum Lunas");
    expect(k.textContent).toContain("12");
    expect(k.textContent).toContain("tagihan");
    expect(k.textContent).toContain("Total Rp456.000");
  });

  it("FR_LAP_01_total_eksemplar_sama_dengan_jumlah_empat_status", async () => {
    render(await DashboardAdmin());
    // 4120 + 312 + 7 + 15 = 4454 (hanya tampilan, keputusan Ayen 10/10/2026).
    expect(kartu("Eksemplar").textContent).toContain("4.454");
  });

  it("FR_LAP_01_total_eksemplar_strip_bila_satu_status_tidak_dikirim", async () => {
    respons.set(P_DASHBOARD, {
      ...DASHBOARD,
      eksemplar_per_status: { TERSEDIA: 4120, DIPINJAM: 312, RUSAK: 15 }, // HILANG tidak dikirim (OQ-40)
    });
    const { container } = render(await DashboardAdmin());
    expect(kartu("Eksemplar").textContent).toContain("—");
    expect(container.textContent).not.toContain("4.447");
    const hilang = within(legenda()).getByText("Hilang").closest("li")!;
    expect(hilang.textContent).toContain("—");
    expect(hilang.textContent).not.toMatch(/\d+%/);
  });

  it("FR_KTL_03_label_eksemplar_menyebut_semua_status_termasuk_hilang_rusak", async () => {
    render(await DashboardAdmin());
    expect(kartu("Eksemplar").textContent).toMatch(/semua status, termasuk hilang dan rusak/i);
  });

  it("FR_LAP_01_legenda_donut_memuat_label_jumlah_dan_persen", async () => {
    render(await DashboardAdmin());
    const baris = within(legenda()).getAllByRole("listitem");
    expect(baris.map((b) => b.textContent)).toEqual([
      "Tersedia4.12093%",
      "Dipinjam3127%",
      "Hilang70%",
      "Rusak150%",
    ]);
  });

  it("FR_LAP_01_eksemplar_nol_tetap_tampil_di_legenda", async () => {
    respons.set(P_DASHBOARD, {
      ...DASHBOARD,
      eksemplar_per_status: { TERSEDIA: 90, DIPINJAM: 10, HILANG: 0, RUSAK: 0 },
    });
    render(await DashboardAdmin());
    const hilang = within(legenda()).getByText("Hilang").closest("li")!;
    expect(hilang.textContent).toBe("Hilang00%");
  });

  it("FR_LAP_01_donut_dekoratif_aria_hidden_total_di_tengah", async () => {
    const { container } = render(await DashboardAdmin());
    const donut = container.querySelector("[data-donut]")!;
    expect(donut.getAttribute("aria-hidden")).toBe("true");
    expect(donut.textContent).toContain("4.454");
    expect(container.querySelectorAll("[data-donut] circle")).toHaveLength(5); // jalur + 4 segmen
  });

  it("FR_LAP_01_tanpa_indikator_tren_dan_tanpa_panel_tanpa_api", async () => {
    const { container } = render(await DashboardAdmin());
    const teks = container.textContent ?? "";
    expect(teks).not.toMatch(/bulan lalu|tren|aktivitas terbaru|ringkasan hari ini/i);
    for (const label of ["Judul Buku", "Eksemplar", "Anggota", "Dipinjam", "Terlambat"]) {
      expect(kartu(label).textContent).not.toMatch(/[+-]\d|%/);
    }
  });

  it("OQ_40_dipinjam_termasuk_terlambat_tanpa_tautan", async () => {
    const { container } = render(await DashboardAdmin());
    const k = kartu("Dipinjam");
    expect(k.textContent).toMatch(/termasuk yang terlambat/i);
    expect(k.tagName).not.toBe("A");
    expect(k.closest("a")).toBeNull(); // filter DIPINJAM ≠ angka ini (OQ-37)
    expect(container.textContent).not.toMatch(/transaksi aktif/i);
  });

  it("FR_LAP_01_tautan_kartu_sama_dengan_sebelumnya", async () => {
    render(await DashboardAdmin());
    expect(kartu("Judul Buku").getAttribute("href")).toBe("/admin/judul");
    expect(kartu("Anggota").getAttribute("href")).toBe("/admin/anggota");
    expect(kartu("Terlambat").getAttribute("href")).toBe(
      "/admin/laporan/transaksi?status=TERLAMBAT",
    );
    expect(kartu("Tagihan Belum Lunas").getAttribute("href")).toBe(
      "/admin/tagihan?status=BELUM_LUNAS",
    );
    expect(kartu("Eksemplar").closest("a")).toBeNull();
  });
});

describe("Panel Item Terlambat & Tagihan Belum Lunas (hal-31, keputusan Ayen 10/10/2026)", () => {
  it("OQ_37_item_terlambat_tampil_anggota_judul_kode_jatuh_tempo_tanpa_n_hari", async () => {
    render(await DashboardAdmin());
    const p = panel("Item Terlambat");
    const teks = p.textContent ?? "";
    for (const isi of ["Rina Novita", "AGT-000007", "Laut Bercerita", "EKS-000031", "31/08/2026"]) {
      expect(teks).toContain(isi);
    }
    expect(within(p).getByText("Terlambat")).toBeTruthy(); // badge dari field `terlambat`
    expect(teks).not.toMatch(/\d+\s*hari/i); // K-07: tidak dihitung di klien
    expect(
      within(p)
        .getByRole("link", { name: /Lihat Semua/ })
        .getAttribute("href"),
    ).toBe("/admin/laporan/transaksi?status=TERLAMBAT");
  });

  it("FR_LAP_01_baris_terlambat_tanpa_nominal_dan_baris_tagihan_tanpa_keterlambatan", async () => {
    render(await DashboardAdmin());
    expect(panel("Item Terlambat").textContent).not.toMatch(/Rp/);
    const t = panel("Tagihan Belum Lunas").textContent ?? "";
    expect(t).not.toMatch(/terlambat|jatuh tempo|\d+\s*hari/i);
  });

  it("FR_TGH_01_tagihan_belum_lunas_tampil_anggota_jenis_nominal_dan_taut_detail", async () => {
    render(await DashboardAdmin());
    const p = panel("Tagihan Belum Lunas");
    const baris = within(p).getByRole("link", { name: /Ahmad Fauzi/ });
    expect(baris.getAttribute("href")).toBe("/admin/tagihan/41");
    expect(baris.textContent).toContain("AGT-000009");
    expect(baris.textContent).toContain("Denda");
    expect(baris.textContent).toContain("Rp150.000");
    expect(
      within(p)
        .getByRole("link", { name: /Lihat Semua/ })
        .getAttribute("href"),
    ).toBe("/admin/tagihan?status=BELUM_LUNAS");
  });

  it.each([
    [P_TERLAMBAT, "Item Terlambat", "Tagihan Belum Lunas"],
    [P_TAGIHAN, "Tagihan Belum Lunas", "Item Terlambat"],
  ])("IR_UI_04_galat_daftar_%s_hanya_di_panelnya_angka_tetap_tampil", async (path, gagal, lain) => {
    respons.set(
      path,
      new GalatApi(422, "VALIDASI_ISIAN", "Pesan galat dari backend.", null, {}, false),
    );
    render(await DashboardAdmin());
    expect(within(panel(gagal)).getByRole("alert").textContent).toBe("Pesan galat dari backend.");
    expect(within(panel(gagal)).queryByRole("link", { name: /Lihat Semua/ })).toBeNull();
    expect(within(panel(lain)).queryByRole("alert")).toBeNull();
    expect(kartu("Judul Buku").textContent).toContain("2.000");
  });

  it("galat_bukan_GalatApi_diteruskan_ke_error_tsx", async () => {
    respons.set(P_TAGIHAN, new Error("rusak"));
    await expect(DashboardAdmin()).rejects.toThrow("rusak");
  });

  it("daftar_kosong_tampil_teks_kosong_tanpa_lihat_semua", async () => {
    respons.set(P_TERLAMBAT, halaman([]));
    respons.set(P_TAGIHAN, halaman([]));
    render(await DashboardAdmin());
    expect(panel("Item Terlambat").textContent).toContain("Tidak ada item terlambat.");
    expect(panel("Tagihan Belum Lunas").textContent).toContain("Tidak ada tagihan Belum Lunas.");
    expect(screen.queryByRole("link", { name: /Lihat Semua/ })).toBeNull();
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
  it("IR_UI_03_kepala_sapaan_nama_dan_foto_tanpa_tagline", async () => {
    const { container } = render(await DashboardAdmin());
    const kepala = container.querySelector("header")!;
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
    expect(kepala.textContent).toContain("Selamat datang, Raisya Annisa.");
    expect(fotoKepala(container)).toEqual([expect.stringContaining("hero-beranda")]);
    const panelFoto = container.querySelector('header [aria-hidden="true"]')!;
    expect(panelFoto.textContent?.trim()).toBe(""); // tanpa tagline di atas foto
  });
});

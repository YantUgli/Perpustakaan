// @vitest-environment jsdom
import type { ReactElement } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const respons = new Map<string, unknown>();
const dipanggil: string[] = [];
vi.mock("@/lib/api-server", () => ({
  ambilServer: async (path: string) => {
    dipanggil.push(path);
    if (!respons.has(path)) throw new Error(`respons palsu belum diatur: ${path}`);
    return respons.get(path);
  },
  ambilSesiServer: async () => ({
    role: "ANGGOTA",
    nama: "Aulia Rahma",
    email: "a@contoh.example",
  }),
}));

const { default: Dashboard } = await import("./page");
const { default: HalamanQr } = await import("./qr/page");
const { default: HalamanPinjaman } = await import("./pinjaman/page");
const { default: HalamanRiwayat } = await import("./riwayat/page");
const { default: HalamanTagihan } = await import("./tagihan/page");
const { default: HalamanProfil } = await import("./profil/page");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  // Galat biasa bukan sinyal internal Next: tidak dilempar ulang.
  unstable_rethrow: () => {},
}));

const PINJAMAN = [
  {
    kode_eksemplar: "EKS-000001",
    judul: "Langit yang Sama",
    tanggal_pinjam: "2026-09-01",
    jatuh_tempo: "2026-10-01",
    sisa_hari: 0,
    terlambat: true,
    hari_terlambat: 4,
  },
  {
    kode_eksemplar: "EKS-000002",
    judul: "Jejak di Masa Lalu",
    tanggal_pinjam: "2026-09-10",
    jatuh_tempo: "2026-10-10",
    sisa_hari: 5,
    terlambat: false,
    hari_terlambat: 0,
  },
];

const halaman = (data: unknown[], total = data.length) => ({
  data,
  total,
  halaman: 1,
  per_halaman: 20,
});

/** Riwayat dashboard: satu permintaan halaman 1 `per_halaman=3`; `total`-nya mengisi kartu Riwayat Peminjaman. */
const RIWAYAT_DASHBOARD = "/anggota/riwayat?halaman=1&per_halaman=3";

/** Tagihan dashboard (D1): satu halaman `per_halaman=100` berisi status yang diberikan. */
function aturTagihan(status: string[]) {
  respons.set("/anggota/tagihan?halaman=1&per_halaman=100", {
    data: status.map((s, i) => ({
      id: i + 1,
      status: s,
      jenis: i % 2 === 0 ? "DENDA" : "PENGGANTIAN",
      nominal: 10000 * (i + 1),
      cara_penyelesaian: null,
      tanggal_dibentuk: `2026-10-0${i + 1}`,
      tanggal_penyelesaian: null,
      kode_eksemplar: `EKS-00010${i}`,
      judul: `Tagihan Buku ${i + 1}`,
    })),
    total: status.length,
    halaman: 1,
    per_halaman: 100,
  });
}

/** Kartu ringkas = satu tautan; nama aksesibelnya diawali label kartu. */
function kartu(label: string): HTMLElement {
  return screen.getByRole("link", { name: new RegExp(`^${label}`) });
}

beforeEach(() => {
  respons.clear();
  dipanggil.length = 0;
});
afterEach(cleanup);

describe("Dashboard anggota (FR-AGT-05)", () => {
  it("FR_AGT_05_layak", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 12));
    aturTagihan([]);
    render(await Dashboard());
    expect(screen.getByText("Anda dapat meminjam buku")).toBeTruthy();
    expect(kartu("Riwayat Peminjaman").textContent).toContain("12");
    expect(screen.getByText("Belum ada pinjaman aktif")).toBeTruthy();
  });

  it("FR_AGT_05_layak_tombol_lihat_katalog_ke_katalog", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 0));
    aturTagihan([]);
    render(await Dashboard());
    const banner = screen.getByRole("status");
    const tombol = within(banner).getByRole("link", { name: /Lihat Katalog Buku/ });
    expect(tombol.getAttribute("href")).toBe("/katalog");
  });

  it("D1_banner_tetap_layak_walau_daftar_tagihan_memuat_BELUM_LUNAS", async () => {
    // Angka kartu hanya tampilan; kelayakan selalu dari /anggota/kelayakan.
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 0));
    aturTagihan(["BELUM_LUNAS", "BELUM_LUNAS", "LUNAS"]);
    render(await Dashboard());
    expect(screen.getByText("Anda dapat meminjam buku")).toBeTruthy();
    expect(screen.queryByText("Anda belum dapat meminjam buku")).toBeNull();
    expect(kartu("Tagihan Aktif").textContent).toContain("2");
  });

  it("FR_AGT_04_kartu_tagihan_aktif_ke_halaman_tagihan", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 0));
    aturTagihan(["LUNAS"]);
    render(await Dashboard());
    const k = kartu("Tagihan Aktif");
    expect(k.getAttribute("href")).toBe("/anggota/tagihan");
    expect(k.textContent).toContain("0");
    expect(k.textContent).toContain("tagihan");
  });

  it("FR_AGT_02_kartu_pinjaman_aktif_dan_riwayat_bertaut", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", PINJAMAN);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 7));
    aturTagihan([]);
    render(await Dashboard());
    expect(kartu("Jumlah Pinjaman Aktif").getAttribute("href")).toBe("/anggota/pinjaman");
    expect(kartu("Jumlah Pinjaman Aktif").textContent).toContain("2");
    expect(kartu("Riwayat Peminjaman").getAttribute("href")).toBe("/anggota/riwayat");
  });

  it("FR_AGT_02_kartu_jatuh_tempo_terdekat_normal", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", [PINJAMAN[1]]);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 1));
    aturTagihan([]);
    render(await Dashboard());
    const k = kartu("Jatuh Tempo Terdekat");
    expect(k.getAttribute("href")).toBe("/anggota/pinjaman");
    expect(k.textContent).toContain("5");
    expect(k.textContent).toContain("hari lagi");
    expect(k.textContent).toContain("10/10/2026");
  });

  it("FR_AGT_02_kartu_jatuh_tempo_terdekat_terlambat_dari_field", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", PINJAMAN);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 2));
    aturTagihan([]);
    render(await Dashboard());
    const k = kartu("Jatuh Tempo Terdekat");
    expect(within(k).getByText("Terlambat 4 hari")).toBeTruthy();
    expect(k.textContent).toContain("01/10/2026");
  });

  it("kartu_ringkas_dashboard_tetap_bertaut_dan_berpanah", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", PINJAMAN);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 2));
    aturTagihan([]);
    render(await Dashboard());
    const tujuan: [string, string][] = [
      ["Jumlah Pinjaman Aktif", "/anggota/pinjaman"],
      ["Jatuh Tempo Terdekat", "/anggota/pinjaman"],
      ["Tagihan Aktif", "/anggota/tagihan"],
      ["Riwayat Peminjaman", "/anggota/riwayat"],
    ];
    for (const [label, href] of tujuan) {
      const k = kartu(label);
      expect(k.tagName).toBe("A");
      expect(k.getAttribute("href")).toBe(href);
      expect(k.querySelector('[data-ikon="panah"]')).not.toBeNull();
    }
  });

  it("FR_AGT_02_kartu_jatuh_tempo_terdekat_tanpa_pinjaman", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 0));
    aturTagihan([]);
    render(await Dashboard());
    const k = kartu("Jatuh Tempo Terdekat");
    expect(k.textContent).toContain("—");
    expect(k.textContent).toContain("Tidak ada pinjaman");
  });

  it("sapaan_dengan_nama_dan_subjudul", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 0));
    aturTagihan([]);
    render(await Dashboard());
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Selamat Datang, Aulia Rahma",
    );
    expect(
      screen.getByText(/Terima kasih telah menjadi bagian dari Perpustakaan Naratif/),
    ).toBeTruthy();
  });

  it("lihat_semua_pinjaman_ke_halaman_pinjaman", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", PINJAMAN);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 2));
    aturTagihan([]);
    render(await Dashboard());
    const panel = screen.getByRole("region", { name: "Pinjaman Terdekat Jatuh Tempo" });
    expect(
      within(panel)
        .getByRole("link", { name: /Lihat Semua/ })
        .getAttribute("href"),
    ).toBe("/anggota/pinjaman");
  });

  it("FR_AGT_05_terblokir_alasan_pesan_apa_adanya (judul 'Anda …' dari kode)", async () => {
    const pesanTagihan = "Anggota memiliki 2 tagihan Belum Lunas dengan total Rp35.555.";
    const pesanTerlambat =
      "Anggota memiliki buku terlambat yang belum dikembalikan: 'Langit yang Sama' terlambat 4 hari.";
    respons.set("/anggota/kelayakan", {
      layak: false,
      alasan: [
        { kode: "PJM_ADA_TAGIHAN", pesan: pesanTagihan, rujukan: "FR-PJM-03" },
        { kode: "PJM_ADA_TERLAMBAT", pesan: pesanTerlambat, rujukan: "FR-PJM-04" },
      ],
    });
    respons.set("/anggota/pinjaman", PINJAMAN);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 3));
    aturTagihan(["BELUM_LUNAS", "BELUM_LUNAS"]);
    render(await Dashboard());
    expect(screen.getByText("Anda belum dapat meminjam buku")).toBeTruthy();
    expect(screen.getByText("Anda memiliki tagihan yang belum lunas")).toBeTruthy();
    expect(screen.getByText(pesanTagihan)).toBeTruthy();
    expect(screen.getByText("Anda memiliki buku yang terlambat dikembalikan")).toBeTruthy();
    expect(screen.getByText(pesanTerlambat)).toBeTruthy();
    // Terblokir: tanpa tombol katalog di banner (asumsi spec #7).
    expect(screen.queryByRole("link", { name: /Lihat Katalog Buku/ })).toBeNull();
  });

  it("pinjaman terdekat: 3 pertama sesuai urutan API", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    const empat = ["A", "B", "C", "D"].map((h, i) => ({
      ...PINJAMAN[1],
      kode_eksemplar: `EKS-00000${i}`,
      judul: `Buku ${h}`,
    }));
    respons.set("/anggota/pinjaman", empat);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 0));
    aturTagihan([]);
    render(await Dashboard());
    expect(screen.getAllByText(/^Buku [A-D]$/).map((e) => e.textContent)).toEqual([
      "Buku A",
      "Buku B",
      "Buku C",
    ]);
  });

  it("FR_AGT_02_pinjaman_terdekat_maks_3_pil_sisa_hari_dua_nada", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    const hariIni = {
      ...PINJAMAN[1],
      kode_eksemplar: "EKS-000003",
      judul: "Hari Ini",
      sisa_hari: 0,
    };
    const keempat = { ...PINJAMAN[1], kode_eksemplar: "EKS-000004", judul: "Keempat" };
    respons.set("/anggota/pinjaman", [...PINJAMAN, hariIni, keempat]);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 0));
    aturTagihan([]);
    render(await Dashboard());
    const panel = screen.getByRole("region", { name: "Pinjaman Terdekat Jatuh Tempo" });
    expect(within(panel).getAllByRole("listitem")).toHaveLength(3);
    expect(within(panel).queryByText("Keempat")).toBeNull();
    expect(within(panel).getByText("EKS-000001")).toBeTruthy();
    expect(within(panel).getByText("01/10/2026")).toBeTruthy();
    // Keputusan 1: terlambat = nada Terlambat; selain itu (termasuk hari ini) = nada Dipinjam.
    const pil = (teks: string) => within(panel).getByText(teks);
    expect(pil("Terlambat 4 hari").getAttribute("data-nada")).toBe("terlambat");
    expect(pil("Terlambat 4 hari").className).toContain("text-status-terlambat");
    expect(pil("5 hari lagi").getAttribute("data-nada")).toBe("normal");
    expect(pil("5 hari lagi").className).toContain("text-status-dipinjam");
    expect(pil("Jatuh tempo hari ini").getAttribute("data-nada")).toBe("normal");
  });

  it("FR_AGT_04_panel_tagihan_aktif_maks_3_hanya_belum_lunas", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 0));
    aturTagihan(["BELUM_LUNAS", "LUNAS", "BELUM_LUNAS", "BELUM_LUNAS", "BELUM_LUNAS"]);
    render(await Dashboard());
    const panel = screen.getByRole("region", { name: "Tagihan Aktif" });
    const baris = within(panel).getAllByRole("listitem");
    // Urutan API dipertahankan; Lunas (indeks 1) dibuang; maks 3.
    expect(baris.map((b) => within(b).getByText(/^Tagihan Buku/).textContent)).toEqual([
      "Tagihan Buku 1",
      "Tagihan Buku 3",
      "Tagihan Buku 4",
    ]);
    expect(baris[0].textContent).toContain("Denda");
    expect(baris[0].textContent).toContain("01/10/2026");
    expect(baris[0].textContent).toContain("Rp10.000");
    expect(baris[2].textContent).toContain("Penggantian");
    expect(kartu("Tagihan Aktif").textContent).toContain("4");
    expect(
      within(panel)
        .getByRole("link", { name: /Lihat Semua/ })
        .getAttribute("href"),
    ).toBe("/anggota/tagihan");
    // Hanya informasi: tanpa tombol/tautan bayar.
    expect(within(panel).queryByRole("button")).toBeNull();
    expect(within(panel).queryByText(/bayar/i)).toBeNull();
    expect(within(panel).getAllByRole("link")).toHaveLength(1);
  });

  it("FR_AGT_04_panel_tagihan_kosong", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 0));
    aturTagihan(["LUNAS"]);
    render(await Dashboard());
    const panel = screen.getByRole("region", { name: "Tagihan Aktif" });
    expect(within(panel).getByText("Tidak ada tagihan")).toBeTruthy();
    expect(within(panel).getByText("Tidak ada tagihan yang belum lunas.")).toBeTruthy();
    expect(panel.textContent).not.toMatch(/kondisi baik/);
    // hal-09: ikon struk berlencana centang (bukan centang saja), dekoratif.
    const ikon = panel.querySelector('[data-ikon-kosong="struk-centang"]')!;
    expect(ikon.getAttribute("aria-hidden")).toBe("true");
    expect(
      Array.from(ikon.querySelectorAll("svg[data-ikon]")).map((e) => e.getAttribute("data-ikon")),
    ).toEqual(["struk", "centang"]);
  });

  it("FR_AGT_03_riwayat_terbaru_maks_3_satu_permintaan", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    const item = (i: number) => ({
      kode_eksemplar: `EKS-00020${i}`,
      judul: `Riwayat ${i}`,
      tanggal_pinjam: "2026-09-0" + i,
      jatuh_tempo: "2026-10-0" + i,
      tanggal_kembali: "2026-09-2" + i,
      status: "DIKEMBALIKAN",
      terlambat: false,
      tanggal_kejadian: null,
    });
    respons.set(RIWAYAT_DASHBOARD, halaman([item(3), item(2), item(1)], 9));
    aturTagihan([]);
    render(await Dashboard());
    expect(dipanggil.filter((p) => p.startsWith("/anggota/riwayat"))).toEqual([RIWAYAT_DASHBOARD]);
    const panel = screen.getByRole("region", { name: "Riwayat Terbaru" });
    expect(
      within(panel)
        .getAllByRole("listitem")
        .map((l) => l.textContent),
    ).toEqual([
      expect.stringContaining("Riwayat 3"),
      expect.stringContaining("Riwayat 2"),
      expect.stringContaining("Riwayat 1"),
    ]);
    expect(
      within(panel)
        .getByRole("link", { name: /Lihat Semua/ })
        .getAttribute("href"),
    ).toBe("/anggota/riwayat");
    // `total` respons yang sama mengisi kartu Riwayat Peminjaman.
    expect(kartu("Riwayat Peminjaman").textContent).toContain("9");
  });

  it("FR_AGT_03_riwayat_terbaru_label_terlambat_dan_tanggal_kembali_kejadian", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    const dasar = {
      jatuh_tempo: "2026-10-01",
      terlambat: false,
      tanggal_kembali: null,
      tanggal_kejadian: null,
    };
    respons.set(
      RIWAYAT_DASHBOARD,
      halaman([
        {
          ...dasar,
          kode_eksemplar: "EKS-1",
          judul: "Masih Dipinjam",
          tanggal_pinjam: "2026-09-01",
          status: "DIPINJAM",
          terlambat: true,
        },
        {
          ...dasar,
          kode_eksemplar: "EKS-2",
          judul: "Sudah Kembali",
          tanggal_pinjam: "2026-08-01",
          status: "DIKEMBALIKAN",
          tanggal_kembali: "2026-08-20",
        },
        {
          ...dasar,
          kode_eksemplar: "EKS-3",
          judul: "Hilang",
          tanggal_pinjam: "2026-07-01",
          status: "HILANG",
          tanggal_kejadian: "2026-07-15",
        },
      ]),
    );
    aturTagihan([]);
    render(await Dashboard());
    const panel = screen.getByRole("region", { name: "Riwayat Terbaru" });
    const [a, b, c] = within(panel).getAllByRole("listitem");
    // IR-UI-03: Terlambat dari field `terlambat`, bukan status tersimpan.
    expect(within(a).getByText("Terlambat")).toBeTruthy();
    expect(a.textContent).toContain("Dipinjam 01/09/2026");
    expect(a.textContent).not.toMatch(/Kembali|Kejadian/);
    expect(within(b).getByText("Dikembalikan")).toBeTruthy();
    expect(b.textContent).toContain("Dipinjam 01/08/2026");
    expect(b.textContent).toContain("Kembali 20/08/2026");
    expect(within(c).getAllByText("Hilang").length).toBeGreaterThan(0);
    expect(c.textContent).toContain("Kejadian 15/07/2026");
    // Hanya tanggal, tanpa jam.
    expect(panel.textContent).not.toMatch(/\d{1,2}[:.]\d{2}(?!\/)/);
  });

  it("FR_AGT_03_riwayat_terbaru_kosong", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 0));
    aturTagihan([]);
    render(await Dashboard());
    const panel = screen.getByRole("region", { name: "Riwayat Terbaru" });
    expect(within(panel).getByText("Belum ada riwayat peminjaman.")).toBeTruthy();
    expect(within(panel).queryByRole("listitem")).toBeNull();
  });
});

describe("QR anggota (FR-AGT-01)", () => {
  it("FR_AGT_01_qr_dari_isi_qr_besar_dengan_kode_dan_nama", async () => {
    respons.set("/anggota/qr", { kode: "AGT-000123", nama: "Aulia Rahma", isi_qr: "AGT-000123" });
    render(await HalamanQr());
    const qr = screen.getByRole("img", { name: "QR anggota AGT-000123" });
    expect(qr.tagName.toLowerCase()).toBe("svg");
    expect(qr.getAttribute("data-isi-qr")).toBe("AGT-000123");
    expect(Number(qr.getAttribute("width"))).toBeGreaterThanOrEqual(256);
    // Hitam di atas putih, bukan token tema.
    expect(qr.innerHTML).toContain('fill="#FFFFFF"');
    expect(qr.innerHTML).toContain('fill="#000000"');
    expect(qr.getAttribute("class")).toContain("max-w-full"); // tetap muat di 360 px
    expect(screen.getByText("AGT-000123")).toBeTruthy();
    expect(screen.getByText("Aulia Rahma")).toBeTruthy();
    expect(screen.queryByText(/NIK/)).toBeNull(); // P3: NIK tidak di halaman QR
  });

  const QR_AULIA = { kode: "AGT-000123", nama: "Aulia Rahma", isi_qr: "AGT-000123" };
  const kartuDigital = () => screen.getByRole("article", { name: "Kartu anggota digital" });

  it("FR_AGT_01_kartu_digital_qr_kode_nama", async () => {
    respons.set("/anggota/qr", QR_AULIA);
    respons.set("/anggota/profil", PROFIL_AULIA);
    render(await HalamanQr());
    const k = kartuDigital();
    expect(within(k).getByText("Kartu Anggota Digital")).toBeTruthy();
    expect(within(k).getByText("Perpustakaan Naratif")).toBeTruthy();
    expect(within(k).getByText("Aulia Rahma")).toBeTruthy();
    expect(within(k).getByText("ID Anggota")).toBeTruthy();
    expect(within(k).getByText("AGT-000123")).toBeTruthy();
    expect(within(k).getByText("Dipindai oleh petugas perpustakaan")).toBeTruthy();
    expect(within(k).getByRole("img", { name: "QR anggota AGT-000123" })).toBeTruthy();
    // Subjudul kepala tidak berubah.
    expect(
      screen.getByText("Tunjukkan QR ini kepada petugas perpustakaan saat meminjam buku."),
    ).toBeTruthy();
    expect(dipanggil).toEqual(expect.arrayContaining(["/anggota/qr", "/anggota/profil"]));
  });

  it("FR_AGT_01_qr_hitam_putih_min_256_di_area_putih", async () => {
    respons.set("/anggota/qr", QR_AULIA);
    respons.set("/anggota/profil", PROFIL_AULIA);
    render(await HalamanQr());
    const qr = screen.getByRole("img", { name: "QR anggota AGT-000123" });
    expect(Number(qr.getAttribute("width"))).toBeGreaterThanOrEqual(256);
    expect(qr.innerHTML).toContain('fill="#000000"');
    // QR di area putih (bukan di atas kepala navy).
    expect(qr.parentElement!.className).toContain("bg-white");
    expect(qr.closest(".bg-navy")).toBeNull();
  });

  it("tata_letak_dua_kolom_mulai_xl_qr_di_atas_identitas_di_bawah_xl", async () => {
    respons.set("/anggota/qr", QR_AULIA);
    respons.set("/anggota/profil", PROFIL_AULIA);
    render(await HalamanQr());
    const k = kartuDigital();
    expect(k.parentElement!.className).toContain("xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]");
    const kotakQr = screen.getByRole("img", { name: "QR anggota AGT-000123" }).parentElement!;
    // Urutan DOM: QR lebih dulu (di atas pada layar sempit); mulai xl pindah ke kanan.
    expect(kotakQr.parentElement!.firstElementChild).toBe(kotakQr);
    expect(kotakQr.className).toContain("xl:order-last");
    // 360 px: padding sempit di bawah sm agar QR 256 px muat tanpa gulir horizontal.
    expect(kotakQr.className).toMatch(/(^| )p-2( |$)/);
    expect(kotakQr.parentElement!.className).toMatch(/(^| )p-3( |$)/);
  });

  it("DR_02_bergabung_sejak_dari_tanggal_daftar", async () => {
    respons.set("/anggota/qr", QR_AULIA);
    respons.set("/anggota/profil", PROFIL_AULIA);
    render(await HalamanQr());
    const k = kartuDigital();
    expect(within(k).getByText("Bergabung Sejak")).toBeTruthy();
    expect(within(k).getByText("12/01/2026")).toBeTruthy();
  });

  it("OQ_42_foto_bila_ada_foto_inisial_bila_tidak", async () => {
    respons.set("/anggota/qr", QR_AULIA);
    respons.set("/anggota/profil", { ...PROFIL_AULIA, ada_foto: true });
    const { unmount } = render(await HalamanQr());
    expect(kartuDigital().querySelector("img")?.getAttribute("src")).toBe(
      "/api/v1/anggota/profil/foto",
    );
    unmount();

    respons.set("/anggota/profil", PROFIL_AULIA);
    render(await HalamanQr());
    expect(kartuDigital().querySelector("img")).toBeNull();
    const inisialAvatar = within(kartuDigital()).getByRole("img", { name: "Aulia Rahma" });
    expect(inisialAvatar.textContent).toBe("AR");
    // Revisi Ayen 09/10/2026: wadah foto besar (128/160/176 px), bukan ukuran "besar" 96 px.
    expect(inisialAvatar.className).toContain("size-32");
    expect(inisialAvatar.className).toContain("sm:size-40");
  });

  it("P3_tanpa_nik_di_halaman_qr", async () => {
    respons.set("/anggota/qr", QR_AULIA);
    respons.set("/anggota/profil", PROFIL_AULIA);
    const { container } = render(await HalamanQr());
    expect(screen.queryByText(/NIK/)).toBeNull();
    expect(container.textContent).not.toContain(PROFIL_AULIA.nik);
    expect(container.textContent).not.toContain(PROFIL_AULIA.nik.slice(-4));
  });

  it("tanpa_status_aktif_dan_jenis_anggota", async () => {
    respons.set("/anggota/qr", QR_AULIA);
    respons.set("/anggota/profil", PROFIL_AULIA);
    const { container } = render(await HalamanQr());
    expect(container.textContent).not.toMatch(/\bAktif\b/);
    expect(container.textContent).not.toMatch(/Jenis Anggota|Reguler/);
  });

  it("informasi_anggota_dan_tautan_edit_profil", async () => {
    respons.set("/anggota/qr", QR_AULIA);
    respons.set("/anggota/profil", PROFIL_AULIA);
    const { container } = render(await HalamanQr());
    const info = screen.getByRole("region", { name: "Informasi Anggota" });
    for (const teks of ["Aulia Rahma", "aulia@contoh.example", "0812", "Jl. Melati 12"]) {
      expect(within(info).getByText(teks)).toBeTruthy();
    }
    expect(within(info).getByRole("link", { name: "Edit Profil" }).getAttribute("href")).toBe(
      "/anggota/profil",
    );
    // Hanya tampilan: tanpa form di halaman QR.
    expect(container.querySelector("form, input, textarea")).toBeNull();
    expect(screen.getByRole("region", { name: "Cara Menggunakan QR Anggota" })).toBeTruthy();
  });

  it("OQ_42_profil_gagal_kartu_qr_tetap_tampil", async () => {
    const galatLog = vi.spyOn(console, "error").mockImplementation(() => {});
    respons.set("/anggota/qr", QR_AULIA);
    // /anggota/profil tidak diatur → server palsu melempar galat.
    render(await HalamanQr());
    const k = kartuDigital();
    expect(within(k).getByText("AGT-000123")).toBeTruthy();
    expect(within(k).getByRole("img", { name: "QR anggota AGT-000123" })).toBeTruthy();
    expect(within(k).getByRole("img", { name: "Aulia Rahma" }).textContent).toBe("AR");
    expect(screen.queryByText("Bergabung Sejak")).toBeNull();
    expect(screen.queryByRole("region", { name: "Informasi Anggota" })).toBeNull();
    expect(galatLog).toHaveBeenCalled();
    galatLog.mockRestore();
  });

  it("FR_AGT_01_qr_gagal_diteruskan_ke_batas_galat", async () => {
    respons.set("/anggota/profil", PROFIL_AULIA);
    await expect(HalamanQr()).rejects.toThrow(/anggota\/qr/);
  });
});

describe("Pinjaman Saya (FR-AGT-02, OQ-34)", () => {
  // Tabel (mulai xl) dan daftar kartu (di bawah xl) sama-sama ada di DOM; pencarian teks dibatasi ke salah satunya.
  const tabel = () => screen.getByRole("table", { name: "Daftar Buku Pinjaman Aktif" });
  const daftarKartu = () => screen.getByRole("list", { name: "Daftar Buku Pinjaman Aktif" });
  /** Kartu ringkas tanpa tautan, dicari di grid ringkasan (label "Terlambat" juga dipakai LabelStatus). */
  const ringkas = (label: string) => {
    const grid = screen.getByText("Total Pinjaman Aktif").closest("div.grid") as HTMLElement;
    return within(grid).getByText(label).closest("div")!;
  };

  it("FR_AGT_02_label_terlambat_dari_field", async () => {
    respons.set("/anggota/pinjaman", PINJAMAN);
    render(await HalamanPinjaman());
    const [terlambat, normal] = within(daftarKartu()).getAllByRole("listitem");
    expect(within(terlambat).getByText("Terlambat")).toBeTruthy();
    expect(within(terlambat).getByText("Terlambat 4 hari")).toBeTruthy();
    expect(within(normal).getByText("Dipinjam")).toBeTruthy();
    expect(within(normal).getByText("5 hari lagi")).toBeTruthy();
    expect(within(normal).getByText("10/10/2026")).toBeTruthy();
    // Tabel: status dari LabelStatus, Terlambat dari field `terlambat` (IR-UI-03).
    const [, barisTerlambat, barisNormal] = within(tabel()).getAllByRole("row");
    expect(within(barisTerlambat).getByText("Terlambat")).toBeTruthy();
    expect(within(barisTerlambat).getByText("Terlambat 4 hari")).toBeTruthy();
    expect(within(barisNormal).getByText("Dipinjam")).toBeTruthy();
    expect(within(barisNormal).getByText("5 hari lagi")).toBeTruthy();
    expect(screen.getByText("Perpanjangan pinjaman tidak tersedia")).toBeTruthy();
  });

  it("FR_AGT_02_ringkasan_total_jatuh_tempo_terdekat_terlambat", async () => {
    respons.set("/anggota/pinjaman", PINJAMAN);
    render(await HalamanPinjaman());
    expect(ringkas("Total Pinjaman Aktif").textContent).toContain("2buku");
    // Jatuh tempo terdekat = pinjaman[0] (urutan API), teks dari teksSisaHari.
    const jt = ringkas("Jatuh Tempo Terdekat");
    expect(jt.textContent).toContain("Terlambat 4 hari");
    expect(jt.textContent).toContain("01/10/2026");
    expect(ringkas("Terlambat").textContent).toContain("1buku");
    // Tanpa ambang "segera jatuh tempo ≤ 7 hari".
    expect(screen.queryByText(/Segera Jatuh Tempo|≤ ?7/)).toBeNull();
    // Angka lining (0 tidak mirip "O").
    const angka = within(ringkas("Total Pinjaman Aktif")).getByText("2");
    expect(angka.className).toContain("lining-nums");
    expect(angka.className).not.toMatch(/(^| )angka( |$)/);
  });

  it("kartu_ringkas_tanpa_href_bukan_tautan", async () => {
    respons.set("/anggota/pinjaman", PINJAMAN);
    render(await HalamanPinjaman());
    for (const label of ["Total Pinjaman Aktif", "Jatuh Tempo Terdekat", "Terlambat"]) {
      const k = ringkas(label);
      expect(k.closest("a")).toBeNull();
      expect(k.querySelector('[data-ikon="panah"]')).toBeNull();
    }
  });

  it("FR_AGT_02_tabel_kolom_dan_urutan_api", async () => {
    const tiga = [
      PINJAMAN[1],
      PINJAMAN[0],
      { ...PINJAMAN[1], kode_eksemplar: "EKS-000009", judul: "Ketiga" },
    ];
    respons.set("/anggota/pinjaman", tiga);
    render(await HalamanPinjaman());
    const t = tabel();
    const kepala = within(t).getAllByRole("columnheader");
    expect(kepala.map((h) => h.textContent)).toEqual([
      "Buku",
      "Tanggal Pinjam",
      "Jatuh Tempo",
      "Sisa Hari",
      "Status",
    ]);
    expect(kepala.every((h) => h.getAttribute("scope") === "col")).toBe(true);
    const baris = within(t).getAllByRole("row").slice(1);
    // Urutan API apa adanya, tanpa urut ulang.
    expect(baris.map((b) => within(b).getAllByRole("cell")[0].textContent)).toEqual([
      "Jejak di Masa LaluEKS-000002",
      "Langit yang SamaEKS-000001",
      "KetigaEKS-000009",
    ]);
    const sel = within(baris[0])
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(sel.slice(1)).toEqual(["10/09/2026", "10/10/2026", "5 hari lagi", "Dipinjam"]);
    // Tanpa cover/penulis/kategori.
    expect(t.querySelector("img")).toBeNull();
  });

  it("FR_AGT_02_pil_dua_nada", async () => {
    const hariIni = {
      ...PINJAMAN[1],
      kode_eksemplar: "EKS-000003",
      judul: "Hari Ini",
      sisa_hari: 0,
    };
    respons.set("/anggota/pinjaman", [...PINJAMAN, hariIni]);
    render(await HalamanPinjaman());
    const t = tabel();
    expect(within(t).getByText("Terlambat 4 hari").getAttribute("data-nada")).toBe("terlambat");
    expect(within(t).getByText("5 hari lagi").getAttribute("data-nada")).toBe("normal");
    expect(within(t).getByText("Jatuh tempo hari ini").getAttribute("data-nada")).toBe("normal");
  });

  it("FR_PJM_13_info_tanpa_perpanjangan", async () => {
    respons.set("/anggota/pinjaman", PINJAMAN);
    const { container } = render(await HalamanPinjaman());
    const judul = screen.getByText("Perpanjangan pinjaman tidak tersedia");
    const kotak = judul.closest("div.rounded-xl")!;
    expect(kotak.textContent).toContain(
      "Buku dikembalikan langsung kepada petugas perpustakaan sebelum jatuh tempo.",
    );
    // Kotak keterangan statis (bukan umpan balik) dan tanpa aksi perpanjangan.
    expect(kotak.getAttribute("role")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect(screen.queryByRole("link", { name: /perpanjang/i })).toBeNull();
  });

  it("kosong", async () => {
    respons.set("/anggota/pinjaman", []);
    render(await HalamanPinjaman());
    expect(screen.getByText("Belum ada pinjaman aktif")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Lihat Katalog Buku" }).getAttribute("href")).toBe(
      "/katalog",
    );
    expect(screen.queryByRole("table")).toBeNull();
    expect(ringkas("Jatuh Tempo Terdekat").textContent).toContain("—");
    expect(ringkas("Terlambat").textContent).toContain("0buku");
  });
});

describe("Riwayat (FR-AGT-03, OQ-35; hal-13 opsi b: semua halaman, hanya tampilan)", () => {
  type Riwayat = {
    kode_eksemplar: string;
    judul: string;
    tanggal_pinjam: string;
    jatuh_tempo: string;
    tanggal_kembali: string | null;
    status: string;
    terlambat: boolean;
    tanggal_kejadian: string | null;
  };
  const item = (n: number, ubah: Partial<Riwayat> = {}): Riwayat => ({
    kode_eksemplar: `EKS-${String(n).padStart(6, "0")}`,
    judul: `Buku ${n}`,
    tanggal_pinjam: "2026-07-01",
    jatuh_tempo: "2026-07-31",
    tanggal_kembali: "2026-07-15",
    status: "DIKEMBALIKAN",
    terlambat: false,
    tanggal_kejadian: null,
    ...ubah,
  });
  /** Server palsu: semua item dipecah per 100 seperti backend (`per_halaman=100`). */
  function aturRiwayat(semua: Riwayat[]) {
    const jumlah = Math.max(1, Math.ceil(semua.length / 100));
    for (let h = 1; h <= jumlah; h++) {
      respons.set(`/anggota/riwayat?halaman=${h}&per_halaman=100`, {
        data: semua.slice((h - 1) * 100, h * 100),
        total: semua.length,
        halaman: h,
        per_halaman: 100,
      });
    }
  }
  const buka = async (q: Record<string, string> = {}) =>
    render(await HalamanRiwayat({ searchParams: Promise.resolve(q) }));
  const tabel = () => screen.getByRole("table", { name: "Daftar Riwayat Peminjaman" });
  const daftarKartu = () => screen.getByRole("list", { name: "Daftar Riwayat Peminjaman" });
  const ringkas = (label: string) => {
    const grid = screen.getByText("Total Riwayat").closest("div.grid") as HTMLElement;
    return within(grid).getByText(label).closest("div")!;
  };
  const tab = (nama: string) =>
    within(screen.getByRole("navigation", { name: "Saring riwayat menurut status" })).getByRole(
      "link",
      { name: nama },
    );

  it("FR_AGT_03_hilang_rusak_tampil_tanggal_kejadian_tanpa_keterangan", async () => {
    // 25 item: halaman 2 (klien, 20/halaman) dimulai dari item ke-21.
    const semua = Array.from({ length: 25 }, (_, i) => item(i + 1));
    semua[20] = item(21, {
      judul: "Kota yang Tak Tidur",
      status: "HILANG",
      tanggal_kembali: null,
      tanggal_kejadian: "2026-08-20",
    });
    aturRiwayat(semua);
    await buka({ halaman: "2" });
    const [hilang, kembali] = within(daftarKartu()).getAllByRole("listitem");
    expect(within(hilang).getByText("Hilang")).toBeTruthy();
    expect(within(hilang).getByText("Tanggal kejadian")).toBeTruthy();
    expect(within(hilang).getByText("20/08/2026")).toBeTruthy();
    expect(within(hilang).queryByText(/keterangan/i)).toBeNull();
    expect(within(kembali).getByText("Dikembalikan")).toBeTruthy();
    expect(within(kembali).getByText("15/07/2026")).toBeTruthy();
    const barisHilang = within(tabel()).getAllByRole("row")[1];
    expect(within(barisHilang).getByText("Hilang")).toBeTruthy();
    expect(within(barisHilang).getByText("20/08/2026")).toBeTruthy();
    expect(screen.getByText("Halaman 2 dari 2")).toBeTruthy();
  });

  it("parameter halaman tidak sah → halaman 1", async () => {
    aturRiwayat([]);
    await buka({ halaman: "-3" });
    expect(dipanggil).toEqual(["/anggota/riwayat?halaman=1&per_halaman=100"]);
    expect(screen.getByText("Belum ada riwayat peminjaman")).toBeTruthy();
  });

  it("FR_AGT_03_hitungan_per_status_lintas_halaman_dipinjam_termasuk_terlambat", async () => {
    // 150 item di 2 halaman API: 100 Dikembalikan, 30 Dipinjam (10 terlambat), 15 Hilang, 5 Rusak.
    const semua = [
      ...Array.from({ length: 100 }, (_, i) => item(i + 1)),
      ...Array.from({ length: 30 }, (_, i) =>
        item(101 + i, { status: "DIPINJAM", tanggal_kembali: null, terlambat: i < 10 }),
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        item(131 + i, { status: "HILANG", tanggal_kembali: null, tanggal_kejadian: "2026-07-10" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        item(146 + i, { status: "RUSAK", tanggal_kembali: null, tanggal_kejadian: "2026-07-10" }),
      ),
    ];
    aturRiwayat(semua);
    await buka();
    expect(dipanggil).toEqual([
      "/anggota/riwayat?halaman=1&per_halaman=100",
      "/anggota/riwayat?halaman=2&per_halaman=100",
    ]);
    expect(ringkas("Total Riwayat").textContent).toContain("150buku");
    expect(ringkas("Dipinjam").textContent).toContain("30buku");
    expect(ringkas("Dikembalikan").textContent).toContain("100buku");
    expect(ringkas("Hilang").textContent).toContain("15buku");
    expect(ringkas("Rusak").textContent).toContain("5buku");
    // Tidak ada kartu maupun tab "Terlambat" (bukan status, IR-UI-03).
    expect(screen.getByText("Total Riwayat").closest("div.grid")!.textContent).not.toContain(
      "Terlambat",
    );
    expect(
      within(screen.getByRole("navigation", { name: "Saring riwayat menurut status" }))
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(["Semua", "Dipinjam", "Dikembalikan", "Hilang", "Rusak"]);
  });

  it("FR_AGT_03_status_menyaring_lintas_halaman_bukan_hanya_20_baris", async () => {
    // Item Hilang hanya ada di halaman API ke-2 (indeks 120..124).
    const semua = Array.from({ length: 130 }, (_, i) =>
      i >= 120 && i < 125
        ? item(i + 1, { status: "HILANG", tanggal_kembali: null, tanggal_kejadian: "2026-07-10" })
        : item(i + 1),
    );
    aturRiwayat(semua);
    await buka({ status: "HILANG" });
    const baris = within(tabel()).getAllByRole("row").slice(1);
    expect(baris.map((b) => within(b).getAllByRole("cell")[0].textContent)).toEqual(
      [121, 122, 123, 124, 125].map((n) => `Buku ${n}EKS-${String(n).padStart(6, "0")}`),
    );
    expect(tab("Hilang").getAttribute("aria-current")).toBe("page");
    expect(tab("Semua").getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("Halaman 1 dari 1")).toBeTruthy();
  });

  it("status_tak_sah_atau_berulang_menjadi_semua", async () => {
    aturRiwayat([item(1), item(2, { status: "HILANG", tanggal_kembali: null })]);
    for (const q of [{ status: "TERLAMBAT" }, { status: "hilang" }, { status: "" }]) {
      const { unmount } = await buka(q);
      expect(tab("Semua").getAttribute("aria-current")).toBe("page");
      expect(within(tabel()).getAllByRole("row")).toHaveLength(3);
      unmount();
    }
    const berulang = await HalamanRiwayat({
      searchParams: Promise.resolve({ status: ["HILANG", "RUSAK"] }),
    });
    render(berulang);
    expect(tab("Semua").getAttribute("aria-current")).toBe("page");
  });

  it("ganti_tab_tanpa_halaman", async () => {
    aturRiwayat(Array.from({ length: 45 }, (_, i) => item(i + 1)));
    await buka({ halaman: "3", status: "DIKEMBALIKAN" });
    expect(tab("Semua").getAttribute("href")).toBe("/anggota/riwayat");
    expect(tab("Dipinjam").getAttribute("href")).toBe("/anggota/riwayat?status=DIPINJAM");
    expect(tab("Rusak").getAttribute("href")).toBe("/anggota/riwayat?status=RUSAK");
  });

  it("paginasi_klien_20_per_halaman_mempertahankan_status", async () => {
    aturRiwayat(Array.from({ length: 45 }, (_, i) => item(i + 1)));
    await buka({ status: "DIKEMBALIKAN", halaman: "2" });
    const baris = within(tabel()).getAllByRole("row").slice(1);
    expect(baris).toHaveLength(20);
    expect(within(baris[0]).getByText("Buku 21")).toBeTruthy();
    expect(screen.getByText("Halaman 2 dari 3")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Navigasi halaman" });
    expect(within(nav).getByRole("link", { name: "Berikutnya" }).getAttribute("href")).toBe(
      "/anggota/riwayat?status=DIKEMBALIKAN&halaman=3",
    );
    expect(within(nav).getByRole("link", { name: "Sebelumnya" }).getAttribute("href")).toBe(
      "/anggota/riwayat?status=DIKEMBALIKAN&halaman=1",
    );
  });

  it("halaman_di_luar_jangkauan_kosong", async () => {
    aturRiwayat([item(1)]);
    await buka({ halaman: "9" });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Tidak ada riwayat di halaman ini.")).toBeTruthy();
  });

  it("kosong_per_tab", async () => {
    aturRiwayat([item(1)]);
    await buka({ status: "RUSAK" });
    expect(screen.getByText("Tidak ada riwayat dengan status Rusak.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("galat_halaman_ke_2_diteruskan_tanpa_data_parsial", async () => {
    const galat = new Error("halaman 2 gagal");
    respons.set("/anggota/riwayat?halaman=1&per_halaman=100", {
      data: Array.from({ length: 100 }, (_, i) => item(i + 1)),
      total: 150,
      halaman: 1,
      per_halaman: 100,
    });
    respons.set("/anggota/riwayat?halaman=2&per_halaman=100", Promise.reject(galat));
    await expect(HalamanRiwayat({ searchParams: Promise.resolve({}) })).rejects.toBe(galat);
  });

  it("FR_AGT_03_dipinjam_terlambat_label_dari_field_dan_belum_dikembalikan", async () => {
    aturRiwayat([item(1, { status: "DIPINJAM", tanggal_kembali: null, terlambat: true })]);
    await buka();
    const baris = within(tabel()).getAllByRole("row")[1];
    expect(within(baris).getByText("Terlambat")).toBeTruthy();
    expect(within(baris).getByText("Belum dikembalikan")).toBeTruthy();
    const kartu = within(daftarKartu()).getByRole("listitem");
    expect(within(kartu).getByText("Terlambat")).toBeTruthy();
    expect(within(kartu).getByText("Belum dikembalikan")).toBeTruthy();
    // Tanpa ID transaksi, cover, ikon sort, maupun tautan detail per baris.
    expect(screen.queryByText(/ID Transaksi|TRX/)).toBeNull();
    expect(tabel().querySelector("img, a")).toBeNull();
  });
});

describe("Tagihan (FR-AGT-04, OQ-36; hal-14: semua halaman, hanya tampilan)", () => {
  type Tagihan = {
    id: number;
    jenis: string;
    nominal: number;
    status: string;
    cara_penyelesaian: string | null;
    tanggal_dibentuk: string;
    tanggal_penyelesaian: string | null;
    kode_eksemplar: string;
    judul: string;
  };
  const tagihan = (id: number, ubah: Partial<Tagihan> = {}): Tagihan => ({
    id,
    jenis: "DENDA",
    nominal: 10000,
    status: "LUNAS",
    cara_penyelesaian: "TUNAI",
    tanggal_dibentuk: "2026-09-01",
    tanggal_penyelesaian: "2026-09-02",
    kode_eksemplar: `EKS-${String(id).padStart(6, "0")}`,
    judul: `Buku ${id}`,
    ...ubah,
  });
  const DENDA_BELUM = tagihan(1, {
    nominal: 35555,
    status: "BELUM_LUNAS",
    cara_penyelesaian: null,
    tanggal_dibentuk: "2026-10-05",
    tanggal_penyelesaian: null,
    judul: "Langit yang Sama",
  });
  const GANTI_LUNAS = tagihan(2, {
    jenis: "PENGGANTIAN",
    nominal: 98000,
    cara_penyelesaian: "BUKU_PENGGANTI",
    tanggal_penyelesaian: "2026-09-03",
    judul: "Jejak di Masa Lalu",
  });
  /** Server palsu: dipecah per 100 seperti backend (`per_halaman=100`). */
  function aturSemuaTagihan(semua: Tagihan[]) {
    const jumlah = Math.max(1, Math.ceil(semua.length / 100));
    for (let h = 1; h <= jumlah; h++) {
      respons.set(`/anggota/tagihan?halaman=${h}&per_halaman=100`, {
        data: semua.slice((h - 1) * 100, h * 100),
        total: semua.length,
        halaman: h,
        per_halaman: 100,
      });
    }
  }
  const buka = async (q: Record<string, string> = {}) =>
    render(await HalamanTagihan({ searchParams: Promise.resolve(q) }));
  const tabel = () => screen.getByRole("table", { name: "Daftar Tagihan" });
  const daftarKartu = () => screen.getByRole("list", { name: "Daftar Tagihan" });
  const ringkas = (label: string) => {
    const grid = screen.getByText("Total Tagihan").closest("div.grid") as HTMLElement;
    return within(grid).getByText(label).closest("div")!;
  };

  it("FR_AGT_04_cara_penyelesaian_label_atau_strip", async () => {
    aturSemuaTagihan([DENDA_BELUM, GANTI_LUNAS]);
    await buka();
    const [denda, ganti] = within(daftarKartu()).getAllByRole("listitem");
    expect(within(denda).getByText("Denda")).toBeTruthy();
    expect(within(denda).getByText("Rp35.555")).toBeTruthy();
    expect(within(denda).getByText("Belum Lunas")).toBeTruthy();
    expect(within(denda).getByText("—")).toBeTruthy();
    expect(within(ganti).getByText("Penggantian")).toBeTruthy();
    expect(within(ganti).getByText("Buku Pengganti")).toBeTruthy();
    expect(within(ganti).getByText("Lunas")).toBeTruthy();
    expect(within(ganti).getByText("03/09/2026")).toBeTruthy();
    // OQ-36: admin pengonfirmasi & nominal dibayar tidak ditampilkan; tanpa pembayaran online.
    expect(screen.queryByText(/admin/i)).toBeNull();
    expect(screen.getByText(/Tidak ada pembayaran online/)).toBeTruthy();
  });

  it("FR_AGT_04_kartu_rupiah_hanya_belum_lunas_lintas_halaman", async () => {
    // 130 tagihan di 2 halaman API: 3 Belum Lunas (satu di halaman ke-2), sisanya Lunas.
    const semua = Array.from({ length: 130 }, (_, i) => tagihan(i + 1));
    semua[0] = tagihan(1, { status: "BELUM_LUNAS", nominal: 10000, cara_penyelesaian: null });
    semua[50] = tagihan(51, { status: "BELUM_LUNAS", nominal: 25000, cara_penyelesaian: null });
    semua[120] = tagihan(121, { status: "BELUM_LUNAS", nominal: 35555, cara_penyelesaian: null });
    aturSemuaTagihan(semua);
    await buka();
    expect(dipanggil).toEqual([
      "/anggota/tagihan?halaman=1&per_halaman=100",
      "/anggota/tagihan?halaman=2&per_halaman=100",
    ]);
    const belum = ringkas("Belum Lunas");
    expect(belum.textContent).toContain("Rp70.555");
    expect(belum.textContent).toContain("3 tagihan");
    // Lunas & Total: jumlah saja, tanpa Rupiah (Buku Pengganti bukan uang).
    expect(ringkas("Lunas").textContent).toContain("127tagihan");
    expect(ringkas("Lunas").textContent).not.toContain("Rp");
    expect(ringkas("Total Tagihan").textContent).toContain("130tagihan");
    expect(ringkas("Total Tagihan").textContent).not.toContain("Rp");
  });

  it("FR_TGH_02_03_info_pembayaran_tidak_dapat_dicicil_dan_buku_pengganti", async () => {
    aturSemuaTagihan([DENDA_BELUM]);
    await buka();
    const judul = screen.getByText("Informasi Pembayaran Tagihan");
    const kotak = judul.closest("div.rounded-xl")!;
    expect(kotak.textContent).toContain(
      "Tagihan diselesaikan langsung di perpustakaan dengan konfirmasi petugas, secara tunai atau transfer sebesar nominal tagihan (tidak dapat dicicil). Tagihan penggantian juga dapat diselesaikan dengan menyerahkan buku pengganti. Tidak ada pembayaran online.",
    );
    expect(kotak.getAttribute("role")).toBeNull();
  });

  it("FR_AGT_04_tabel_kolom_urutan_api_dan_strip", async () => {
    const tiga = [GANTI_LUNAS, DENDA_BELUM, tagihan(3, { judul: "Ketiga" })];
    aturSemuaTagihan(tiga);
    await buka();
    const t = tabel();
    const kepala = within(t).getAllByRole("columnheader");
    expect(kepala.map((h) => h.textContent)).toEqual([
      "Jenis",
      "Buku Terkait",
      "Nominal",
      "Status",
      "Cara Penyelesaian",
      "Tanggal Dibentuk",
      "Tanggal Penyelesaian",
    ]);
    expect(kepala.every((h) => h.getAttribute("scope") === "col")).toBe(true);
    const baris = within(t).getAllByRole("row").slice(1);
    expect(baris.map((b) => within(b).getAllByRole("cell")[1].textContent)).toEqual([
      "Jejak di Masa LaluEKS-000002",
      "Langit yang SamaEKS-000001",
      "KetigaEKS-000003",
    ]);
    expect(
      within(baris[0])
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual([
      "Penggantian",
      "Jejak di Masa LaluEKS-000002",
      "Rp98.000",
      "Lunas",
      "Buku Pengganti",
      "01/09/2026",
      "03/09/2026",
    ]);
    const selBelum = within(baris[1])
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(selBelum[4]).toBe("—");
    expect(selBelum[6]).toBe("—");
    // Jenis = chip netral, bukan warna status.
    const chip = within(baris[1]).getByText("Denda");
    expect(chip.className).not.toMatch(/status-/);
  });

  it("paginasi_klien_20_per_halaman", async () => {
    aturSemuaTagihan(Array.from({ length: 45 }, (_, i) => tagihan(i + 1)));
    await buka({ halaman: "3" });
    const baris = within(tabel()).getAllByRole("row").slice(1);
    expect(baris).toHaveLength(5);
    expect(within(baris[0]).getByText("Buku 41")).toBeTruthy();
    expect(screen.getByText("Halaman 3 dari 3")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Navigasi halaman" });
    expect(within(nav).getByRole("link", { name: "Sebelumnya" }).getAttribute("href")).toBe(
      "/anggota/tagihan?halaman=2",
    );
  });

  it("halaman_di_luar_jangkauan_kosong_dan_tanpa_tagihan", async () => {
    aturSemuaTagihan([DENDA_BELUM]);
    const { unmount } = await buka({ halaman: "5" });
    expect(screen.getByText("Tidak ada tagihan di halaman ini.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    unmount();
    respons.clear();
    aturSemuaTagihan([]);
    await buka();
    expect(screen.getByText("Tidak ada tagihan")).toBeTruthy();
  });

  it("galat_halaman_ke_2_diteruskan", async () => {
    const galat = new Error("halaman 2 gagal");
    respons.set("/anggota/tagihan?halaman=1&per_halaman=100", {
      data: Array.from({ length: 100 }, (_, i) => tagihan(i + 1)),
      total: 150,
      halaman: 1,
      per_halaman: 100,
    });
    respons.set("/anggota/tagihan?halaman=2&per_halaman=100", Promise.reject(galat));
    await expect(HalamanTagihan({ searchParams: Promise.resolve({}) })).rejects.toBe(galat);
  });

  it("tanpa_tautan_detail_dan_tombol_bayar", async () => {
    aturSemuaTagihan([DENDA_BELUM, GANTI_LUNAS]);
    const { container } = await buka();
    expect(tabel().querySelector("a, img")).toBeNull();
    expect(daftarKartu().querySelector("a")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect(screen.queryByRole("link", { name: /bayar|detail/i })).toBeNull();
    expect(screen.queryByText(/Urutkan|ID Tagihan/)).toBeNull();
  });
});

const PROFIL_AULIA = {
  kode: "AGT-000123",
  nama: "Aulia Rahma",
  alamat: "Jl. Melati 12",
  email: "aulia@contoh.example",
  telepon: "0812",
  nik: "3171012345678901",
  tanggal_daftar: "2026-01-12",
  ada_foto: false,
};

describe("Profil (FR-AKN-07, K-05; hal-16/17 satu halaman)", () => {
  const RIWAYAT_TOTAL = "/anggota/riwayat?halaman=1&per_halaman=1";
  beforeEach(() => respons.set(RIWAYAT_TOTAL, halaman([], 12)));
  const kartuKiri = () => screen.getByRole("region", { name: "Ringkasan profil" });

  it("K_05_nik_tidak_bisa_diubah (NIK tampil utuh, bukan isian; foto lewat OQ-48)", async () => {
    respons.set("/anggota/profil", PROFIL_AULIA);
    const { container } = render(await HalamanProfil());
    expect(screen.getByText("3171012345678901")).toBeTruthy(); // P3: tidak disamarkan
    expect(screen.queryByLabelText(/NIK/)).toBeNull();
    // OQ-48 (09/10/2026): satu-satunya isian foto = unggah foto sendiri di kartu kiri, di luar kedua form data.
    const isianFoto = container.querySelectorAll('input[type="file"]');
    expect(isianFoto).toHaveLength(1);
    expect(isianFoto[0].closest("form")).toBeNull();
    expect(kartuKiri().contains(isianFoto[0])).toBe(true);
    expect(screen.getByText("12/01/2026")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Aulia Rahma" }).textContent).toBe("AR"); // OQ-42
  });

  it("OQ_42_profil_ada_foto_true_img_dari_endpoint_sendiri", async () => {
    respons.set("/anggota/profil", { ...PROFIL_AULIA, ada_foto: true });
    render(await HalamanProfil());
    const img = screen.getByRole("img", { name: "Foto Aulia Rahma" });
    expect(img.getAttribute("src")).toBe("/api/v1/anggota/profil/foto");
  });

  it("OQ_42_profil_ada_foto_false_inisial_tanpa_img_foto", async () => {
    respons.set("/anggota/profil", PROFIL_AULIA);
    const { container } = render(await HalamanProfil());
    expect(screen.getByRole("img", { name: "Aulia Rahma" }).textContent).toBe("AR");
    // Bukti tanpa request foto: peramban hanya memuat foto bila ada <img> berisi path endpoint foto. Selektor
    // memakai path endpoint (bukan "/foto") karena foto dekoratif kepala halaman ada di `assets/foto/`.
    expect(container.querySelector('img[src*="/api/v1/anggota/profil/foto"]')).toBeNull();
    // Selain profil hanya total riwayat (kartu Total Peminjaman); tidak ada request foto.
    expect(dipanggil).toEqual(["/anggota/profil", RIWAYAT_TOTAL]);
  });

  it("FR_AKN_07_09_profil_memuat_dua_form_terpisah (data diri & ubah password, tombol masing-masing)", async () => {
    respons.set("/anggota/profil", PROFIL_AULIA);
    render(await HalamanProfil());
    expect(screen.getByRole("heading", { name: "Informasi Pribadi" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ubah Password" })).toBeTruthy();
    const tombolData = screen.getByRole("button", { name: "Simpan Data Diri" });
    const tombolPassword = screen.getByRole("button", { name: "Ubah Password" });
    // Dua form terpisah: ubah data diri tidak mensyaratkan password lama.
    const formData = tombolData.closest("form")!;
    const formPassword = tombolPassword.closest("form")!;
    expect(formData).not.toBe(formPassword);
    expect(within(formData).queryByLabelText(/Password Lama/)).toBeNull();
    expect(within(formPassword).getByLabelText(/Password Lama/)).toBeTruthy();
    expect(within(formPassword).queryByLabelText(/^Email/)).toBeNull();
    // Label tombol tetap (keputusan Ayen 09/10/2026).
    expect(
      screen.queryByRole("button", { name: /Simpan Perubahan|Simpan Password Baru/ }),
    ).toBeNull();
  });

  it("P3_nik_utuh_sebagai_teks_di_informasi_tidak_dapat_diubah_bukan_kartu_kiri", async () => {
    respons.set("/anggota/profil", PROFIL_AULIA);
    render(await HalamanProfil());
    const panel = screen.getByRole("region", { name: "Informasi Pribadi" });
    expect(
      within(panel).getByRole("heading", { name: "Informasi Tidak Dapat Diubah" }),
    ).toBeTruthy();
    const nik = within(panel).getByText("3171012345678901");
    expect(nik.tagName).toBe("DD");
    expect(nik.closest("form")).toBeNull();
    expect(screen.getAllByText("3171012345678901")).toHaveLength(1);
    expect(within(kartuKiri()).queryByText(/NIK|3171012345678901/)).toBeNull();
    expect(screen.queryByRole("textbox", { name: /NIK/ })).toBeNull();
    expect(
      within(panel).getByText(
        "NIK hanya diisi saat pendaftaran dan tidak dapat diubah. Bila ada kesalahan data, hubungi petugas perpustakaan.",
      ),
    ).toBeTruthy();
  });

  it("OQ_48_tanpa_kalimat_foto_tidak_dapat_diubah_foto_sekali_dan_tombol_ubah_foto", async () => {
    respons.set("/anggota/profil", { ...PROFIL_AULIA, ada_foto: true });
    const { container } = render(await HalamanProfil());
    expect(container.textContent).not.toMatch(/foto[^.]*tidak dapat diubah/i);
    expect(container.querySelectorAll('img[src="/api/v1/anggota/profil/foto"]')).toHaveLength(1);
    expect(within(kartuKiri()).getByRole("img", { name: "Foto Aulia Rahma" })).toBeTruthy();
    // OQ-48: unggah foto hanya di kartu kiri; tanpa tombol hapus foto.
    expect(within(kartuKiri()).getByText("Ubah Foto")).toBeTruthy();
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /hapus/i })).toBeNull();
  });

  it("ringkasan_kiri_id_tanggal_bergabung_tanpa_lencana_aktif_dan_jenis", async () => {
    respons.set("/anggota/profil", PROFIL_AULIA);
    const { container } = render(await HalamanProfil());
    const k = kartuKiri();
    expect(k.textContent).toContain("ID Anggota");
    expect(k.textContent).toContain("AGT-000123");
    expect(k.textContent).toContain("Tanggal Bergabung");
    expect(k.textContent).toContain("12/01/2026");
    expect(container.textContent).not.toMatch(/\bAktif\b|Jenis Keanggotaan|Reguler/);
  });

  it("FR_AGT_03_total_peminjaman_dari_riwayat_total_bertaut", async () => {
    respons.set("/anggota/profil", PROFIL_AULIA);
    render(await HalamanProfil());
    const kartu = within(kartuKiri()).getByRole("link", { name: /^Total Peminjaman/ });
    expect(kartu.getAttribute("href")).toBe("/anggota/riwayat");
    expect(kartu.textContent).toContain("12buku");
  });

  it("riwayat_gagal_kartu_total_hilang_form_tetap", async () => {
    const galatLog = vi.spyOn(console, "error").mockImplementation(() => {});
    respons.delete(RIWAYAT_TOTAL);
    respons.set("/anggota/profil", PROFIL_AULIA);
    render(await HalamanProfil());
    expect(within(kartuKiri()).queryByText("Total Peminjaman")).toBeNull();
    expect(screen.getByRole("button", { name: "Simpan Data Diri" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ubah Password" })).toBeTruthy();
    expect(galatLog).toHaveBeenCalled();
    galatLog.mockRestore();
  });

  it("NFR_SEC_02_kotak_keamanan_hanya_dua_butir", async () => {
    respons.set("/anggota/profil", PROFIL_AULIA);
    render(await HalamanProfil());
    const kotak = screen.getByRole("complementary", { name: "Demi Keamanan Akun Anda" });
    expect(
      within(kotak).getByText(
        "Perubahan password memerlukan password lama sebagai verifikasi identitas.",
      ),
    ).toBeTruthy();
    expect(
      within(kotak)
        .getAllByRole("listitem")
        .map((l) => l.textContent),
    ).toEqual(["Minimal 8 karakter", "Setelah diubah, sesi di perangkat lain diakhiri"]);
    expect(screen.queryByText(/huruf besar|karakter khusus|tanggal lahir/i)).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

/** Foto dekoratif di kepala halaman: `alt=""`, di dalam panel `aria-hidden` yang hanya tampil mulai `lg`. */
function fotoKepala(wadah: Element) {
  return [...wadah.querySelectorAll("header img")].map((img) => {
    expect(img.getAttribute("alt")).toBe("");
    expect(img.closest('[aria-hidden="true"]')?.classList.contains("hidden")).toBe(true);
    return img.getAttribute("src")!;
  });
}

describe("Kepala halaman area (decisions §B Kepala halaman area)", () => {
  it("IR_UI_03_menu_utama_anggota_berfoto_hero_beranda_judul_tetap", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    respons.set(RIWAYAT_DASHBOARD, halaman([], 0));
    respons.set("/anggota/riwayat?halaman=1&per_halaman=100", halaman([], 0));
    respons.set("/anggota/qr", { kode: "AGT-000123", nama: "Aulia Rahma", isi_qr: "AGT-000123" });
    respons.set("/anggota/profil", PROFIL_AULIA);
    aturTagihan([]);
    const tanpaParam = { searchParams: Promise.resolve({}) };
    const halamanUji: [string, () => Promise<ReactElement>][] = [
      ["Selamat Datang, Aulia Rahma", () => Dashboard()],
      ["QR Anggota", () => HalamanQr()],
      ["Pinjaman Saya", () => HalamanPinjaman()],
      ["Riwayat Peminjaman", () => HalamanRiwayat(tanpaParam)],
      ["Tagihan", () => HalamanTagihan(tanpaParam)],
      ["Profil Saya", () => HalamanProfil()],
    ];
    for (const [judul, buat] of halamanUji) {
      const { container, unmount } = render(await buat());
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(judul);
      expect(fotoKepala(container)).toEqual([expect.stringContaining("hero-beranda")]);
      unmount();
    }
  });
});

describe("di luar lingkup", () => {
  it("K_01_tidak_ada_lapor_hilang_di_area_anggota", async () => {
    respons.set("/anggota/pinjaman", PINJAMAN);
    render(await HalamanPinjaman());
    expect(screen.queryByText(/lapor/i)).toBeNull();
    expect(screen.queryByText(/perpanjang\b|ajukan perpanjangan/i)).toBeNull();
  });
});

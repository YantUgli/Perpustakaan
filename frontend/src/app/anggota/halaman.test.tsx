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

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));

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

/** Tagihan dashboard (D1): satu halaman `per_halaman=100` berisi status yang diberikan. */
function aturTagihan(status: string[]) {
  respons.set("/anggota/tagihan?halaman=1&per_halaman=100", {
    data: status.map((s, i) => ({ id: i + 1, status: s })),
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
    respons.set("/anggota/riwayat?per_halaman=1", halaman([], 12));
    aturTagihan([]);
    render(await Dashboard());
    expect(screen.getByText("Anda dapat meminjam buku")).toBeTruthy();
    expect(kartu("Riwayat Peminjaman").textContent).toContain("12");
    expect(screen.getByText("Belum ada pinjaman aktif")).toBeTruthy();
  });

  it("FR_AGT_05_layak_tombol_lihat_katalog_ke_katalog", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    respons.set("/anggota/riwayat?per_halaman=1", halaman([], 0));
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
    respons.set("/anggota/riwayat?per_halaman=1", halaman([], 0));
    aturTagihan(["BELUM_LUNAS", "BELUM_LUNAS", "LUNAS"]);
    render(await Dashboard());
    expect(screen.getByText("Anda dapat meminjam buku")).toBeTruthy();
    expect(screen.queryByText("Anda belum dapat meminjam buku")).toBeNull();
    expect(kartu("Tagihan Aktif").textContent).toContain("2");
  });

  it("FR_AGT_04_kartu_tagihan_aktif_ke_halaman_tagihan", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    respons.set("/anggota/riwayat?per_halaman=1", halaman([], 0));
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
    respons.set("/anggota/riwayat?per_halaman=1", halaman([], 7));
    aturTagihan([]);
    render(await Dashboard());
    expect(kartu("Jumlah Pinjaman Aktif").getAttribute("href")).toBe("/anggota/pinjaman");
    expect(kartu("Jumlah Pinjaman Aktif").textContent).toContain("2");
    expect(kartu("Riwayat Peminjaman").getAttribute("href")).toBe("/anggota/riwayat");
  });

  it("FR_AGT_02_kartu_jatuh_tempo_terdekat_normal", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", [PINJAMAN[1]]);
    respons.set("/anggota/riwayat?per_halaman=1", halaman([], 1));
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
    respons.set("/anggota/riwayat?per_halaman=1", halaman([], 2));
    aturTagihan([]);
    render(await Dashboard());
    const k = kartu("Jatuh Tempo Terdekat");
    expect(within(k).getByText("Terlambat 4 hari")).toBeTruthy();
    expect(k.textContent).toContain("01/10/2026");
  });

  it("FR_AGT_02_kartu_jatuh_tempo_terdekat_tanpa_pinjaman", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    respons.set("/anggota/riwayat?per_halaman=1", halaman([], 0));
    aturTagihan([]);
    render(await Dashboard());
    const k = kartu("Jatuh Tempo Terdekat");
    expect(k.textContent).toContain("—");
    expect(k.textContent).toContain("Tidak ada pinjaman");
  });

  it("sapaan_dengan_nama_dan_subjudul", async () => {
    respons.set("/anggota/kelayakan", { layak: true, alasan: [] });
    respons.set("/anggota/pinjaman", []);
    respons.set("/anggota/riwayat?per_halaman=1", halaman([], 0));
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
    respons.set("/anggota/riwayat?per_halaman=1", halaman([], 2));
    aturTagihan([]);
    render(await Dashboard());
    expect(screen.getByRole("link", { name: /Lihat Semua/ }).getAttribute("href")).toBe(
      "/anggota/pinjaman",
    );
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
    respons.set("/anggota/riwayat?per_halaman=1", halaman([], 3));
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
    respons.set("/anggota/riwayat?per_halaman=1", halaman([], 0));
    aturTagihan([]);
    render(await Dashboard());
    expect(screen.getAllByText(/^Buku [A-D]$/).map((e) => e.textContent)).toEqual([
      "Buku A",
      "Buku B",
      "Buku C",
    ]);
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
});

describe("Pinjaman Saya (FR-AGT-02, OQ-34)", () => {
  it("FR_AGT_02_label_terlambat_dari_field", async () => {
    respons.set("/anggota/pinjaman", PINJAMAN);
    render(await HalamanPinjaman());
    const [terlambat, normal] = screen.getAllByRole("listitem");
    expect(within(terlambat).getByText("Terlambat")).toBeTruthy();
    expect(within(terlambat).getByText("Terlambat 4 hari")).toBeTruthy();
    expect(within(normal).getByText("Dipinjam")).toBeTruthy();
    expect(within(normal).getByText("5 hari lagi")).toBeTruthy();
    expect(within(normal).getByText("10/10/2026")).toBeTruthy();
    expect(screen.getByText("Perpanjangan pinjaman tidak tersedia")).toBeTruthy();
  });
});

describe("Riwayat (FR-AGT-03, OQ-35)", () => {
  it("FR_AGT_03_hilang_rusak_tampil_tanggal_kejadian_tanpa_keterangan", async () => {
    respons.set("/anggota/riwayat?halaman=2", {
      ...halaman(
        [
          {
            kode_eksemplar: "EKS-000009",
            judul: "Kota yang Tak Tidur",
            tanggal_pinjam: "2026-08-01",
            jatuh_tempo: "2026-08-31",
            tanggal_kembali: null,
            status: "HILANG",
            terlambat: false,
            tanggal_kejadian: "2026-08-20",
          },
          {
            kode_eksemplar: "EKS-000010",
            judul: "Batas dan Harapan",
            tanggal_pinjam: "2026-07-01",
            jatuh_tempo: "2026-07-31",
            tanggal_kembali: "2026-07-15",
            status: "DIKEMBALIKAN",
            terlambat: false,
            tanggal_kejadian: null,
          },
        ],
        25,
      ),
      halaman: 2,
    });
    render(await HalamanRiwayat({ searchParams: Promise.resolve({ halaman: "2" }) }));
    const [hilang, kembali] = screen.getAllByRole("listitem");
    expect(within(hilang).getByText("Hilang")).toBeTruthy();
    expect(within(hilang).getByText("Tanggal kejadian")).toBeTruthy();
    expect(within(hilang).getByText("20/08/2026")).toBeTruthy();
    expect(within(hilang).queryByText(/keterangan/i)).toBeNull();
    expect(within(kembali).getByText("Dikembalikan")).toBeTruthy();
    expect(within(kembali).getByText("15/07/2026")).toBeTruthy();
    expect(screen.getByText("Halaman 2 dari 2")).toBeTruthy();
  });

  it("parameter halaman tidak sah → halaman 1", async () => {
    respons.set("/anggota/riwayat?halaman=1", halaman([]));
    render(await HalamanRiwayat({ searchParams: Promise.resolve({ halaman: "-3" }) }));
    expect(dipanggil).toContain("/anggota/riwayat?halaman=1");
    expect(screen.getByText("Belum ada riwayat peminjaman")).toBeTruthy();
  });
});

describe("Tagihan (FR-AGT-04, OQ-36)", () => {
  it("FR_AGT_04_cara_penyelesaian_label_atau_strip", async () => {
    respons.set(
      "/anggota/tagihan?halaman=1",
      halaman([
        {
          id: 1,
          jenis: "DENDA",
          nominal: 35555,
          status: "BELUM_LUNAS",
          cara_penyelesaian: null,
          tanggal_dibentuk: "2026-10-05",
          tanggal_penyelesaian: null,
          kode_eksemplar: "EKS-000001",
          judul: "Langit yang Sama",
        },
        {
          id: 2,
          jenis: "PENGGANTIAN",
          nominal: 98000,
          status: "LUNAS",
          cara_penyelesaian: "BUKU_PENGGANTI",
          tanggal_dibentuk: "2026-09-01",
          tanggal_penyelesaian: "2026-09-03",
          kode_eksemplar: "EKS-000002",
          judul: "Jejak di Masa Lalu",
        },
      ]),
    );
    render(await HalamanTagihan({ searchParams: Promise.resolve({}) }));
    const [denda, ganti] = screen.getAllByRole("listitem");
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

describe("Profil (FR-AKN-07, K-05)", () => {
  it("K_05_nik_foto_tidak_bisa_diubah (NIK tampil utuh, bukan isian)", async () => {
    respons.set("/anggota/profil", PROFIL_AULIA);
    render(await HalamanProfil());
    expect(screen.getByText("3171012345678901")).toBeTruthy(); // P3: tidak disamarkan
    expect(screen.queryByLabelText(/NIK/)).toBeNull();
    expect(screen.queryByLabelText(/foto/i)).toBeNull();
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
    expect(dipanggil).toEqual(["/anggota/profil"]);
  });

  it("FR_AKN_07_09_profil_memuat_dua_form_terpisah (data diri & ubah password, tombol masing-masing)", async () => {
    respons.set("/anggota/profil", PROFIL_AULIA);
    render(await HalamanProfil());
    expect(screen.getByRole("heading", { name: "Data Diri" })).toBeTruthy();
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
    respons.set("/anggota/riwayat?per_halaman=1", halaman([], 0));
    respons.set("/anggota/riwayat?halaman=1", halaman([], 0));
    respons.set("/anggota/tagihan?halaman=1", halaman([], 0));
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

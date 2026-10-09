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
const router = { refresh: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  notFound: () => {
    throw new TidakDitemukan("404");
  },
}));

const { default: DaftarTagihan } = await import("./page");
const { default: DetailTagihan } = await import("./[id]/page");
const { PanelPenyelesaian } = await import("./[id]/PanelPenyelesaian");
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
  fetchPalsu.mockReset();
  vi.stubGlobal("fetch", fetchPalsu);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const DENDA = {
  id: 7,
  jenis: "DENDA" as const,
  nominal: 35555,
  status: "BELUM_LUNAS" as const,
  tanggal_dibentuk: "2026-10-01",
  anggota: { kode: "AGT-000001", nama: "Aulia Rahma" },
  eksemplar: { kode: "EKS-000012", judul: "Langit yang Sama" },
  cara_penyelesaian: null,
  nominal_dibayar: null,
  tanggal_penyelesaian: null,
  admin_pengonfirmasi: null,
};
const PENGGANTIAN = { ...DENDA, id: 8, jenis: "PENGGANTIAN" as const, nominal: 98000 };
const LUNAS = {
  ...DENDA,
  id: 9,
  status: "LUNAS" as const,
  cara_penyelesaian: "TRANSFER" as const,
  nominal_dibayar: 35555,
  tanggal_penyelesaian: "2026-10-03",
  admin_pengonfirmasi: "Raisya Annisa",
};

describe("Daftar tagihan (FR-TGH-01, OQ-29)", () => {
  it("FR_TGH_01_daftar_filter_dan_paginasi_mempertahankan_filter", async () => {
    respons.set("/admin/tagihan?status=BELUM_LUNAS&anggota=agt-000001&halaman=1", {
      data: [DENDA],
      total: 45,
      halaman: 1,
      per_halaman: 20,
    });
    render(
      await DaftarTagihan({
        searchParams: Promise.resolve({
          status: "BELUM_LUNAS",
          jenis: "PROSES",
          anggota: " agt-000001 ",
        }),
      }),
    );
    const baris = screen.getAllByRole("row")[1];
    expect(within(baris).getByText("AGT-000001")).toBeTruthy();
    expect(within(baris).getByText("Rp35.555")).toBeTruthy();
    expect(within(baris).getByText("Belum Lunas")).toBeTruthy();
    expect(within(baris).getByText("—")).toBeTruthy();
    expect(within(baris).getByRole("link", { name: "Selesaikan" }).getAttribute("href")).toBe(
      "/admin/tagihan/7",
    );
    expect(screen.getByRole("link", { name: "Berikutnya" }).getAttribute("href")).toBe(
      "/admin/tagihan?status=BELUM_LUNAS&anggota=agt-000001&halaman=2",
    );
    // Filter form terisi dari URL (nilai tak dikenal dibuang).
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("BELUM_LUNAS");
    expect((screen.getByLabelText("Jenis") as HTMLSelectElement).value).toBe("");
  });

  it("FR_TGH_06_tanpa_tambah_ubah_hapus", async () => {
    respons.set("/admin/tagihan?halaman=1", {
      data: [DENDA, LUNAS],
      total: 2,
      halaman: 1,
      per_halaman: 20,
    });
    render(await DaftarTagihan({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByText(/tambah tagihan/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /ubah|hapus|edit/i })).toBeNull();
    expect(screen.queryByText(/proses|e-wallet|dibebaskan/i)).toBeNull();
  });

  it("kosong → KosongState", async () => {
    respons.set("/admin/tagihan?anggota=AGT-999999&halaman=1", {
      data: [],
      total: 0,
      halaman: 1,
      per_halaman: 20,
    });
    render(await DaftarTagihan({ searchParams: Promise.resolve({ anggota: "AGT-999999" }) }));
    expect(screen.getByText("Tidak ada tagihan")).toBeTruthy();
  });
});

describe("Detail tagihan (FR-TGH-05/06)", () => {
  it("FR_TGH_05_06_detail_lunas_tanpa_form_dan_info_penyelesaian", async () => {
    respons.set("/admin/tagihan/9", LUNAS);
    render(await DetailTagihan({ params: Promise.resolve({ id: "9" }) }));
    expect(screen.getByText("Lunas")).toBeTruthy();
    expect(screen.getByText("Transfer")).toBeTruthy();
    expect(screen.getByText("03/10/2026")).toBeTruthy();
    expect(screen.getByText("Raisya Annisa")).toBeTruthy();
    expect(screen.getAllByText("Rp35.555").length).toBe(2); // nominal & nominal dibayar (OQ-08)
    expect(screen.queryByRole("button")).toBeNull(); // tanpa form, tanpa ubah/hapus
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("detail_tidak_ada_404", async () => {
    respons.set(
      "/admin/tagihan/99",
      new GalatApi(404, "TGH_TIDAK_ADA", "Tagihan tidak ditemukan.", null, {}, false),
    );
    await expect(DetailTagihan({ params: Promise.resolve({ id: "99" }) })).rejects.toBeInstanceOf(
      TidakDitemukan,
    );
    await expect(DetailTagihan({ params: Promise.resolve({ id: "abc" }) })).rejects.toBeInstanceOf(
      TidakDitemukan,
    );
  });
});

describe("Penyelesaian (FR-TGH-02..04, OQ-08, OQ-28)", () => {
  function pilih(cara: string) {
    fireEvent.click(screen.getByRole("radio", { name: cara }));
  }
  function isiTanggal(nilai: string) {
    fireEvent.change(screen.getByLabelText(/^Tanggal/), { target: { value: nilai } });
  }

  it("FR_TGH_03_denda_tanpa_opsi_buku_pengganti", () => {
    render(<PanelPenyelesaian tagihan={DENDA} />);
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual([
      "TUNAI",
      "TRANSFER",
    ]);
  });

  it("P1_P2_nominal_dan_tanggal_kosong_dengan_acuan; min tanggal = dibentuk, tanpa max", () => {
    render(<PanelPenyelesaian tagihan={DENDA} />);
    pilih("Tunai");
    expect((screen.getByLabelText(/Nominal dibayar/) as HTMLInputElement).value).toBe("");
    // FR-TGH-02, Brief §7.5: keterangan menyebut nominal tagihan; isian tetap kosong (P1).
    const nominal = screen.getByLabelText(/Nominal dibayar/);
    const ket = document.getElementById(nominal.getAttribute("aria-describedby")!);
    expect(ket?.textContent).toBe(
      "Isi sama dengan nominal tagihan (Rp35.555). Kembalian diberikan di luar sistem; pembayaran sebagian tidak diterima.",
    );
    const tanggal = screen.getByLabelText(/^Tanggal penyelesaian/) as HTMLInputElement;
    expect(tanggal.value).toBe("");
    expect(tanggal.getAttribute("min")).toBe("2026-10-01");
    expect(tanggal.getAttribute("max")).toBeNull();
  });

  it("OQ_08_buku_pengganti_tanpa_isian_nominal_dan_body_tanpa_nominal; pesan sukses + pengingat label", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ ...PENGGANTIAN, status: "LUNAS" }));
    render(<PanelPenyelesaian tagihan={PENGGANTIAN} />);
    pilih("Buku Pengganti");
    expect(screen.queryByLabelText(/Nominal/)).toBeNull();
    isiTanggal("2026-10-04");
    fireEvent.click(screen.getByRole("button", { name: "Selesaikan Tagihan" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ya, Selesaikan" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    const [url, init] = fetchPalsu.mock.calls[0];
    expect(url).toBe("/api/v1/admin/tagihan/8/penyelesaian");
    expect(JSON.parse(init.body)).toEqual({ cara: "BUKU_PENGGANTI", tanggal: "2026-10-04" });
    expect(
      screen.getByText(
        "Tagihan telah lunas. Eksemplar EKS-000012 kembali berstatus Tersedia dengan kode yang sama; pasang label EKS-000012 pada buku pengganti.",
      ),
    ).toBeTruthy();
  });

  it("pesan sukses bertahan setelah halaman menampilkan status Lunas", async () => {
    fetchPalsu.mockResolvedValue(Response.json({ ...DENDA, status: "LUNAS" }));
    const { rerender } = render(<PanelPenyelesaian tagihan={DENDA} />);
    pilih("Tunai");
    fireEvent.change(screen.getByLabelText(/Nominal dibayar/), { target: { value: "35555" } });
    isiTanggal("2026-10-05");
    fireEvent.click(screen.getByRole("button", { name: "Selesaikan Tagihan" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ya, Selesaikan" }));
    await screen.findByText("Tagihan telah lunas.");
    rerender(<PanelPenyelesaian tagihan={{ ...DENDA, status: "LUNAS" }} />);
    expect(screen.getByText("Tagihan telah lunas.")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(JSON.parse(fetchPalsu.mock.calls[0][1].body)).toEqual({
      cara: "TUNAI",
      nominal: 35555,
      tanggal: "2026-10-05",
    });
  });

  it("FR_TGH_02_nominal_tidak_sama_pesan_backend_apa_adanya (klien tidak membandingkan)", async () => {
    const pesan =
      "Nominal Rp10.000 tidak sama dengan tagihan Rp35.555; pembayaran sebagian tidak diterima.";
    fetchPalsu.mockResolvedValue(
      Response.json(
        { detail: { kode: "TGH_NOMINAL_TIDAK_SAMA", pesan, rujukan: "FR-TGH-02" } },
        { status: 422 },
      ),
    );
    render(<PanelPenyelesaian tagihan={DENDA} />);
    pilih("Transfer");
    fireEvent.change(screen.getByLabelText(/Nominal dibayar/), { target: { value: "10000" } });
    isiTanggal("2026-10-05");
    fireEvent.click(screen.getByRole("button", { name: "Selesaikan Tagihan" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ya, Selesaikan" }));
    expect((await screen.findByRole("alert")).textContent).toBe(pesan);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("OQ_28_tanggal_di_luar_batas_pesan_backend", async () => {
    const pesan =
      "Tanggal penyelesaian harus antara 01/10/2026 (tagihan dibentuk) dan 05/10/2026 (hari ini).";
    fetchPalsu.mockResolvedValue(
      Response.json(
        { detail: { kode: "TGH_TANGGAL", pesan, rujukan: "FR-TGH-02" } },
        { status: 422 },
      ),
    );
    render(<PanelPenyelesaian tagihan={DENDA} />);
    pilih("Tunai");
    fireEvent.change(screen.getByLabelText(/Nominal dibayar/), { target: { value: "35555" } });
    isiTanggal("2026-12-31");
    fireEvent.click(screen.getByRole("button", { name: "Selesaikan Tagihan" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ya, Selesaikan" }));
    expect((await screen.findByRole("alert")).textContent).toBe(pesan);
  });

  it("konfirmasi_modal_sebelum_kirim; Batal tidak mengirim", async () => {
    render(<PanelPenyelesaian tagihan={DENDA} />);
    pilih("Tunai");
    fireEvent.change(screen.getByLabelText(/Nominal dibayar/), { target: { value: "35555" } });
    isiTanggal("2026-10-05");
    fireEvent.click(screen.getByRole("button", { name: "Selesaikan Tagihan" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("Tagihan yang sudah Lunas tidak dapat diubah atau dihapus."),
    ).toBeTruthy();
    expect(within(dialog).getByText("Rp35.555")).toBeTruthy();
    expect(within(dialog).getByText("05/10/2026")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Batal" }));
    expect(fetchPalsu).not.toHaveBeenCalled();
  });

  it("isian wajib ditahan di klien tanpa modal & tanpa kirim", () => {
    render(<PanelPenyelesaian tagihan={DENDA} />);
    fireEvent.click(screen.getByRole("button", { name: "Selesaikan Tagihan" }));
    expect(screen.getByText("Pilih cara penyelesaian.")).toBeTruthy();
    expect(screen.getByText("Tanggal penyelesaian wajib diisi.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchPalsu).not.toHaveBeenCalled();
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
  it("IR_UI_03_daftar_tagihan_berfoto", async () => {
    respons.set("/admin/tagihan?halaman=1", { data: [], total: 0, halaman: 1, per_halaman: 20 });
    const { container } = render(await DaftarTagihan({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { level: 1, name: "Tagihan" })).toBeTruthy();
    expect(fotoKepala(container)).toEqual([expect.stringContaining("hero-beranda")]);
  });
});

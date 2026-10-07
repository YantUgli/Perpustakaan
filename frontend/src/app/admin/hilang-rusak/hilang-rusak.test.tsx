// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GalatApi, PESAN_SISTEM } from "@/lib/galat";
import { labelStatus } from "@/lib/label";

// jsdom belum mengimplementasikan <dialog>.showModal/close
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

// Butir 7: hapus parameter tak terpakai di mock (bukan eslint-disable)
const pemindai: { onHasil: (t: string) => void; label: string; nonaktif: boolean } = {
  onHasil: () => {},
  label: "",
  nonaktif: false,
};

vi.mock("@/components/pemindai/Pemindai", () => ({
  Pemindai: ({
    onHasil,
    label,
    nonaktif,
  }: {
    onHasil: (t: string) => void;
    label: string;
    nonaktif?: boolean;
  }) => {
    pemindai.onHasil = onHasil;
    pemindai.label = label;
    pemindai.nonaktif = nonaktif ?? false;
    return <div data-testid="pemindai" data-label={label} />;
  },
}));

const mockDaftarItemAnggota = vi.fn();
const mockPratinjauKembali = vi.fn();
const mockCariAnggota = vi.fn();
const mockCatatHilangRusak = vi.fn();

vi.mock("@/lib/sirkulasi", () => ({
  daftarItemAnggota: (...a: unknown[]) => mockDaftarItemAnggota(...a),
  pratinjauKembali: (...a: unknown[]) => mockPratinjauKembali(...a),
  cariAnggota: (...a: unknown[]) => mockCariAnggota(...a),
  catatHilangRusak: (...a: unknown[]) => mockCatatHilangRusak(...a),
}));

const { AlurHilangRusak } = await import("./AlurHilangRusak");

const ITEM_1 = {
  item_id: 11,
  kode_eksemplar: "EKS-000001",
  judul: "Bumi Manusia",
  tanggal_pinjam: "2026-09-01",
  jatuh_tempo: "2026-10-01",
  hari_terlambat: 5,
  // Sengaja ≠ PENCATATAN.tagihan.nominal (150.000): nominal sukses harus dari respons POST.
  nominal_penggantian: 145000,
};

const ITEM_2 = {
  item_id: 12,
  kode_eksemplar: "EKS-000002",
  judul: "Laut Bercerita",
  tanggal_pinjam: "2026-09-10",
  jatuh_tempo: "2026-10-10",
  hari_terlambat: 0,
  nominal_penggantian: 89000,
};

const DAFTAR_PENUH = {
  anggota: { kode: "AGT-000001", nama: "Siti Aisyah" },
  item: [ITEM_1, ITEM_2],
};

const DAFTAR_KOSONG = {
  anggota: { kode: "AGT-000002", nama: "Dewi" },
  item: [],
};

const PRATINJAU_BUKU = {
  eksemplar: { kode: "EKS-000001", judul: "Bumi Manusia" },
  peminjam: { kode: "AGT-000001", nama: "Siti Aisyah" },
  tanggal_pinjam: "2026-09-01",
  jatuh_tempo: "2026-10-01",
  hari_terlambat: 5,
  denda: 10000,
};

const PENCATATAN = {
  item_id: 11,
  kode_eksemplar: "EKS-000001",
  judul: "Bumi Manusia",
  anggota: { kode: "AGT-000001", nama: "Siti Aisyah" },
  status: "HILANG",
  tanggal_kejadian: "2026-10-06",
  keterangan: "Dilaporkan hilang oleh anggota",
  tagihan: { id: 9, nominal: 150000 },
  transaksi_selesai: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  pemindai.onHasil = () => {};
  pemindai.label = "";
  pemindai.nonaktif = false;
});
afterEach(cleanup);

describe("AlurHilangRusak (FR-HLR)", () => {
  it("test_FR_HLR_01_tab_pindai_anggota_aktif_bawaan", () => {
    render(<AlurHilangRusak />);
    expect(screen.getByRole("tab", { name: "Pindai Anggota" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("tab", { name: "Pindai Buku" }).getAttribute("aria-selected")).toBe(
      "false",
    );
    expect(pemindai.label).toBe("Kode Anggota");
  });

  it("test_FR_HLR_01_ganti_tab_pindai_buku_ubah_label_pemindai", () => {
    render(<AlurHilangRusak />);
    fireEvent.click(screen.getByRole("tab", { name: "Pindai Buku" }));
    expect(pemindai.label).toBe("Kode Eksemplar");
    expect(screen.getByRole("tab", { name: "Pindai Buku" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("test_FR_HLR_01_scan_anggota_tampil_daftar_item", async () => {
    mockDaftarItemAnggota.mockResolvedValueOnce(DAFTAR_PENUH);
    render(<AlurHilangRusak />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => expect(screen.getByText("Bumi Manusia")).toBeTruthy());
    expect(screen.getByText("Laut Bercerita")).toBeTruthy();
    expect(mockDaftarItemAnggota).toHaveBeenCalledWith("AGT-000001");
  });

  it("test_FR_HLR_01_pilih_item_manual_dari_daftar_buka_form", async () => {
    // butir 9: pilih item manual = FR-HLR-01
    mockDaftarItemAnggota.mockResolvedValueOnce(DAFTAR_PENUH);
    render(<AlurHilangRusak />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    fireEvent.click(screen.getByText("Bumi Manusia"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Catat Hilang/Rusak" })).toBeTruthy(),
    );
  });

  it("test_anggota_tanpa_item_tampil_pesan_kosong", async () => {
    mockDaftarItemAnggota.mockResolvedValueOnce(DAFTAR_KOSONG);
    render(<AlurHilangRusak />);
    await act(async () => pemindai.onHasil("AGT-000002"));
    await waitFor(() =>
      expect(
        screen.getByText("Anggota ini tidak memiliki buku yang sedang dipinjam."),
      ).toBeTruthy(),
    );
  });

  it("test_FR_HLR_02_jalur_rusak_saat_diserahkan", async () => {
    // Jalur B: scan eksemplar → pratinjauKembali → daftarItemAnggota(peminjam.kode) → auto-pilih item
    mockPratinjauKembali.mockResolvedValueOnce(PRATINJAU_BUKU);
    mockDaftarItemAnggota.mockResolvedValueOnce(DAFTAR_PENUH);
    render(<AlurHilangRusak />);
    fireEvent.click(screen.getByRole("tab", { name: "Pindai Buku" }));
    await act(async () => pemindai.onHasil("EKS-000001"));
    expect(mockPratinjauKembali).toHaveBeenCalledWith("EKS-000001");
    // Jalur B: cocokkan dengan pratinjau.eksemplar.kode (sudah dinormalisasi backend)
    expect(mockDaftarItemAnggota).toHaveBeenCalledWith("AGT-000001");
    // Setelah auto-pilih, form tampil
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Catat Hilang/Rusak" })).toBeTruthy(),
    );
    expect(screen.getAllByText("Bumi Manusia").length).toBeGreaterThan(0);
  });

  it("test_FR_HLR_03_jenis_tanpa_default_tombol_tahan", async () => {
    // butir 9: test_FR_HLR_05_jenis_* → FR_HLR_03
    mockDaftarItemAnggota.mockResolvedValueOnce(DAFTAR_PENUH);
    render(<AlurHilangRusak />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    fireEvent.click(screen.getByText("Bumi Manusia"));
    await waitFor(() => screen.getByRole("button", { name: "Catat Hilang/Rusak" }));

    // Radio belum dipilih (tidak ada nilai bawaan, butir 4)
    const radioHilang = screen.getByRole("radio", { name: "Hilang" }) as HTMLInputElement;
    const radioRusak = screen.getByRole("radio", { name: "Rusak" }) as HTMLInputElement;
    expect(radioHilang.checked).toBe(false);
    expect(radioRusak.checked).toBe(false);

    // Tombol disabled karena jenis kosong
    expect(
      (screen.getByRole("button", { name: "Catat Hilang/Rusak" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("test_FR_HLR_03_tombol_tahan_sampai_semua_terisi", async () => {
    // Butir 1: tanggal TIDAK diisi otomatis; tombol tahan sampai jenis+tanggal+keterangan terisi
    mockDaftarItemAnggota.mockResolvedValueOnce(DAFTAR_PENUH);
    render(<AlurHilangRusak />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    fireEvent.click(screen.getByText("Bumi Manusia"));
    await waitFor(() => screen.getByRole("button", { name: "Catat Hilang/Rusak" }));

    // Jenis terisi, tanggal & keterangan kosong → disabled
    fireEvent.click(screen.getByRole("radio", { name: "Hilang" }));
    expect(
      (screen.getByRole("button", { name: "Catat Hilang/Rusak" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    // Keterangan terisi, tanggal masih kosong → masih disabled
    fireEvent.change(screen.getByLabelText(/^Keterangan/), {
      target: { value: "Buku hilang" },
    });
    expect(
      (screen.getByRole("button", { name: "Catat Hilang/Rusak" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    // Tanggal terisi → tombol aktif
    fireEvent.change(screen.getByLabelText(/Tanggal kejadian/), {
      target: { value: "2026-10-06" },
    });
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Catat Hilang/Rusak" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });

  it("test_FR_HLR_03_tanggal_kejadian_ada_atribut_min_tanpa_max", async () => {
    mockDaftarItemAnggota.mockResolvedValueOnce(DAFTAR_PENUH);
    render(<AlurHilangRusak />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    fireEvent.click(screen.getByText("Bumi Manusia"));
    await waitFor(() => screen.getByLabelText(/Tanggal kejadian/));

    const inputTanggal = screen.getByLabelText(/Tanggal kejadian/) as HTMLInputElement;
    // min = tanggal_pinjam item (butir 4, OQ-26)
    expect(inputTanggal.getAttribute("min")).toBe(ITEM_1.tanggal_pinjam);
    // tidak ada max
    expect(inputTanggal.hasAttribute("max")).toBe(false);
  });

  it("test_FR_HLR_03_modal_muncul_sebelum_post_dan_batal_tidak_kirim", async () => {
    mockDaftarItemAnggota.mockResolvedValueOnce(DAFTAR_PENUH);
    render(<AlurHilangRusak />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    fireEvent.click(screen.getByText("Bumi Manusia"));
    await waitFor(() => screen.getByRole("button", { name: "Catat Hilang/Rusak" }));

    // Isi semua field wajib (butir 1: tanggal tidak auto-terisi)
    fireEvent.click(screen.getByRole("radio", { name: "Hilang" }));
    fireEvent.change(screen.getByLabelText(/Tanggal kejadian/), {
      target: { value: "2026-10-06" },
    });
    fireEvent.change(screen.getByLabelText(/^Keterangan/), {
      target: { value: "Buku hilang" },
    });

    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Catat Hilang/Rusak" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Catat Hilang/Rusak" }));

    // Modal terbuka (butir 6)
    await waitFor(() => expect(screen.getByText("Konfirmasi Pencatatan")).toBeTruthy());
    // F6 dibalik (Ayen, 2026-10-07): modal menampilkan nominal_penggantian item terpilih
    expect(screen.getByText("Rp145.000")).toBeTruthy();

    // Klik Batal → modal tutup → catatHilangRusak TIDAK dipanggil
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    await waitFor(() => expect(document.querySelector("dialog")?.hasAttribute("open")).toBe(false));
    expect(mockCatatHilangRusak).not.toHaveBeenCalled();
  });

  it("test_FR_HLR_03_FR_HLR_04_ya_catat_api_nominal_dari_tagihan", async () => {
    // butir 9: FR-HLR-04 = nominal sukses dari tagihan.nominal
    mockDaftarItemAnggota.mockResolvedValueOnce(DAFTAR_PENUH);
    mockCatatHilangRusak.mockResolvedValueOnce(PENCATATAN);
    render(<AlurHilangRusak />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    fireEvent.click(screen.getByText("Bumi Manusia"));
    await waitFor(() => screen.getByRole("button", { name: "Catat Hilang/Rusak" }));

    fireEvent.click(screen.getByRole("radio", { name: "Hilang" }));
    fireEvent.change(screen.getByLabelText(/Tanggal kejadian/), {
      target: { value: "2026-10-06" },
    });
    fireEvent.change(screen.getByLabelText(/^Keterangan/), {
      target: { value: "Dilaporkan hilang oleh anggota" },
    });

    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Catat Hilang/Rusak" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Catat Hilang/Rusak" })),
    );
    await waitFor(() => screen.getByText("Konfirmasi Pencatatan"));

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ya, Catat" })));

    // Nominal dari PencatatanKeluar.tagihan.nominal (FR-HLR-04)
    await waitFor(() => expect(screen.getByText("Berhasil dicatat")).toBeTruthy());
    expect(screen.getByText("Rp150.000")).toBeTruthy();
    // catatHilangRusak dipanggil dengan tanggal yang diisi admin (bukan auto dari tanggal_pinjam)
    expect(mockCatatHilangRusak).toHaveBeenCalledWith(
      ITEM_1.item_id,
      "HILANG",
      "2026-10-06",
      "Dilaporkan hilang oleh anggota",
    );
  });

  it("test_FR_HLR_04_modal_menampilkan_nominal_penggantian_dari_api", async () => {
    // F6 dibalik (Ayen, 2026-10-07): nominal = ItemAktifKeluar.nominal_penggantian apa adanya
    mockDaftarItemAnggota.mockResolvedValueOnce(DAFTAR_PENUH);
    render(<AlurHilangRusak />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => screen.getByText("Laut Bercerita"));
    fireEvent.click(screen.getByText("Laut Bercerita"));
    await waitFor(() => screen.getByRole("button", { name: "Catat Hilang/Rusak" }));

    fireEvent.click(screen.getByRole("radio", { name: "Rusak" }));
    fireEvent.change(screen.getByLabelText(/Tanggal kejadian/), {
      target: { value: "2026-10-06" },
    });
    fireEvent.change(screen.getByLabelText(/^Keterangan/), {
      target: { value: "Sampul sobek" },
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Catat Hilang/Rusak" })),
    );
    await waitFor(() => screen.getByText("Konfirmasi Pencatatan"));

    const modal = screen.getByText("Konfirmasi Pencatatan").closest("dialog") as HTMLElement;
    expect(modal).toBeTruthy();
    expect(within(modal).getByText(/Tagihan penggantian/)).toBeTruthy();
    expect(within(modal).getByText("Rp89.000")).toBeTruthy();
    expect(within(modal).getByText("(nominal final dihitung saat dicatat)")).toBeTruthy();
    // Nominal item lain tidak ikut tampil
    expect(within(modal).queryByText("Rp145.000")).toBeNull();
    // Belum ada POST: nominal di modal bukan dari respons pencatatan
    expect(mockCatatHilangRusak).not.toHaveBeenCalled();
  });

  it("test_FR_HLR_03_label_jenis_dari_labelStatus", async () => {
    // Butir 1b: label jenis di modal & layar sukses berasal dari labelStatus(), bukan string literal
    mockDaftarItemAnggota.mockResolvedValueOnce(DAFTAR_PENUH);
    mockCatatHilangRusak.mockResolvedValueOnce(PENCATATAN);
    render(<AlurHilangRusak />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    fireEvent.click(screen.getByText("Bumi Manusia"));
    await waitFor(() => screen.getByRole("button", { name: "Catat Hilang/Rusak" }));

    fireEvent.click(screen.getByRole("radio", { name: labelStatus("HILANG").label }));
    fireEvent.change(screen.getByLabelText(/Tanggal kejadian/), {
      target: { value: "2026-10-06" },
    });
    fireEvent.change(screen.getByLabelText(/^Keterangan/), {
      target: { value: "Hilang" },
    });
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Catat Hilang/Rusak" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Catat Hilang/Rusak" })),
    );
    // Modal: teks Hilang dari labelStatus("HILANG").label
    await waitFor(() => screen.getByText("Konfirmasi Pencatatan"));
    expect(screen.getAllByText(labelStatus("HILANG").label).length).toBeGreaterThan(0);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ya, Catat" })));
    // Layar sukses: inline "Berhasil dicatat — Hilang" — pakai regex karena bukan elemen tersendiri
    await waitFor(() => screen.getByText(/Berhasil dicatat/));
    expect(screen.getByText(new RegExp(labelStatus("HILANG").label))).toBeTruthy();
  });

  it("test_cari_anggota_galat_api_tampil_pesan", async () => {
    // Butir 4: cari gagal → tampilkan GalatApi.pesan; "Anggota tidak ditemukan." hanya bila respons sukses kosong
    mockCariAnggota.mockRejectedValueOnce(
      new GalatApi(500, "SISTEM", "Layanan tidak tersedia saat ini.", "", {}, true),
    );
    render(<AlurHilangRusak />);
    fireEvent.change(screen.getByLabelText("Kata kunci pencarian anggota"), {
      target: { value: "Siti" },
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cari" })));
    await waitFor(() => expect(screen.getByText("Layanan tidak tersedia saat ini.")).toBeTruthy());
    // "Anggota tidak ditemukan." tidak tampil (hasilCari = null, bukan [])
    expect(screen.queryByText("Anggota tidak ditemukan.")).toBeNull();
  });

  it("test_nonaktif_saat_muat_daftar_berjalan", async () => {
    // Pemindai di-render di tahap identifikasi; nonaktif=true saat prosesAnggota berjalan
    let resolveDaftar: (v: typeof DAFTAR_PENUH) => void;
    const promise = new Promise<typeof DAFTAR_PENUH>((res) => {
      resolveDaftar = res;
    });
    mockDaftarItemAnggota.mockReturnValueOnce(promise);
    render(<AlurHilangRusak />);

    act(() => void pemindai.onHasil("AGT-000001"));
    await waitFor(() => expect(pemindai.nonaktif).toBe(true));

    await act(async () => resolveDaftar!(DAFTAR_PENUH));
    await waitFor(() => expect(pemindai.nonaktif).toBe(false));
    expect(screen.getByText("Bumi Manusia")).toBeTruthy();
  });
});

// Galat yang bukan GalatApi (mis. error JS tak terduga) → PESAN_SISTEM, sama dengan halaman lain.
describe("AlurHilangRusak galat non-API (IR-UI-04)", () => {
  it("test_IR_UI_04_daftar_item_anggota_galat_non_api_tampil_pesan_sistem", async () => {
    mockDaftarItemAnggota.mockRejectedValueOnce(new Error("tak terduga"));
    render(<AlurHilangRusak />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => expect(screen.getByText(PESAN_SISTEM)).toBeTruthy());
  });

  it("test_IR_UI_04_jalur_b_pindai_buku_galat_non_api_tampil_pesan_sistem", async () => {
    mockPratinjauKembali.mockRejectedValueOnce(new Error("tak terduga"));
    render(<AlurHilangRusak />);
    fireEvent.click(screen.getByRole("tab", { name: "Pindai Buku" }));
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => expect(screen.getByText(PESAN_SISTEM)).toBeTruthy());
  });

  it("test_IR_UI_04_cari_anggota_galat_non_api_tampil_pesan_sistem", async () => {
    mockCariAnggota.mockRejectedValueOnce(new Error("tak terduga"));
    render(<AlurHilangRusak />);
    fireEvent.change(screen.getByLabelText("Kata kunci pencarian anggota"), {
      target: { value: "Siti" },
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cari" })));
    await waitFor(() => expect(screen.getByText(PESAN_SISTEM)).toBeTruthy());
  });

  it("test_IR_UI_04_catat_galat_non_api_tampil_pesan_sistem", async () => {
    mockDaftarItemAnggota.mockResolvedValueOnce(DAFTAR_PENUH);
    mockCatatHilangRusak.mockRejectedValueOnce(new Error("tak terduga"));
    render(<AlurHilangRusak />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    fireEvent.click(screen.getByText("Bumi Manusia"));
    await waitFor(() => screen.getByRole("button", { name: "Catat Hilang/Rusak" }));
    fireEvent.click(screen.getByRole("radio", { name: "Hilang" }));
    fireEvent.change(screen.getByLabelText(/Tanggal kejadian/), {
      target: { value: "2026-10-06" },
    });
    fireEvent.change(screen.getByLabelText(/^Keterangan/), {
      target: { value: "Dilaporkan hilang oleh anggota" },
    });
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Catat Hilang/Rusak" })),
    );
    await waitFor(() => screen.getByText("Konfirmasi Pencatatan"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ya, Catat" })));
    await waitFor(() => expect(screen.getByText(PESAN_SISTEM)).toBeTruthy());
  });
});

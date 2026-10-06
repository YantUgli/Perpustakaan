// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GalatApi } from "@/lib/galat";

// State Pemindai yang dapat diakses test; butir 7: hapus param tak terpakai
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

const mockIdentifikasiAnggota = vi.fn();
const mockCariAnggota = vi.fn();
const mockValidasiItem = vi.fn();
const mockKonfirmasiPeminjaman = vi.fn();

vi.mock("@/lib/sirkulasi", () => ({
  identifikasiAnggota: (...a: unknown[]) => mockIdentifikasiAnggota(...a),
  cariAnggota: (...a: unknown[]) => mockCariAnggota(...a),
  validasiItem: (...a: unknown[]) => mockValidasiItem(...a),
  konfirmasiPeminjaman: (...a: unknown[]) => mockKonfirmasiPeminjaman(...a),
}));

const { AlurPeminjaman } = await import("./AlurPeminjaman");

const ANGGOTA_LAYAK = {
  id: 1,
  kode: "AGT-000001",
  nama: "Siti Aisyah",
  pinjaman_aktif: 0,
  layak: true,
  alasan: [],
};

const ANGGOTA_BLOKIR = {
  id: 2,
  kode: "AGT-000002",
  nama: "Dewi",
  pinjaman_aktif: 1,
  layak: false,
  alasan: [
    {
      kode: "PJM_ADA_TAGIHAN",
      pesan: "Anggota memiliki 1 tagihan belum lunas (total Rp10.000).",
      rujukan: "FR-PJM-03",
    },
  ],
};

const ITEM_VALID = { eksemplar_id: 1, kode: "EKS-000001", judul: "Bumi Manusia" };

const TRANSAKSI = {
  id: 10,
  anggota: { kode: "AGT-000001", nama: "Siti Aisyah" },
  tanggal_transaksi: "2026-10-06",
  item: [
    {
      kode_eksemplar: "EKS-000001",
      judul: "Bumi Manusia",
      tanggal_pinjam: "2026-10-06",
      jatuh_tempo: "2026-11-05",
      status: "DIPINJAM",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  pemindai.onHasil = () => {};
  pemindai.label = "";
  pemindai.nonaktif = false;
});
afterEach(cleanup);

describe("AlurPeminjaman (FR-PJM)", () => {
  it("test_FR_PJM_01_scan_anggota_memicu_identifikasi", async () => {
    mockIdentifikasiAnggota.mockResolvedValueOnce(ANGGOTA_LAYAK);
    render(<AlurPeminjaman />);
    expect(pemindai.label).toBe("Kode Anggota");
    await act(async () => pemindai.onHasil("AGT-000001"));
    expect(mockIdentifikasiAnggota).toHaveBeenCalledWith("AGT-000001");
    // Anggota layak → maju ke tahap buku
    await waitFor(() => expect(pemindai.label).toBe("Kode Eksemplar"));
  });

  it("test_FR_PJM_01_cari_anggota_teks_daftar_hasil_tampil_tidak_otomatis_pilih", async () => {
    mockCariAnggota.mockResolvedValueOnce({
      data: [{ kode: "AGT-000001", nama: "Siti Aisyah" }],
      total: 1,
      halaman: 1,
      per_halaman: 20,
    });
    render(<AlurPeminjaman />);
    fireEvent.change(screen.getByLabelText("Kata kunci pencarian anggota"), {
      target: { value: "Siti" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await waitFor(() => expect(screen.getByText("Siti Aisyah")).toBeTruthy());
    // Hasil tampil sebagai daftar; identifikasiAnggota BELUM dipanggil otomatis
    expect(mockIdentifikasiAnggota).not.toHaveBeenCalled();
    expect(screen.getByText("AGT-000001")).toBeTruthy();
  });

  it("test_FR_PJM_01_F3_lebih_satu_hasil_tampil_semua_tidak_pilih_otomatis", async () => {
    mockCariAnggota.mockResolvedValueOnce({
      data: [
        { kode: "AGT-000001", nama: "Siti A" },
        { kode: "AGT-000002", nama: "Siti B" },
      ],
      total: 25, // lebih dari yang ditampilkan
      halaman: 1,
      per_halaman: 20,
    });
    render(<AlurPeminjaman />);
    fireEvent.change(screen.getByLabelText("Kata kunci pencarian anggota"), {
      target: { value: "Siti" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await waitFor(() => expect(screen.getByText("Siti A")).toBeTruthy());
    expect(screen.getByText("Siti B")).toBeTruthy();
    expect(screen.getByText(/Perjelas kata kunci/)).toBeTruthy();
    // Tidak otomatis dipilih
    expect(mockIdentifikasiAnggota).not.toHaveBeenCalled();
  });

  it("test_FR_PJM_03_04_anggota_blokir_tidak_maju_ke_langkah_2", async () => {
    mockIdentifikasiAnggota.mockResolvedValueOnce(ANGGOTA_BLOKIR);
    render(<AlurPeminjaman />);
    await act(async () => pemindai.onHasil("AGT-000002"));
    await waitFor(() => expect(screen.getByText("Dewi")).toBeTruthy());
    // Label Pemindai tetap "Kode Anggota"
    expect(pemindai.label).toBe("Kode Anggota");
  });

  it("test_FR_PJM_03_04_blokir_tampil_alasan_backend", async () => {
    mockIdentifikasiAnggota.mockResolvedValueOnce(ANGGOTA_BLOKIR);
    render(<AlurPeminjaman />);
    await act(async () => pemindai.onHasil("AGT-000002"));
    await waitFor(() =>
      expect(
        screen.getByText("Anggota memiliki 1 tagihan belum lunas (total Rp10.000)."),
      ).toBeTruthy(),
    );
  });

  it("test_FR_PJM_05_scan_eksemplar_tambah_ke_keranjang", async () => {
    mockIdentifikasiAnggota.mockResolvedValueOnce(ANGGOTA_LAYAK);
    mockValidasiItem.mockResolvedValueOnce(ITEM_VALID);
    render(<AlurPeminjaman />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => expect(pemindai.label).toBe("Kode Eksemplar"));
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => expect(screen.getByText("Bumi Manusia")).toBeTruthy());
    expect(mockValidasiItem).toHaveBeenCalledWith(1, "EKS-000001", []);
  });

  it("test_FR_PJM_06_07_08_penolakan_validasi_tampil_pesan_backend", async () => {
    mockIdentifikasiAnggota.mockResolvedValueOnce(ANGGOTA_LAYAK);
    mockValidasiItem.mockRejectedValueOnce(
      new GalatApi(
        422,
        "PJM_ITEM_MELEBIHI_BATAS",
        "Batas 3 eksemplar telah tercapai.",
        "FR-PJM-08",
        {},
        false,
      ),
    );
    render(<AlurPeminjaman />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => expect(pemindai.label).toBe("Kode Eksemplar"));
    await act(async () => pemindai.onHasil("EKS-000004"));
    await waitFor(() => expect(screen.getByText("Batas 3 eksemplar telah tercapai.")).toBeTruthy());
  });

  it("test_FR_PJM_09_hapus_item_dari_keranjang", async () => {
    mockIdentifikasiAnggota.mockResolvedValueOnce(ANGGOTA_LAYAK);
    mockValidasiItem.mockResolvedValueOnce(ITEM_VALID);
    render(<AlurPeminjaman />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => expect(pemindai.label).toBe("Kode Eksemplar"));
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => expect(screen.getByText("Bumi Manusia")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Hapus Bumi Manusia"));
    await waitFor(() => expect(screen.queryByText("Bumi Manusia")).toBeNull());
  });

  it("test_FR_PJM_10_konfirmasi_ditolak_pesan_tampil_keranjang_tetap", async () => {
    mockIdentifikasiAnggota.mockResolvedValueOnce(ANGGOTA_LAYAK);
    mockValidasiItem.mockResolvedValueOnce(ITEM_VALID);
    mockKonfirmasiPeminjaman.mockRejectedValueOnce(
      new GalatApi(
        422,
        "PJM_EKSEMPLAR_TIDAK_TERSEDIA",
        "EKS-000001 tidak lagi Tersedia.",
        "FR-PJM-10",
        {},
        false,
      ),
    );
    render(<AlurPeminjaman />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => expect(pemindai.label).toBe("Kode Eksemplar"));
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => expect(screen.getByText("Bumi Manusia")).toBeTruthy());
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Peminjaman" })),
    );
    await waitFor(() => expect(screen.getByText("EKS-000001 tidak lagi Tersedia.")).toBeTruthy());
    // Keranjang tetap ada
    expect(screen.getByText("Bumi Manusia")).toBeTruthy();
  });

  it("test_FR_PJM_10_nonaktif_saat_permintaan_berjalan", async () => {
    mockIdentifikasiAnggota.mockResolvedValueOnce(ANGGOTA_LAYAK);
    mockValidasiItem.mockResolvedValueOnce(ITEM_VALID);
    let resolveKonfirmasi: (v: typeof TRANSAKSI) => void;
    const promise = new Promise<typeof TRANSAKSI>((res) => {
      resolveKonfirmasi = res;
    });
    mockKonfirmasiPeminjaman.mockReturnValueOnce(promise);

    render(<AlurPeminjaman />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => expect(pemindai.label).toBe("Kode Eksemplar"));
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => expect(screen.getByText("Bumi Manusia")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Peminjaman" }));
    // Selama permintaan berjalan, Pemindai nonaktif
    await waitFor(() => expect(pemindai.nonaktif).toBe(true));

    // Setelah selesai, sukses screen tampil (Pemindai unmount → tidak perlu cek nonaktif kembali)
    await act(async () => resolveKonfirmasi!(TRANSAKSI));
    await waitFor(() => expect(screen.getByText(/Peminjaman berhasil/)).toBeTruthy());
  });

  it("test_FR_PJM_11_FR_PJM_12_sukses_jatuh_tempo_dari_respons_bukan_klien", async () => {
    mockIdentifikasiAnggota.mockResolvedValueOnce(ANGGOTA_LAYAK);
    mockValidasiItem.mockResolvedValueOnce(ITEM_VALID);
    mockKonfirmasiPeminjaman.mockResolvedValueOnce(TRANSAKSI);
    render(<AlurPeminjaman />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => expect(pemindai.label).toBe("Kode Eksemplar"));
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Peminjaman" })),
    );
    // Jatuh tempo dari TransaksiKeluar.item[0].jatuh_tempo (FR-PJM-11), bukan +30 hari klien
    await waitFor(() => expect(screen.getByText(/Peminjaman berhasil/)).toBeTruthy());
    expect(screen.getByText("05/11/2026")).toBeTruthy(); // formatTanggal("2026-11-05")
  });

  it("test_FR_PJM_02_identitas_anggota_tampil_nama_kode_pinjaman_aktif", async () => {
    // FR-PJM-02: identitas anggota tampil setelah identifikasi.
    // Pakai ANGGOTA_BLOKIR agar Kartu tetap di layar (anggota layak langsung maju ke tahap buku).
    mockIdentifikasiAnggota.mockResolvedValueOnce(ANGGOTA_BLOKIR);
    render(<AlurPeminjaman />);
    await act(async () => pemindai.onHasil("AGT-000002"));
    await waitFor(() => screen.getByText("Dewi"));
    expect(screen.getByText("AGT-000002")).toBeTruthy();
    expect(screen.getByText("1 pinjaman aktif")).toBeTruthy();
  });

  it("test_FR_PJM_01_cari_anggota_galat_api_tampil_pesan_bukan_tidak_ditemukan", async () => {
    // Butir 4: cari gagal → tampilkan GalatApi.pesan; "Anggota tidak ditemukan." hanya bila sukses kosong
    mockCariAnggota.mockRejectedValueOnce(
      new GalatApi(500, "SISTEM", "Layanan tidak tersedia saat ini.", "", {}, true),
    );
    render(<AlurPeminjaman />);
    fireEvent.change(screen.getByLabelText("Kata kunci pencarian anggota"), {
      target: { value: "Siti" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await waitFor(() => expect(screen.getByText("Layanan tidak tersedia saat ini.")).toBeTruthy());
    // "Anggota tidak ditemukan." tidak tampil (hasilCari = null, bukan [])
    expect(screen.queryByText("Anggota tidak ditemukan.")).toBeNull();
  });

  it("test_Reset_disabled_selama_permintaan_berjalan", async () => {
    // Butir 1a: tombol Reset nonaktif selama sedangProses
    mockIdentifikasiAnggota.mockResolvedValueOnce(ANGGOTA_LAYAK);
    mockValidasiItem.mockResolvedValueOnce(ITEM_VALID);
    let resolveKonfirmasi: (v: typeof TRANSAKSI) => void;
    const promise = new Promise<typeof TRANSAKSI>((res) => {
      resolveKonfirmasi = res;
    });
    mockKonfirmasiPeminjaman.mockReturnValueOnce(promise);

    render(<AlurPeminjaman />);
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => expect(pemindai.label).toBe("Kode Eksemplar"));
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));

    // Sebelum konfirmasi: Reset aktif
    expect((screen.getByRole("button", { name: "Reset" }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Peminjaman" }));
    // Selama permintaan berjalan: Reset disabled
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Reset" }) as HTMLButtonElement).disabled).toBe(
        true,
      ),
    );

    await act(async () => resolveKonfirmasi!(TRANSAKSI));
    await waitFor(() => screen.getByText(/Peminjaman berhasil/));
  });

  it("test_NFR_USA_01_tiga_langkah_dari_scan_ke_sukses", async () => {
    // NFR-USA-01: scan anggota (1) → scan buku (2) → Konfirmasi (3) = ≤ 4 tindakan
    mockIdentifikasiAnggota.mockResolvedValueOnce(ANGGOTA_LAYAK);
    mockValidasiItem.mockResolvedValueOnce(ITEM_VALID);
    mockKonfirmasiPeminjaman.mockResolvedValueOnce(TRANSAKSI);
    render(<AlurPeminjaman />);
    // Tindakan 1: scan anggota
    await act(async () => pemindai.onHasil("AGT-000001"));
    await waitFor(() => expect(pemindai.label).toBe("Kode Eksemplar"));
    // Tindakan 2: scan buku
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    // Tindakan 3: konfirmasi
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Peminjaman" })),
    );
    await waitFor(() => expect(screen.getByText(/Peminjaman berhasil/)).toBeTruthy());
  });
});

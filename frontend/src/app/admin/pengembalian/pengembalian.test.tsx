// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GalatApi } from "@/lib/galat";

// Butir 7: hapus parameter tak terpakai di mock
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

const mockPratinjauKembali = vi.fn();
const mockKonfirmasiKembali = vi.fn();

vi.mock("@/lib/sirkulasi", () => ({
  pratinjauKembali: (...a: unknown[]) => mockPratinjauKembali(...a),
  konfirmasiKembali: (...a: unknown[]) => mockKonfirmasiKembali(...a),
}));

const { AlurPengembalian } = await import("./AlurPengembalian");

const PRATINJAU = {
  eksemplar: { kode: "EKS-000001", judul: "Bumi Manusia" },
  peminjam: { kode: "AGT-000001", nama: "Siti Aisyah" },
  tanggal_pinjam: "2026-09-01",
  jatuh_tempo: "2026-10-01",
  hari_terlambat: 5,
  denda: 10000,
};

const PRATINJAU_TEPAT_WAKTU = {
  ...PRATINJAU,
  hari_terlambat: 0,
  denda: 0,
};

const HASIL_KEMBALI_DENDA = {
  eksemplar: { kode: "EKS-000001", judul: "Bumi Manusia" },
  peminjam: { kode: "AGT-000001", nama: "Siti Aisyah" },
  tanggal_kembali: "2026-10-06",
  hari_terlambat: 5,
  tagihan: { id: 7, nominal: 10000 },
  transaksi_selesai: true,
};

const HASIL_KEMBALI_TANPA_DENDA = {
  eksemplar: { kode: "EKS-000001", judul: "Bumi Manusia" },
  peminjam: { kode: "AGT-000001", nama: "Siti Aisyah" },
  tanggal_kembali: "2026-10-06",
  hari_terlambat: 0,
  tagihan: null,
  transaksi_selesai: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  pemindai.onHasil = () => {};
  pemindai.label = "";
  pemindai.nonaktif = false;
});
afterEach(cleanup);

describe("AlurPengembalian (FR-KMB)", () => {
  it("test_FR_KMB_01_scan_eksemplar_memuat_pratinjau", async () => {
    mockPratinjauKembali.mockResolvedValueOnce(PRATINJAU);
    render(<AlurPengembalian />);
    expect(pemindai.label).toBe("Kode Eksemplar");
    await act(async () => pemindai.onHasil("EKS-000001"));
    expect(mockPratinjauKembali).toHaveBeenCalledWith("EKS-000001");
    await waitFor(() => expect(screen.getByText("Bumi Manusia")).toBeTruthy());
  });

  it("test_FR_KMB_02_pratinjau_tampil_peminjam_tgl_pinjam_jatuh_tempo_hari_terlambat", async () => {
    // FR-KMB-02: pratinjau menampilkan peminjam, tanggal pinjam, jatuh tempo, hari terlambat
    mockPratinjauKembali.mockResolvedValueOnce(PRATINJAU);
    render(<AlurPengembalian />);
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    expect(screen.getByText(/Siti Aisyah/)).toBeTruthy();
    expect(screen.getByText(/01\/09\/2026/)).toBeTruthy(); // tgl pinjam
    expect(screen.getByText(/01\/10\/2026/)).toBeTruthy(); // jatuh tempo
    expect(screen.getByText(/5 hari/)).toBeTruthy(); // hari terlambat
  });

  it("test_FR_KMB_03_scan_bukan_pinjaman_aktif_tampil_pesan_galat", async () => {
    mockPratinjauKembali.mockRejectedValueOnce(
      new GalatApi(
        422,
        "KMB_TIDAK_DIPINJAM",
        "Eksemplar tidak sedang dipinjam.",
        "FR-KMB-03",
        {},
        false,
      ),
    );
    render(<AlurPengembalian />);
    await act(async () => pemindai.onHasil("EKS-000099"));
    await waitFor(() => expect(screen.getByText("Eksemplar tidak sedang dipinjam.")).toBeTruthy());
  });

  it("test_FR_KMB_05_konfirmasi_pengembalian_sukses", async () => {
    mockPratinjauKembali.mockResolvedValueOnce(PRATINJAU);
    mockKonfirmasiKembali.mockResolvedValueOnce(HASIL_KEMBALI_DENDA);
    render(<AlurPengembalian />);
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Pengembalian" })),
    );
    await waitFor(() => expect(screen.getByText("Dikembalikan")).toBeTruthy());
    expect(mockKonfirmasiKembali).toHaveBeenCalledWith("EKS-000001");
  });

  it("test_FR_KMB_06_sukses_ada_tautan_tagihan", async () => {
    // FR-KMB-06: layar sukses menampilkan tautan ke /admin/tagihan/{id}
    mockPratinjauKembali.mockResolvedValueOnce(PRATINJAU);
    mockKonfirmasiKembali.mockResolvedValueOnce(HASIL_KEMBALI_DENDA);
    render(<AlurPengembalian />);
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Pengembalian" })),
    );
    await waitFor(() => screen.getByText("Dikembalikan"));
    const tautan = screen.getByRole("link", { name: /Lihat tagihan #7/ });
    expect(tautan.getAttribute("href")).toBe("/admin/tagihan/7");
  });

  it("test_FR_KMB_04_denda_ditampilkan_bila_ada", async () => {
    // butir 9: test_FR_KMB_07_denda_* → FR_KMB_04
    mockPratinjauKembali.mockResolvedValueOnce(PRATINJAU);
    mockKonfirmasiKembali.mockResolvedValueOnce(HASIL_KEMBALI_DENDA);
    render(<AlurPengembalian />);
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    // Estimasi denda di pratinjau
    expect(screen.getByText(/Estimasi denda/)).toBeTruthy();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Pengembalian" })),
    );
    // Denda final dari tagihan.nominal di respons API
    await waitFor(() => expect(screen.getByText("Rp10.000")).toBeTruthy());
  });

  it("test_FR_KMB_06_tanpa_denda_tidak_tampil_baris_denda", async () => {
    // butir 9: test_FR_KMB_07_tanpa_denda_* → FR_KMB_06
    mockPratinjauKembali.mockResolvedValueOnce(PRATINJAU_TEPAT_WAKTU);
    mockKonfirmasiKembali.mockResolvedValueOnce(HASIL_KEMBALI_TANPA_DENDA);
    render(<AlurPengembalian />);
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    expect(screen.queryByText(/Estimasi denda/)).toBeNull();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Pengembalian" })),
    );
    await waitFor(() => expect(screen.getByText("Dikembalikan")).toBeTruthy());
    expect(screen.queryByText(/Denda final/)).toBeNull();
  });

  it("test_FR_KMB_08_transaksi_selesai_satu_baris_teks", async () => {
    mockPratinjauKembali.mockResolvedValueOnce(PRATINJAU);
    mockKonfirmasiKembali.mockResolvedValueOnce(HASIL_KEMBALI_DENDA);
    render(<AlurPengembalian />);
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Pengembalian" })),
    );
    await waitFor(() => expect(screen.getByText("Transaksi selesai")).toBeTruthy());
  });

  it("test_FR_KMB_07_transaksi_selesai_false_tidak_tampil", async () => {
    // butir 8: transaksi_selesai=false → teks "Transaksi selesai" tidak tampil
    const hasilTanpaSelesai = { ...HASIL_KEMBALI_DENDA, transaksi_selesai: false };
    mockPratinjauKembali.mockResolvedValueOnce(PRATINJAU);
    mockKonfirmasiKembali.mockResolvedValueOnce(hasilTanpaSelesai);
    render(<AlurPengembalian />);
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Pengembalian" })),
    );
    await waitFor(() => screen.getByText("Dikembalikan"));
    expect(screen.queryByText("Transaksi selesai")).toBeNull();
  });

  it("test_nonaktif_saat_konfirmasi_berjalan", async () => {
    mockPratinjauKembali.mockResolvedValueOnce(PRATINJAU);
    let resolveKonfirmasi: (v: typeof HASIL_KEMBALI_DENDA) => void;
    const promise = new Promise<typeof HASIL_KEMBALI_DENDA>((res) => {
      resolveKonfirmasi = res;
    });
    mockKonfirmasiKembali.mockReturnValueOnce(promise);

    render(<AlurPengembalian />);
    await act(async () => pemindai.onHasil("EKS-000001"));
    await waitFor(() => screen.getByText("Bumi Manusia"));

    fireEvent.click(screen.getByRole("button", { name: "Konfirmasi Pengembalian" }));
    // Tombol konfirmasi disabled selama proses
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Konfirmasi Pengembalian" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true),
    );

    await act(async () => resolveKonfirmasi!(HASIL_KEMBALI_DENDA));
    await waitFor(() => expect(screen.getByText("Dikembalikan")).toBeTruthy());
  });
});

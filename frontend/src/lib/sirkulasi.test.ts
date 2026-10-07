/**
 * WP 5.4.6: Uji pembungkus API sirkulasi (FR-PJM-01/02, FR-KMB-01/03, FR-HLR-01/03).
 * Logika non-UI ditulis test dulu sebelum implementasi (butir 8).
 */
import { describe, expect, it, vi } from "vitest";

import { GalatApi } from "./galat";

const ambil = vi.fn();
vi.mock("./api-klien", () => ({ ambil }));

const {
  cariAnggota,
  catatHilangRusak,
  daftarItemAnggota,
  identifikasiAnggota,
  konfirmasiKembali,
  konfirmasiPeminjaman,
  pratinjauKembali,
  validasiItem,
} = await import("./sirkulasi");

const ANGGOTA = {
  id: 1,
  kode: "AGT-000001",
  nama: "Siti Aisyah",
  pinjaman_aktif: 0,
  layak: true,
  alasan: [],
};

describe("identifikasiAnggota (FR-PJM-01)", () => {
  it("test_FR_PJM_01_identifikasi_anggota_sukses", async () => {
    ambil.mockResolvedValueOnce(ANGGOTA);
    const hasil = await identifikasiAnggota("AGT-000001");
    expect(ambil).toHaveBeenCalledWith("/admin/peminjaman/anggota/AGT-000001");
    expect(hasil.kode).toBe("AGT-000001");
    expect(hasil.layak).toBe(true);
  });

  it("test_galat_api_diteruskan_apa_adanya", async () => {
    ambil.mockRejectedValueOnce(
      new GalatApi(
        422,
        "PJM_ANGGOTA_TIDAK_DITEMUKAN",
        "Anggota tidak ditemukan.",
        "FR-PJM-01",
        {},
        false,
      ),
    );
    await expect(identifikasiAnggota("XXX")).rejects.toBeInstanceOf(GalatApi);
  });
});

describe("cariAnggota (FR-PJM-01)", () => {
  it("test_FR_PJM_01_cari_anggota_sukses", async () => {
    const halaman = {
      data: [{ kode: "AGT-000001", nama: "Siti" }],
      total: 1,
      halaman: 1,
      per_halaman: 20,
    };
    ambil.mockResolvedValueOnce(halaman);
    const hasil = await cariAnggota("Siti");
    expect(ambil).toHaveBeenCalledWith("/admin/anggota?q=Siti&per_halaman=20");
    expect(hasil.data).toHaveLength(1);
  });
});

describe("validasiItem (FR-PJM-02)", () => {
  it("test_FR_PJM_02_validasi_item_sukses", async () => {
    const itemValid = { eksemplar_id: 1, kode: "EKS-000001", judul: "Bumi Manusia" };
    ambil.mockResolvedValueOnce(itemValid);
    const hasil = await validasiItem(1, "EKS-000001", []);
    expect(ambil).toHaveBeenCalledWith("/admin/peminjaman/validasi-item", {
      method: "POST",
      json: { anggota_id: 1, kode_eksemplar: "EKS-000001", keranjang: [] },
    });
    expect(hasil.kode).toBe("EKS-000001");
  });
});

describe("konfirmasiPeminjaman (FR-PJM-10/12)", () => {
  it("test_FR_PJM_10_konfirmasi_peminjaman_sukses", async () => {
    const transaksi = {
      id: 10,
      anggota: { kode: "AGT-000001", nama: "Siti" },
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
    ambil.mockResolvedValueOnce(transaksi);
    const hasil = await konfirmasiPeminjaman(1, ["EKS-000001"]);
    expect(ambil).toHaveBeenCalledWith("/admin/peminjaman", {
      method: "POST",
      json: { anggota_id: 1, kode_eksemplar: ["EKS-000001"] },
    });
    expect(hasil.item[0].jatuh_tempo).toBe("2026-11-05");
  });
});

describe("pratinjauKembali (FR-KMB-01)", () => {
  it("test_FR_KMB_01_pratinjau_kembali_sukses", async () => {
    const pratinjau = {
      eksemplar: { kode: "EKS-000001", judul: "Bumi Manusia" },
      peminjam: { kode: "AGT-000001", nama: "Siti" },
      tanggal_pinjam: "2026-09-01",
      jatuh_tempo: "2026-10-01",
      hari_terlambat: 5,
      denda: 10000,
    };
    ambil.mockResolvedValueOnce(pratinjau);
    const hasil = await pratinjauKembali("EKS-000001");
    expect(ambil).toHaveBeenCalledWith("/admin/pengembalian/EKS-000001");
    expect(hasil.hari_terlambat).toBe(5);
  });

  it("test_FR_KMB_03_eksemplar_tidak_dipinjam_404", async () => {
    ambil.mockRejectedValueOnce(
      new GalatApi(
        404,
        "KMB_TIDAK_DIPINJAM",
        "Eksemplar tidak sedang dipinjam.",
        "FR-KMB-03",
        {},
        false,
      ),
    );
    await expect(pratinjauKembali("EKS-000001")).rejects.toBeInstanceOf(GalatApi);
  });
});

describe("konfirmasiKembali (FR-KMB-05)", () => {
  it("test_FR_KMB_05_konfirmasi_kembali_sukses", async () => {
    const kembali = {
      eksemplar: { kode: "EKS-000001", judul: "Bumi Manusia" },
      peminjam: { kode: "AGT-000001", nama: "Siti" },
      tanggal_kembali: "2026-10-06",
      hari_terlambat: 5,
      tagihan: { id: 3, nominal: 10000 },
      transaksi_selesai: true,
    };
    ambil.mockResolvedValueOnce(kembali);
    const hasil = await konfirmasiKembali("EKS-000001");
    expect(ambil).toHaveBeenCalledWith("/admin/pengembalian", {
      method: "POST",
      json: { kode_eksemplar: "EKS-000001" },
    });
    expect(hasil.transaksi_selesai).toBe(true);
  });
});

describe("daftarItemAnggota (FR-HLR-01)", () => {
  it("test_FR_HLR_01_daftar_item_anggota_sukses", async () => {
    const daftar = {
      anggota: { kode: "AGT-000001", nama: "Siti" },
      item: [
        {
          item_id: 1,
          kode_eksemplar: "EKS-000001",
          judul: "Bumi Manusia",
          tanggal_pinjam: "2026-09-01",
          jatuh_tempo: "2026-10-01",
          hari_terlambat: 5,
        },
      ],
    };
    ambil.mockResolvedValueOnce(daftar);
    const hasil = await daftarItemAnggota("AGT-000001");
    expect(ambil).toHaveBeenCalledWith("/admin/hilang-rusak/anggota/AGT-000001");
    expect(hasil.item).toHaveLength(1);
  });
});

describe("catatHilangRusak (FR-HLR-03)", () => {
  it("test_FR_HLR_03_catat_hilang_rusak_sukses", async () => {
    const pencatatan = {
      item_id: 1,
      kode_eksemplar: "EKS-000001",
      judul: "Bumi Manusia",
      anggota: { kode: "AGT-000001", nama: "Siti" },
      status: "HILANG",
      tanggal_kejadian: "2026-10-06",
      keterangan: "Dilaporkan hilang.",
      tagihan: { id: 5, nominal: 150000 },
      transaksi_selesai: false,
    };
    ambil.mockResolvedValueOnce(pencatatan);
    const hasil = await catatHilangRusak(1, "HILANG", "2026-10-06", "Dilaporkan hilang.");
    expect(ambil).toHaveBeenCalledWith("/admin/hilang-rusak", {
      method: "POST",
      json: {
        item_id: 1,
        jenis: "HILANG",
        tanggal_kejadian: "2026-10-06",
        keterangan: "Dilaporkan hilang.",
      },
    });
    expect(hasil.tagihan.nominal).toBe(150000);
  });
});

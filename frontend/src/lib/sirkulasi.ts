/**
 * Pembungkus API sirkulasi admin (WP 5.4.6): peminjaman (FR-PJM), pengembalian (FR-KMB), hilang/rusak (FR-HLR).
 * Tidak memuat aturan bisnis — semua keputusan ada di backend. Galat GalatApi diteruskan apa adanya.
 */
import { ambil } from "./api-klien";
import type { components } from "./api-skema";

export type IdentitasAnggotaKeluar = components["schemas"]["IdentitasAnggotaKeluar"];
export type ItemValidKeluar = components["schemas"]["ItemValidKeluar"];
export type TransaksiKeluar = components["schemas"]["TransaksiKeluar"];
export type PratinjauKeluar = components["schemas"]["PratinjauKeluar"];
export type PengembalianKeluar = components["schemas"]["PengembalianKeluar"];
export type DaftarItemKeluar = components["schemas"]["DaftarItemKeluar"];
export type PencatatanKeluar = components["schemas"]["PencatatanKeluar"];
export type HalamanAnggota = components["schemas"]["HalamanAnggota"];
export type ProfilKeluar = components["schemas"]["ProfilKeluar"];
export type ItemAktifKeluar = components["schemas"]["ItemAktifKeluar"];
export type JenisHilangRusak = "HILANG" | "RUSAK";

/** FR-PJM-01: identifikasi anggota dari kode (dari QR atau diketik). */
export function identifikasiAnggota(kode: string): Promise<IdentitasAnggotaKeluar> {
  return ambil(`/admin/peminjaman/anggota/${encodeURIComponent(kode)}`);
}

/** FR-PJM-01: cari anggota berdasarkan ID/NIK/nama. Hanya halaman pertama (per_halaman=20, OQ-33). */
export function cariAnggota(q: string): Promise<HalamanAnggota> {
  const params = new URLSearchParams({ q, per_halaman: "20" });
  return ambil(`/admin/anggota?${params.toString()}`);
}

/** FR-PJM-05..08: periksa satu pindaian terhadap keranjang. Tidak mengubah data. */
export function validasiItem(
  anggotaId: number,
  kodeEksemplar: string,
  keranjang: string[],
): Promise<ItemValidKeluar> {
  return ambil("/admin/peminjaman/validasi-item", {
    method: "POST",
    json: { anggota_id: anggotaId, kode_eksemplar: kodeEksemplar, keranjang },
  });
}

/** FR-PJM-10..12: konfirmasi peminjaman. Periksa ulang + simpan transaksi. */
export function konfirmasiPeminjaman(
  anggotaId: number,
  kodeEksemplar: string[],
): Promise<TransaksiKeluar> {
  return ambil("/admin/peminjaman", {
    method: "POST",
    json: { anggota_id: anggotaId, kode_eksemplar: kodeEksemplar },
  });
}

/** FR-KMB-01..04: pratinjau pengembalian. Nominal final dihitung ulang saat konfirmasi (OQ-25). */
export function pratinjauKembali(kodeEksemplar: string): Promise<PratinjauKeluar> {
  return ambil(`/admin/pengembalian/${encodeURIComponent(kodeEksemplar)}`);
}

/** FR-KMB-05..08: konfirmasi pengembalian. Tanggal kembali = hari ini WIB (OQ-25). */
export function konfirmasiKembali(kodeEksemplar: string): Promise<PengembalianKeluar> {
  return ambil("/admin/pengembalian", {
    method: "POST",
    json: { kode_eksemplar: kodeEksemplar },
  });
}

/** FR-HLR-01: daftar item Dipinjam milik anggota (kode dari QR atau diketik). */
export function daftarItemAnggota(kode: string): Promise<DaftarItemKeluar> {
  return ambil(`/admin/hilang-rusak/anggota/${encodeURIComponent(kode)}`);
}

/** FR-HLR-03/04: catat hilang/rusak + tagihan Penggantian; tidak ada denda (BR-15). */
export function catatHilangRusak(
  itemId: number,
  jenis: JenisHilangRusak,
  tanggalKejadian: string,
  keterangan: string,
): Promise<PencatatanKeluar> {
  return ambil("/admin/hilang-rusak", {
    method: "POST",
    json: { item_id: itemId, jenis, tanggal_kejadian: tanggalKejadian, keterangan },
  });
}

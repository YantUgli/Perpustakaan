/**
 * Format tampilan terpusat (NFR-USA-02): tanggal DD/MM/YYYY, uang `Rp10.000`.
 * Harus sama dengan backend/app/core/format.py.
 */

const POLA_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `"2026-10-05"` → `"05/10/2026"`. Tanggal bisnis dari API berbentuk DATE (WIB, K-07); diurai sebagai teks,
 * bukan lewat `new Date()`, agar tidak bergeser hari karena zona waktu peramban.
 */
export function formatTanggal(iso: string): string {
  const m = POLA_TANGGAL.exec(iso);
  if (!m) throw new Error(`Tanggal harus berbentuk YYYY-MM-DD, diterima: ${JSON.stringify(iso)}`);
  const [, tahun, bulan, hari] = m;
  return `${hari}/${bulan}/${tahun}`;
}

/** `35555` → `"Rp35.555"`: tanpa spasi, titik pemisah ribuan. Uang selalu int Rupiah tidak negatif. */
export function formatRupiah(nominal: number): string {
  if (!Number.isSafeInteger(nominal) || nominal < 0) {
    throw new Error(`Nominal harus int Rupiah tidak negatif, diterima: ${nominal}`);
  }
  return `Rp${String(nominal).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

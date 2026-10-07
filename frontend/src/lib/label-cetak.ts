/**
 * Tata letak cetak label QR eksemplar (FR-BKU-06, IR-HW-02). Keputusan pemilik proyek (2026-10-05):
 * A4 potret, 3 kolom × 7 baris = 21 label per halaman, 63,5 × 38,1 mm, QR 24 mm (termasuk quiet zone).
 * Ukuran fisik dipaksa lewat CSS cetak (mm), bukan piksel; buktinya cek manual (cetak, ukur, pindai).
 */

export const UKURAN_LABEL = {
  kolom: 3,
  baris: 7,
  lebarMm: 63.5,
  tinggiMm: 38.1,
  qrMm: 24,
  /** Celah antarkolom (standar kertas label 21-up 63,5 × 38,1 mm). */
  celahKolomMm: 2.54,
  /** Margin lembar: atas dan kiri. */
  margin: { atasMm: 15.15, kiriMm: 7.21 },
} as const;

export const LABEL_PER_HALAMAN = UKURAN_LABEL.kolom * UKURAN_LABEL.baris;

const POLA_ID = /^[1-9][0-9]*$/;

/** `?id=` (berulang) → id eksemplar bulat positif, urutan asli, tanpa duplikat. Jumlah dibatasi backend. */
export function idLabelDariParam(p: Record<string, string | string[] | undefined>): number[] {
  const mentah = Array.isArray(p.id) ? p.id : p.id === undefined ? [] : [p.id];
  const hasil: number[] = [];
  for (const m of mentah) {
    if (!POLA_ID.test(m)) continue;
    const n = Number(m);
    if (Number.isSafeInteger(n) && !hasil.includes(n)) hasil.push(n);
  }
  return hasil;
}

export function queryLabel(ids: number[]): string {
  return ids.map((id) => `id=${id}`).join("&");
}

/** Halaman cetak untuk id eksemplar tertentu (data dari `GET /admin/eksemplar/label`). */
export function urlLabel(ids: number[]): string {
  return `/admin/eksemplar/label?${queryLabel(ids)}`;
}

export function bagiHalaman<T>(item: T[], perHalaman: number): T[][] {
  const halaman: T[][] = [];
  for (let i = 0; i < item.length; i += perHalaman) halaman.push(item.slice(i, i + perHalaman));
  return halaman;
}

/**
 * CSS cetak label. `@page` A4 dengan margin 0 (margin lembar dipegang `.lembar-label`); satu lembar tepat
 * 210 × 297 mm agar tidak meluap ke halaman berikutnya. `.label-qr` memaksa ukuran QR dalam mm
 * (menimpa atribut width/height SVG).
 */
export function cssLabel(): string {
  const { lebarMm, tinggiMm, qrMm, celahKolomMm, kolom, margin } = UKURAN_LABEL;
  return `
@page { size: A4 portrait; margin: 0; }
.lembar-label {
  box-sizing: border-box;
  width: 210mm;
  height: 297mm;
  padding: ${margin.atasMm}mm 0 0 ${margin.kiriMm}mm;
  display: grid;
  grid-template-columns: repeat(${kolom}, ${lebarMm}mm);
  grid-auto-rows: ${tinggiMm}mm;
  column-gap: ${celahKolomMm}mm;
  align-content: start;
  background: #fff;
  color: #000;
  break-after: page;
  break-inside: avoid;
}
.lembar-label:last-child { break-after: auto; }
.label-item {
  box-sizing: border-box;
  width: ${lebarMm}mm;
  height: ${tinggiMm}mm;
  padding: 3mm;
  display: flex;
  align-items: center;
  gap: 3mm;
  overflow: hidden;
  border: 0.2mm dashed #888;
}
.label-qr { width: ${qrMm}mm !important; height: ${qrMm}mm !important; flex: none; }
.label-teks { min-width: 0; display: flex; flex-direction: column; gap: 1mm; }
.label-kode { font: 700 9pt/1.1 monospace; letter-spacing: 0.02em; }
.label-judul { font: 400 7.5pt/1.2 sans-serif; overflow-wrap: anywhere; }
@media print {
  html, body { margin: 0; padding: 0; background: #fff; }
}
`;
}

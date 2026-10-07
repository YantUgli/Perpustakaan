"use client";

import { QRCodeSVG } from "qrcode.react";

// Sengaja hex tetap, bukan token tema: kontras maksimum agar mudah dipindai kamera (FR-AGT-01) dan dicetak
// dengan printer biasa (IR-HW-02, label 5.4.7).
const HITAM = "#000000";
const PUTIH = "#FFFFFF";

type Props = {
  /** Isi QR apa adanya dari API (`isi_qr`), mis. kode anggota/eksemplar (IR-SW-02). */
  isi: string;
  /** Sisi QR dalam px, termasuk quiet zone. */
  ukuran?: number;
  /** Nama aksesibel, mis. "QR anggota AGT-000123". */
  judul: string;
  className?: string;
};

/**
 * QR code SVG (decisions §B "QR generate": qrcode.react). Koreksi galat M, quiet zone 4 modul (standar QR),
 * hitam di atas putih. Lebar mengikuti `ukuran` tetapi tidak melebihi wadah (`max-w-full`).
 */
export function KodeQr({ isi, ukuran = 256, judul, className = "" }: Props) {
  return (
    <QRCodeSVG
      value={isi}
      size={ukuran}
      level="M"
      marginSize={4}
      fgColor={HITAM}
      bgColor={PUTIH}
      title={judul}
      role="img"
      aria-label={judul}
      data-isi-qr={isi}
      className={`h-auto max-w-full ${className}`}
    />
  );
}

import { BrowserQRCodeReader } from "@zxing/browser";

/**
 * Adaptor tunggal library pemindai (decisions §B "QR scan (frontend)"): satu-satunya berkas yang meng-import
 * `@zxing/browser`. Dimuat dinamis oleh `Pemindai` agar library tidak ikut render server/bundle halaman lain.
 */

export type KendaliPindai = { hentikan: () => void };

/** IR-HW-01: kamera belakang; `ideal` (bukan `exact`) agar webcam desktop tetap dapat dipakai (NFR-CMP-01). */
export const BATASAN_KAMERA: MediaStreamConstraints = {
  video: { facingMode: { ideal: "environment" } },
  audio: false,
};

/**
 * Menyalakan kamera ke `video` dan memanggil `onTeks` dengan teks QR apa adanya setiap kali terbaca.
 * Galat `getUserMedia` (izin ditolak, kamera tak ada, …) dilempar apa adanya untuk dipetakan `pesanGalatKamera`.
 */
export async function mulaiPindai(
  video: HTMLVideoElement,
  onTeks: (teks: string) => void,
): Promise<KendaliPindai> {
  const pembaca = new BrowserQRCodeReader();
  const kendali = await pembaca.decodeFromConstraints(BATASAN_KAMERA, video, (hasil) => {
    if (hasil) onTeks(hasil.getText());
  });
  return { hentikan: () => kendali.stop() };
}

/**
 * Logika murni komponen pemindai QR (WP 5.4.5): pesan galat kamera dan penyaring pindai ganda.
 * Tanpa aturan bisnis: kode tidak dinormalisasi di sini (normalisasi & FR-PJM-07 tetap di backend).
 */

/** Pesan kegagalan kamera (IR-UI-04). Setiap pesan mengarahkan ke input manual yang selalu tersedia (IR-HW-01). */
export const PESAN_KAMERA = {
  izinDitolak:
    "Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, atau ketik kode di bawah.",
  tidakDitemukan: "Kamera tidak ditemukan di perangkat ini. Ketik kode di bawah.",
  sedangDipakai:
    "Kamera sedang dipakai aplikasi lain atau tidak dapat dibuka. Tutup aplikasi lain yang memakai kamera lalu tekan Coba lagi, atau ketik kode di bawah.",
  tanpaHttps: "Kamera hanya dapat dipakai melalui koneksi HTTPS. Ketik kode di bawah.",
  gagal: "Kamera gagal dijalankan. Tekan Coba lagi, atau ketik kode di bawah.",
} as const;

const PESAN_PER_NAMA: Record<string, string> = {
  NotAllowedError: PESAN_KAMERA.izinDitolak,
  SecurityError: PESAN_KAMERA.izinDitolak,
  NotFoundError: PESAN_KAMERA.tidakDitemukan,
  OverconstrainedError: PESAN_KAMERA.tidakDitemukan,
  NotReadableError: PESAN_KAMERA.sedangDipakai,
  AbortError: PESAN_KAMERA.sedangDipakai,
};

/** Memetakan galat `getUserMedia` (`DOMException.name`) ke pesan Indonesia yang spesifik (IR-UI-04). */
export function pesanGalatKamera(galat: unknown): string {
  const nama =
    typeof galat === "object" && galat !== null && "name" in galat ? String(galat.name) : "";
  return PESAN_PER_NAMA[nama] ?? PESAN_KAMERA.gagal;
}

/** Kamera browser hanya tersedia di secure context (HTTPS/localhost) dan bila `getUserMedia` ada (IR-HW-01). */
export function kameraDidukung(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext === true &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/** Jeda pindai ganda (decisions §B "Jeda pindai ganda"): 3 dtk sejak pembacaan terakhir kode yang sama. */
export const JEDA_PINDAI_GANDA_MS = 3000;

export type SaringPindai = (
  teks: string,
  sekarangMs: number,
  opsi?: { nonaktif?: boolean },
) => boolean;

/**
 * Penyaring pembacaan kamera beruntun. Mengembalikan `true` bila bacaan boleh diteruskan.
 * - Kode sama < `jedaMs` sejak bacaan terakhirnya diabaikan; setiap bacaan memperpanjang jeda (bergeser).
 * - Kode berbeda langsung lolos.
 * - `nonaktif`: bacaan dibuang; kode yang SAMA tetap memperpanjang jeda, kode BERBEDA tidak dicatat.
 * Jeda teknis ini tidak menggantikan penolakan eksemplar ganda FR-PJM-07 dari backend.
 */
export function buatPenyaringGanda(jedaMs: number = JEDA_PINDAI_GANDA_MS): SaringPindai {
  let terakhir: { teks: string; waktu: number } | null = null;

  return (teks, sekarangMs, opsi) => {
    const sama = terakhir !== null && terakhir.teks === teks;
    const dalamJeda = sama && sekarangMs - terakhir!.waktu < jedaMs;

    if (opsi?.nonaktif) {
      if (sama) terakhir = { teks, waktu: sekarangMs };
      return false;
    }
    terakhir = { teks, waktu: sekarangMs };
    return !dalamJeda;
  };
}

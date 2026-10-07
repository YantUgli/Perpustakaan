/**
 * Galat dari API (decisions.md §B "Format error"): `{"detail": {"kode", "pesan", "rujukan", "isian"?}}`.
 * `pesan` backend sudah spesifik dan berbahasa Indonesia (IR-UI-04) → ditampilkan apa adanya.
 * Pesan umum hanya untuk kegagalan sistem (respons tanpa bentuk galat, mis. 5xx dari proxy) dan jaringan.
 */

export const PESAN_SISTEM = "Terjadi kesalahan pada sistem. Coba lagi beberapa saat lagi.";
export const PESAN_JARINGAN =
  "Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.";

export class GalatApi extends Error {
  constructor(
    readonly status: number,
    readonly kode: string,
    readonly pesan: string,
    readonly rujukan: string | null,
    /** Pesan per isian form (`nama_isian → pesan`); kosong bila galat tidak menyangkut isian. */
    readonly isian: Record<string, string>,
    /** `true` bila bukan penolakan bisnis dari backend (sistem/jaringan). */
    readonly sistem: boolean,
  ) {
    super(pesan);
    this.name = "GalatApi";
  }
}

function isRecordTeks(nilai: unknown): nilai is Record<string, string> {
  return (
    typeof nilai === "object" &&
    nilai !== null &&
    !Array.isArray(nilai) &&
    Object.values(nilai).every((v) => typeof v === "string")
  );
}

export async function bacaGalat(res: Response): Promise<GalatApi> {
  let isi: unknown;
  try {
    isi = await res.json();
  } catch {
    isi = null;
  }
  const detail = (isi as { detail?: unknown } | null)?.detail;
  if (typeof detail === "object" && detail !== null) {
    const { kode, pesan, rujukan, isian } = detail as Record<string, unknown>;
    if (typeof kode === "string" && typeof pesan === "string") {
      return new GalatApi(
        res.status,
        kode,
        pesan,
        typeof rujukan === "string" ? rujukan : null,
        isRecordTeks(isian) ? isian : {},
        false,
      );
    }
  }
  return new GalatApi(res.status, "SISTEM", PESAN_SISTEM, null, {}, true);
}

/** Jaringan gagal (fetch melempar). Galat asli disimpan di `cause` untuk diagnosis, tidak ditampilkan. */
export function galatJaringan(sebab: unknown): GalatApi {
  const galat = new GalatApi(0, "JARINGAN", PESAN_JARINGAN, null, {}, true);
  galat.cause = sebab;
  return galat;
}

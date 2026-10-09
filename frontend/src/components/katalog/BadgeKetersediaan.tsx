import { Ikon } from "@/components/ui/Ikon";
import { type JudulKatalog, teksKetersediaan } from "@/lib/katalog";

type Props = {
  judul: Pick<JudulKatalog, "tersedia" | "total">;
  /** Kartu beranda: "X dari Y tersedia"; teks lengkap tetap di `title`. */
  ringkas?: boolean;
  /** Detail buku (hal-05, keputusan 09/10/2026): kotak lebar, teks besar, ikon rak sebagai ganti titik. */
  besar?: boolean;
};

/**
 * FR-KTL-03: "X dari Y eksemplar tersedia" dari `tersedia`/`total` API (OQ-23: "0 dari 0" tetap tampil).
 * Keputusan 2026-10-06 (menggantikan "satu gaya gold-700"): hijau nada status Tersedia (5,33, AA) bila
 * `tersedia > 0` seperti hal-02; bila 0, teks gold-700 di latar putih. Warna hanya penanda tambahan, teks X/Y
 * selalu tampil. Varian `besar` memakai warna yang sama; tanpa pil "Tersedia" (label judul tak ada di SRS).
 */
export function BadgeKetersediaan({ judul, ringkas = false, besar = false }: Props) {
  const ada = judul.tersedia > 0;
  const warna = ada
    ? "border-status-tersedia/30 bg-status-tersedia-bg text-status-tersedia"
    : "border-gold-700/30 bg-surface text-gold-700";
  const bentuk = besar
    ? "flex gap-3 rounded-xl px-5 py-4 text-lg"
    : "inline-flex gap-1.5 rounded-full px-2.5 py-0.5 text-xs";
  return (
    <span
      data-tersedia={ada ? "ya" : "tidak"}
      title={ringkas ? teksKetersediaan(judul) : undefined}
      className={`angka items-center border font-semibold ${bentuk} ${warna}`}
    >
      {besar ? (
        <Ikon nama="rakIsi" className="size-6 shrink-0" />
      ) : (
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${ada ? "bg-status-tersedia" : "bg-gold"}`}
        />
      )}
      {teksKetersediaan(judul, ringkas)}
    </span>
  );
}

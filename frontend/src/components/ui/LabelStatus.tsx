import { type NadaStatus, labelStatus } from "@/lib/label";

// Kelas ditulis utuh agar terbaca Tailwind. Border = warna teks ~30% (design-system §2).
const KELAS_NADA: Record<NadaStatus, string> = {
  tersedia: "bg-status-tersedia-bg text-status-tersedia border-status-tersedia/30",
  dipinjam: "bg-status-dipinjam-bg text-status-dipinjam border-status-dipinjam/30",
  dikembalikan: "bg-status-dikembalikan-bg text-status-dikembalikan border-status-dikembalikan/30",
  terlambat: "bg-status-terlambat-bg text-status-terlambat border-status-terlambat/30",
  hilang: "bg-status-hilang-bg text-status-hilang border-status-hilang/30",
  rusak: "bg-status-rusak-bg text-status-rusak border-status-rusak/30",
};

type Props = {
  /** Kode status dari API: `TERSEDIA`, `DIPINJAM`, `DIKEMBALIKAN`, `HILANG`, `RUSAK`, `BELUM_LUNAS`, `LUNAS`. */
  status: string;
  /** Field `terlambat` dari API; hanya bermakna untuk item `DIPINJAM` (FR-DND-05). */
  terlambat?: boolean;
  className?: string;
};

/** Satu-satunya komponen label status (IR-UI-03). Selalu berupa teks, tidak mengandalkan warna saja. */
export function LabelStatus({ status, terlambat = false, className = "" }: Props) {
  const { label, nada } = labelStatus(status, terlambat);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${KELAS_NADA[nada]} ${className}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

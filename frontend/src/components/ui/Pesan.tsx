import type { ReactNode } from "react";

export type JenisPesan = "info" | "sukses" | "peringatan" | "galat";

const KELAS: Record<JenisPesan, string> = {
  info: "bg-status-dipinjam-bg text-status-dipinjam border-status-dipinjam/30",
  sukses: "bg-status-tersedia-bg text-status-tersedia border-status-tersedia/30",
  peringatan: "bg-status-terlambat-bg text-status-terlambat border-status-terlambat/30",
  galat: "bg-status-hilang-bg text-status-hilang border-status-hilang/30",
};

type Props = { jenis?: JenisPesan; judul?: string; children: ReactNode; className?: string };

/**
 * Kotak pesan sebaris. Untuk penolakan, `children` = `pesan` backend apa adanya (IR-UI-04), ditampilkan penuh.
 * Galat & peringatan diumumkan pembaca layar (`role="alert"`).
 */
export function Pesan({ jenis = "info", judul, children, className = "" }: Props) {
  return (
    <div
      role={jenis === "galat" || jenis === "peringatan" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm ${KELAS[jenis]} ${className}`}
    >
      {judul && <p className="mb-0.5 font-semibold">{judul}</p>}
      <div>{children}</div>
    </div>
  );
}

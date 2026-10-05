import type { ReactNode } from "react";

type Props = { judul: string; keterangan?: string; aksi?: ReactNode };

/** Ditampilkan saat daftar tidak berisi data (hal-29 "Empty State"). */
export function KosongState({ judul, keterangan, aksi }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-display text-lg text-navy">{judul}</p>
      {keterangan && <p className="max-w-md text-sm text-navy/70">{keterangan}</p>}
      {aksi && <div className="mt-2">{aksi}</div>}
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

import { Ikon, type NamaIkon } from "@/components/ui/Ikon";

/** Nada lingkaran ikon (hal-09), dari token status/gold; ikon dekoratif. */
const NADA = {
  biru: "bg-status-dipinjam-bg text-navy",
  gold: "bg-gold/15 text-gold-700",
  merah: "bg-status-hilang-bg text-status-hilang",
  abu: "bg-status-dikembalikan-bg text-navy",
} as const;

type Props = {
  /** Dengan `href`: seluruh kartu satu tautan + panah (dashboard). Tanpa `href`: `div` tanpa panah (Pinjaman Saya). */
  href?: string;
  label: string;
  ikon: NamaIkon;
  nada: keyof typeof NADA;
  /** Angka besar atau teks pendek (mis. "Terlambat 4 hari"). */
  nilai: ReactNode;
  satuan?: string;
  keterangan?: ReactNode;
};

/**
 * Kartu ringkas area anggota (hal-09, hal-11): ikon dalam lingkaran, label, nilai & satuan, keterangan opsional.
 * Bertaut: nama aksesibel diawali `label` lalu nilai & satuan, sehingga tidak bergantung pada ikon atau warna.
 */
export function KartuRingkas({ href, label, ikon, nada, nilai, satuan, keterangan }: Props) {
  const isi = (
    <>
      <span
        aria-hidden="true"
        className={`flex size-14 shrink-0 items-center justify-center rounded-full ${NADA[nada]}`}
      >
        <Ikon nama={ikon} className="size-7" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm text-navy/70">{label}</span>
        <span className="flex items-baseline gap-1.5">
          {typeof nilai === "number" ? (
            // Bukan `.angka`: kelas global itu menimpa `lining-nums` (Playfair bawaannya old-style, 0 mirip "O").
            <span className="font-display text-3xl leading-none tabular-nums lining-nums">
              {nilai}
            </span>
          ) : (
            nilai
          )}
          {satuan && <span className="text-sm text-navy/80">{satuan}</span>}
        </span>
        {keterangan && <span className="angka text-sm text-navy/70">{keterangan}</span>}
      </span>
    </>
  );
  const kelas = "flex items-center gap-4 rounded-xl border border-line bg-surface p-5";
  if (!href) return <div className={kelas}>{isi}</div>;
  return (
    <Link href={href} className={`group ${kelas} hover:border-gold-700`}>
      {isi}
      <Ikon nama="panah" className="size-5 shrink-0 text-navy/40 group-hover:text-gold-700" />
    </Link>
  );
}

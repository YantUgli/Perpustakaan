type Props = { teks?: string };

/** Indikator proses (hal-29 "Loading State"). */
export function Memuat({ teks = "Memproses data…" }: Props) {
  return (
    <div role="status" className="flex items-center gap-3 text-sm text-navy/80">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-navy/20 border-t-navy"
      />
      {teks}
    </div>
  );
}

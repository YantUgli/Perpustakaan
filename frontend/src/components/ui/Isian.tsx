import { type ComponentProps, type ReactNode, useId } from "react";

type Props = ComponentProps<"input"> & {
  label: string;
  /** Pesan galat untuk isian ini, biasanya `detail.isian[name]` dari backend (IR-UI-04). */
  galat?: string;
  keterangan?: string;
  /** Ikon dekoratif di kiri dalam isian (mis. `<Ikon nama="amplop" />`); tidak menerima klik. */
  awalan?: ReactNode;
  /** Kontrol di kanan dalam isian (mis. tombol tampilkan password, area sentuh ≥ 44 px). */
  akhiran?: ReactNode;
};

/**
 * Isian form berlabel. Batas input memakai `navy/40` (gold di latar terang tak boleh untuk batas, design-system §2).
 * Tanpa `awalan`/`akhiran`, DOM sama seperti semula; bila diisi, input dibungkus dan padding sisi itu bertambah.
 */
export function Isian({
  label,
  galat,
  keterangan,
  awalan,
  akhiran,
  id,
  required,
  className = "",
  ...lain
}: Props) {
  const idBawaan = useId();
  const idIsian = id ?? idBawaan;
  const idGalat = `${idIsian}-galat`;
  const idKet = `${idIsian}-ket`;
  const dijelaskanOleh = [galat ? idGalat : null, keterangan ? idKet : null]
    .filter(Boolean)
    .join(" ");

  // Hanya bertambah bila awalan/akhiran diisi, agar kelas pemakai lama tetap sama persis.
  const padding = `${awalan ? "pl-11 " : ""}${akhiran ? "pr-12 " : ""}`;
  const input = (
    <input
      id={idIsian}
      required={required}
      aria-invalid={galat ? true : undefined}
      aria-describedby={dijelaskanOleh || undefined}
      className={`min-h-11 w-full min-w-0 rounded-lg border bg-surface px-3 py-2 text-navy placeholder:text-navy/50 focus:outline-2 focus:outline-offset-1 focus:outline-navy ${galat ? "border-status-hilang" : "border-navy/40"} ${padding}${className}`}
      {...lain}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={idIsian} className="text-sm font-medium text-navy">
        {label}
        {required && (
          <span aria-hidden="true" className="text-status-hilang">
            {" "}
            *
          </span>
        )}
      </label>
      {awalan || akhiran ? (
        <div className="relative min-w-0">
          {awalan && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-navy/60"
            >
              {awalan}
            </span>
          )}
          {input}
          {akhiran && <div className="absolute inset-y-0 right-0 flex items-center">{akhiran}</div>}
        </div>
      ) : (
        input
      )}
      {keterangan && !galat && (
        <p id={idKet} className="text-xs text-navy/70">
          {keterangan}
        </p>
      )}
      {galat && (
        <p id={idGalat} className="text-sm text-status-hilang">
          {galat}
        </p>
      )}
    </div>
  );
}

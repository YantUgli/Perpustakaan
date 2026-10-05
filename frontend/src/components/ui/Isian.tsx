import { type ComponentProps, useId } from "react";

type Props = ComponentProps<"input"> & {
  label: string;
  /** Pesan galat untuk isian ini, biasanya `detail.isian[name]` dari backend (IR-UI-04). */
  galat?: string;
  keterangan?: string;
};

/** Isian form berlabel. Batas input memakai `navy/40` (gold di latar terang tak boleh untuk batas, design-system §2). */
export function Isian({ label, galat, keterangan, id, required, className = "", ...lain }: Props) {
  const idBawaan = useId();
  const idIsian = id ?? idBawaan;
  const idGalat = `${idIsian}-galat`;
  const idKet = `${idIsian}-ket`;
  const dijelaskanOleh = [galat ? idGalat : null, keterangan ? idKet : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idIsian} className="text-sm font-medium text-navy">
        {label}
        {required && (
          <span aria-hidden="true" className="text-status-hilang">
            {" "}
            *
          </span>
        )}
      </label>
      <input
        id={idIsian}
        required={required}
        aria-invalid={galat ? true : undefined}
        aria-describedby={dijelaskanOleh || undefined}
        className={`min-h-11 rounded-lg border bg-surface px-3 py-2 text-navy placeholder:text-navy/50 focus:outline-2 focus:outline-offset-1 focus:outline-navy ${galat ? "border-status-hilang" : "border-navy/40"} ${className}`}
        {...lain}
      />
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

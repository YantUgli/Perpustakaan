import { type ComponentProps, useId } from "react";

type Props = ComponentProps<"textarea"> & {
  label: string;
  /** Pesan galat untuk isian ini, biasanya `detail.isian[name]` dari backend (IR-UI-04). */
  galat?: string;
};

/** Isian teks panjang berlabel (mis. alamat). Pola sama dengan `Isian`. */
export function AreaIsian({ label, galat, id, required, className = "", ...lain }: Props) {
  const idBawaan = useId();
  const idIsian = id ?? idBawaan;
  const idGalat = `${idIsian}-galat`;

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
      <textarea
        id={idIsian}
        required={required}
        rows={3}
        aria-invalid={galat ? true : undefined}
        aria-describedby={galat ? idGalat : undefined}
        className={`w-full min-w-0 rounded-lg border bg-surface px-3 py-2 text-navy placeholder:text-navy/50 focus:outline-2 focus:outline-offset-1 focus:outline-navy ${galat ? "border-status-hilang" : "border-navy/40"} ${className}`}
        {...lain}
      />
      {galat && (
        <p id={idGalat} className="text-sm text-status-hilang">
          {galat}
        </p>
      )}
    </div>
  );
}

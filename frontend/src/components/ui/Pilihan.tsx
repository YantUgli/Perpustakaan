import { type ComponentProps, useId } from "react";

type Props = ComponentProps<"select"> & {
  label: string;
  opsi: { nilai: string; label: string }[];
};

/** Pilihan (select) berlabel untuk filter daftar & laporan. Pola sama dengan `Isian`. */
export function Pilihan({ label, opsi, id, className = "", ...lain }: Props) {
  const idBawaan = useId();
  const idPilihan = id ?? idBawaan;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={idPilihan} className="text-sm font-medium text-navy">
        {label}
      </label>
      <select
        id={idPilihan}
        className={`min-h-11 w-full min-w-0 rounded-lg border border-navy/40 bg-surface px-3 py-2 text-navy focus:outline-2 focus:outline-offset-1 focus:outline-navy ${className}`}
        {...lain}
      >
        {opsi.map((o) => (
          <option key={o.nilai} value={o.nilai}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

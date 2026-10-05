import { type ComponentProps, useId } from "react";

import { kelasTombol } from "./Tombol";

type Props = Omit<ComponentProps<"input">, "type" | "value" | "onChange"> & {
  label: string;
  /** Berkas terpilih saat ini (dikendalikan induk) — namanya ditampilkan. */
  berkas: File | null;
  onPilih: (berkas: File | null) => void;
  /** Teks tombol, mis. "Pilih Foto" / "Pilih Cover". */
  teksTombol?: string;
  /** Teks saat belum ada berkas, mis. "Belum ada foto dipilih". */
  teksKosong?: string;
  keterangan?: string;
  /** Pesan galat untuk isian ini, biasanya `detail.isian[name]` dari backend (IR-UI-04). */
  galat?: string;
};

/**
 * Isian unggah berkas berbahasa Indonesia (NFR-USA-02): teks bawaan peramban ("Choose File …") tidak tampil.
 * Input file disembunyikan visual tetapi tetap satu-satunya titik fokus dan berlabel; "tombol" adalah `<label>`
 * bergaya Tombol sekunder sehingga klik maupun Spasi/Enter pada input membuka pemilih berkas bawaan.
 * Dipakai foto anggota (5.4.3) dan kelak cover judul (5.4.7).
 */
export function IsianBerkas({
  label,
  berkas,
  onPilih,
  teksTombol = "Pilih Berkas",
  teksKosong = "Belum ada berkas dipilih",
  keterangan,
  galat,
  id,
  required,
  ...lain
}: Props) {
  const idBawaan = useId();
  const idIsian = id ?? idBawaan;
  const idNama = `${idIsian}-nama`;
  const idGalat = `${idIsian}-galat`;
  const idKet = `${idIsian}-ket`;
  const dijelaskanOleh = [idNama, galat ? idGalat : null, keterangan && !galat ? idKet : null]
    .filter(Boolean)
    .join(" ");

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
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <input
          id={idIsian}
          type="file"
          required={required}
          aria-invalid={galat ? true : undefined}
          aria-describedby={dijelaskanOleh}
          className="peer sr-only"
          onChange={(e) => onPilih(e.target.files?.[0] ?? null)}
          {...lain}
        />
        <label
          htmlFor={idIsian}
          className={kelasTombol(
            "sekunder",
            `cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy ${galat ? "border-status-hilang" : ""}`,
          )}
        >
          {teksTombol}
        </label>
        <span id={idNama} aria-live="polite" className="min-w-0 truncate text-sm text-navy/80">
          {berkas ? berkas.name : teksKosong}
        </span>
      </div>
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

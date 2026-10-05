"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

type Props = {
  terbuka: boolean;
  judul: string;
  onTutup: () => void;
  children: ReactNode;
  /** Tombol aksi (mis. Batal + Hapus) di bagian bawah. */
  aksi?: ReactNode;
};

/**
 * Modal memakai `<dialog>` bawaan (fokus terkunci, Esc menutup). Varian konfirmasi/sukses/peringatan/galat
 * (hal-29) cukup dibedakan lewat isi & aksi; pesan penolakan bisnis tetap dari backend (IR-UI-04).
 */
export function Modal({ terbuka, judul, onTutup, children, aksi }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const idJudul = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (terbuka && !dialog.open) dialog.showModal?.();
    if (!terbuka && dialog.open) dialog.close?.();
  }, [terbuka]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idJudul}
      onClose={onTutup}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-navy backdrop:bg-navy/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={idJudul} className="font-display text-xl">
          {judul}
        </h2>
        <div className="text-sm text-navy/90">{children}</div>
        {aksi && <div className="flex flex-wrap justify-end gap-2">{aksi}</div>}
      </div>
    </dialog>
  );
}

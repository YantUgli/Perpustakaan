import Link from "next/link";
import type { ReactNode } from "react";

import { Ikon } from "@/components/ui/Ikon";

type Props = {
  id: string;
  judul: string;
  subjudul?: string;
  /** Tautan "Lihat Semua" ke halaman lengkap; tidak dirender bila kosong. */
  lihatSemua?: string;
  children: ReactNode;
};

/** Panel dashboard anggota (hal-09): kartu putih, judul `h2`, "Lihat Semua →" ke halaman lengkapnya. */
export function PanelDashboard({ id, judul, subjudul, lihatSemua, children }: Props) {
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-5"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id={id} className="font-display text-2xl">
            {judul}
          </h2>
          {lihatSemua && (
            <Link
              href={lihatSemua}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-gold-700 underline-offset-4 hover:underline"
            >
              Lihat Semua
              <Ikon nama="panah" className="size-4" />
            </Link>
          )}
        </div>
        {subjudul && <p className="text-sm text-navy/70">{subjudul}</p>}
      </div>
      {children}
    </section>
  );
}

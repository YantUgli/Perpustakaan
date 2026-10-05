import Link from "next/link";

import { jumlahHalaman } from "@/lib/halaman";

type Props = {
  halaman: number;
  total: number;
  perHalaman: number;
  /** Path halaman daftar, mis. "/anggota/riwayat"; nomor halaman ditambahkan sebagai `?halaman=`. */
  path: string;
};

const KELAS =
  "inline-flex min-h-11 items-center rounded-full border border-navy/40 px-4 text-sm font-medium";

/** Navigasi daftar berhalaman (FR-KTL-04, FR-AGT-03/04). Halaman di luar jangkauan tetap boleh dibuka (data kosong). */
export function Paginasi({ halaman, total, perHalaman, path }: Props) {
  const akhir = jumlahHalaman(total, perHalaman);
  const ke = (n: number) => `${path}?halaman=${n}`;
  return (
    <nav aria-label="Navigasi halaman" className="flex items-center justify-between gap-3">
      {halaman > 1 ? (
        <Link href={ke(Math.min(halaman - 1, akhir))} className={`${KELAS} hover:bg-navy/5`}>
          Sebelumnya
        </Link>
      ) : (
        <span aria-disabled="true" className={`${KELAS} opacity-40`}>
          Sebelumnya
        </span>
      )}
      <span className="angka text-sm text-navy/80">
        Halaman {halaman} dari {akhir}
      </span>
      {halaman < akhir ? (
        <Link href={ke(halaman + 1)} className={`${KELAS} hover:bg-navy/5`}>
          Berikutnya
        </Link>
      ) : (
        <span aria-disabled="true" className={`${KELAS} opacity-40`}>
          Berikutnya
        </span>
      )}
    </nav>
  );
}

import Link from "next/link";

import { jumlahHalaman } from "@/lib/halaman";

type Props = {
  halaman: number;
  total: number;
  perHalaman: number;
  /** Path halaman daftar, mis. "/anggota/riwayat"; nomor halaman ditambahkan sebagai `?halaman=`. */
  path: string;
  /**
   * Parameter lain yang dipertahankan di setiap tautan (mis. filter daftar tagihan). Nilai daftar ditulis
   * berulang dengan urutan tetap (mis. `kategori_id` katalog, OQ-44); nilai kosong dilewati.
   */
  params?: Record<string, string | string[] | undefined>;
};

const KELAS =
  "inline-flex min-h-11 items-center rounded-full border border-navy/40 px-4 text-sm font-medium";

/** Navigasi daftar berhalaman (FR-KTL-04, FR-AGT-03/04). Halaman di luar jangkauan tetap boleh dibuka (data kosong). */
export function Paginasi({ halaman, total, perHalaman, path, params = {} }: Props) {
  const akhir = jumlahHalaman(total, perHalaman);
  const ke = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) for (const x of v) q.append(k, x);
      else if (v) q.set(k, v);
    }
    q.set("halaman", String(n));
    return `${path}?${q.toString()}`;
  };
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

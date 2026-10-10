import { LabelStatus } from "@/components/ui/LabelStatus";
import { PanelDashboard } from "@/components/ui/PanelDashboard";
import { Pesan } from "@/components/ui/Pesan";
import type { components } from "@/lib/api-skema";
import { formatTanggal } from "@/lib/format";

type Baris = components["schemas"]["BarisTransaksiKeluar"];

/**
 * Panel "Item Terlambat" dashboard admin (hal-31, keputusan Ayen 10/10/2026): 5 baris pertama laporan transaksi
 * `status=TERLAMBAT` (OQ-37), urutan API terlama dulu (OQ-41) = paling lama terlambat di atas. Hanya jatuh tempo
 * `DD/MM/YYYY` dan badge dari field `terlambat`; **tanpa "N hari"** (K-07, tidak dihitung di klien) dan **tanpa
 * nominal**: denda baru terbentuk saat buku dikembalikan. `galat` = `pesan` backend apa adanya (IR-UI-04).
 */
export function PanelItemTerlambat({ baris, galat }: { baris: Baris[]; galat: string | null }) {
  const ada = galat === null && baris.length > 0;
  return (
    <PanelDashboard
      id="judul-item-terlambat"
      judul="Item Terlambat"
      subjudul="Buku yang belum kembali setelah jatuh tempo, terlama di atas."
      lihatSemua={ada ? "/admin/laporan/transaksi?status=TERLAMBAT" : undefined}
    >
      {galat !== null ? (
        <Pesan jenis="galat">{galat}</Pesan>
      ) : baris.length === 0 ? (
        <p className="text-sm text-navy/70">Tidak ada item terlambat.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {baris.map((b) => (
            <li
              key={b.kode_eksemplar}
              className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="font-semibold wrap-break-word">
                  {b.anggota_nama}{" "}
                  <span className="angka font-normal text-navy/70">({b.anggota_kode})</span>
                </p>
                <p className="text-sm wrap-break-word text-navy/80">
                  {b.judul} · <span className="angka">{b.kode_eksemplar}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
                <p className="text-sm text-navy/70">
                  Jatuh tempo{" "}
                  <span className="angka text-navy">{formatTanggal(b.jatuh_tempo)}</span>
                </p>
                <LabelStatus status={b.status} terlambat={b.terlambat} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelDashboard>
  );
}

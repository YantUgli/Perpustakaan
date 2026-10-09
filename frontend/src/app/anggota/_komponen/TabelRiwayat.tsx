import { LabelStatus } from "@/components/ui/LabelStatus";
import type { components } from "@/lib/api-skema";
import { tanggalAkhir } from "@/lib/area-anggota";
import { formatTanggal } from "@/lib/format";

type Item = components["schemas"]["ItemRiwayatKeluar"];

const KOLOM = ["Buku", "Tanggal Pinjam", "Jatuh Tempo", "Tanggal Kembali / Kejadian", "Status"];

/**
 * Tabel riwayat (hal-13, FR-AGT-03, OQ-35), dipakai mulai `xl`; di bawahnya `KartuRiwayat`. Urutan API; tanpa ID
 * transaksi, cover, penulis (∅API), ikon sort, maupun tautan detail (hal-12 ⛔). Status dari `LabelStatus`
 * (Terlambat dari field `terlambat`, IR-UI-03).
 */
export function TabelRiwayat({ item, idJudul }: { item: Item[]; idJudul: string }) {
  return (
    <table aria-labelledby={idJudul} className="w-full text-left text-sm">
      <thead>
        <tr className="bg-ivory text-navy/70">
          {KOLOM.map((k) => (
            <th
              key={k}
              scope="col"
              className="px-4 py-3 font-medium first:rounded-l-lg last:rounded-r-lg"
            >
              {k}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {item.map((i, n) => {
          const akhir = tanggalAkhir(i);
          return (
            // Respons riwayat tidak memuat id item; urutan dari API stabil (OQ-35).
            <tr key={`${n}-${i.kode_eksemplar}`}>
              <td className="px-4 py-3">
                <p className="font-display text-base leading-snug">{i.judul}</p>
                <p className="angka text-xs text-navy/70">{i.kode_eksemplar}</p>
              </td>
              <td className="angka px-4 py-3">{formatTanggal(i.tanggal_pinjam)}</td>
              <td className="angka px-4 py-3">{formatTanggal(i.jatuh_tempo)}</td>
              <td className="angka px-4 py-3">
                {akhir.tanggal ? formatTanggal(akhir.tanggal) : akhir.kosong}
              </td>
              <td className="px-4 py-3">
                <LabelStatus status={i.status} terlambat={i.terlambat} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

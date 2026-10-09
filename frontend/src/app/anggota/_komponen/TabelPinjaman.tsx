import { LabelStatus } from "@/components/ui/LabelStatus";
import type { components } from "@/lib/api-skema";
import { formatTanggal } from "@/lib/format";

import { PilSisaHari } from "./PilSisaHari";

type Pinjaman = components["schemas"]["PinjamanAktifKeluar"];

const KOLOM = ["Buku", "Tanggal Pinjam", "Jatuh Tempo", "Sisa Hari", "Status"];

/**
 * Tabel "Daftar Buku Pinjaman Aktif" (hal-11, FR-AGT-02, OQ-34), dipakai mulai `xl`; di bawahnya halaman memakai
 * `KartuPinjaman`. Urutan API apa adanya. Status dari `LabelStatus` (Terlambat dari field `terlambat`, IR-UI-03).
 * Tanpa cover/penulis/kategori (∅API).
 */
export function TabelPinjaman({ pinjaman, idJudul }: { pinjaman: Pinjaman[]; idJudul: string }) {
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
        {pinjaman.map((p) => (
          <tr key={p.kode_eksemplar}>
            <td className="px-4 py-3">
              <p className="font-display text-base leading-snug">{p.judul}</p>
              <p className="angka text-xs text-navy/70">{p.kode_eksemplar}</p>
            </td>
            <td className="angka px-4 py-3">{formatTanggal(p.tanggal_pinjam)}</td>
            <td className="angka px-4 py-3">{formatTanggal(p.jatuh_tempo)}</td>
            <td className="px-4 py-3">
              <PilSisaHari p={p} />
            </td>
            <td className="px-4 py-3">
              <LabelStatus status="DIPINJAM" terlambat={p.terlambat} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

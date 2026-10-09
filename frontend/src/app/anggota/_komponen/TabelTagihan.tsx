import { LabelStatus } from "@/components/ui/LabelStatus";
import type { components } from "@/lib/api-skema";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { LABEL_CARA_PENYELESAIAN, LABEL_JENIS_TAGIHAN } from "@/lib/label";

type Tagihan = components["schemas"]["TagihanAnggotaKeluar"];

const KOLOM = [
  "Jenis",
  "Buku Terkait",
  "Nominal",
  "Status",
  "Cara Penyelesaian",
  "Tanggal Dibentuk",
  "Tanggal Penyelesaian",
];

/**
 * Tabel "Daftar Tagihan" (hal-14, FR-AGT-04, OQ-36), dipakai mulai `xl`; di bawahnya `KartuTagihan`. Urutan API.
 * Jenis berupa chip netral (bukan warna status). Tanpa ID tagihan, cover, penulis (∅API), tautan detail (hal-15
 * tidak dibuat), maupun tombol bayar.
 */
export function TabelTagihan({ tagihan, idJudul }: { tagihan: Tagihan[]; idJudul: string }) {
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
        {tagihan.map((t) => (
          <tr key={t.id}>
            <td className="px-4 py-3">
              <span className="rounded-full bg-navy/5 px-2.5 py-0.5 text-xs font-medium text-navy/80">
                {LABEL_JENIS_TAGIHAN[t.jenis]}
              </span>
            </td>
            <td className="px-4 py-3">
              <p className="font-display text-base leading-snug">{t.judul}</p>
              <p className="angka text-xs text-navy/70">{t.kode_eksemplar}</p>
            </td>
            <td className="angka px-4 py-3 font-semibold">{formatRupiah(t.nominal)}</td>
            <td className="px-4 py-3">
              <LabelStatus status={t.status} />
            </td>
            <td className="px-4 py-3">
              {t.cara_penyelesaian ? LABEL_CARA_PENYELESAIAN[t.cara_penyelesaian] : "—"}
            </td>
            <td className="angka px-4 py-3">{formatTanggal(t.tanggal_dibentuk)}</td>
            <td className="angka px-4 py-3">
              {t.tanggal_penyelesaian ? formatTanggal(t.tanggal_penyelesaian) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

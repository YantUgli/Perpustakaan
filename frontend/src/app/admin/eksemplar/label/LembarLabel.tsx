import { KodeQr } from "@/components/ui/KodeQr";
import type { components } from "@/lib/api-skema";
import { LABEL_PER_HALAMAN, UKURAN_LABEL, bagiHalaman, cssLabel } from "@/lib/label-cetak";

type Label = components["schemas"]["LabelEksemplar"];

// Ukuran QR dalam px hanya cadangan (96 dpi); ukuran fisik 24 mm dipaksa CSS `.label-qr`.
const QR_PX = Math.round((UKURAN_LABEL.qrMm / 25.4) * 96);

/**
 * FR-BKU-06, IR-HW-02: lembar label A4 (21 label per lembar). Isi QR dari API apa adanya (`isi_qr`);
 * kode dan judul singkat juga dari API. Tata letak & ukuran fisik: `lib/label-cetak.ts`.
 */
export function LembarLabel({ label }: { label: Label[] }) {
  const lembar = bagiHalaman(label, LABEL_PER_HALAMAN);
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <style>{cssLabel()}</style>
      <div className="flex w-max flex-col gap-6 print:w-auto print:gap-0">
        {lembar.map((halaman, i) => (
          <section
            key={i}
            data-lembar
            aria-label={`Lembar label ${i + 1}`}
            className="lembar-label shadow-md print:shadow-none"
          >
            {halaman.map((l) => (
              <div key={l.kode} data-label className="label-item">
                <KodeQr isi={l.isi_qr} ukuran={QR_PX} judul={`QR ${l.kode}`} className="label-qr" />
                <div className="label-teks">
                  <span className="label-kode">{l.kode}</span>
                  <span className="label-judul">{l.judul_singkat}</span>
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

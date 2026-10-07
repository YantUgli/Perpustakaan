import { kelasTombol } from "@/components/ui/Tombol";

/**
 * FR-LAP-04: unduh PDF (untuk dicetak) dan Excel dari endpoint ekspor dengan filter yang sedang aktif.
 * Backend mengirim `Content-Disposition: attachment`, jadi tombol mengunduh berkas; tidak ada berkas
 * yang disusun di klien. Tautan biasa (`<a>`), bukan `Link`, karena targetnya endpoint API.
 */
export function AksiEkspor({ urlPdf, urlXlsx }: { urlPdf: string; urlXlsx: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a href={urlPdf} className={kelasTombol("primer")}>
        Unduh PDF (untuk cetak)
      </a>
      <a href={urlXlsx} className={kelasTombol("sekunder")}>
        Unduh Excel
      </a>
    </div>
  );
}

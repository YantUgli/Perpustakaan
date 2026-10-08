import Image, { type StaticImageData } from "next/image";

type Sisi = "kanan" | "kiri";

const KELAS: Record<Sisi, { panel: string; sizes: string }> = {
  kanan: {
    panel:
      "absolute inset-y-0 right-0 hidden w-[57%] bg-line/40 mask-l-from-65% mask-l-to-100% lg:block",
    sizes: "57vw",
  },
  kiri: {
    panel:
      "absolute inset-y-0 left-0 hidden w-[55%] bg-line/40 mask-r-from-65% mask-r-to-100% lg:block",
    sizes: "55vw",
  },
};

/**
 * Panel foto dekoratif hero publik ±55–57% lebar layar. `sisi="kanan"` (bawaan; beranda hal-02, katalog hal-03/04,
 * Tentang hal-06): di belakang ujung kolom teks, tepi kirinya dipudarkan ke ivory. `sisi="kiri"` (masuk hal-07):
 * cerminnya, tepi kanan memudar ke ivory di belakang kartu. Menyatu dengan latar hero tanpa garis pemisah. Tanpa
 * teks di atas foto (tak terbaca di foto gelap; tagline tetap di footer). Hanya `lg` ke atas: di bawahnya panel
 * `display: none` sehingga foto (lazy) tidak diunduh. Induk wajib `relative overflow-hidden`.
 */
export function PanelHero({ foto, sisi = "kanan" }: { foto: StaticImageData; sisi?: Sisi }) {
  const k = KELAS[sisi];
  return (
    <div aria-hidden="true" className={k.panel}>
      <Image src={foto} alt="" fill sizes={k.sizes} fetchPriority="high" className="object-cover" />
    </div>
  );
}

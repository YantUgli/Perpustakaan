import Image, { type StaticImageData } from "next/image";

/**
 * Panel kanan hero publik (beranda hal-02, katalog hal-03/04, Tentang hal-06): foto dekoratif ±57% lebar layar
 * di belakang ujung kolom teks, tepi kirinya dipudarkan ke ivory dengan mask sehingga menyatu dengan latar hero
 * tanpa garis pemisah. Tanpa tagline di atas foto (tak terbaca di foto gelap; tagline tetap di footer). Hanya `lg`
 * ke atas: di bawahnya panel `display: none` sehingga foto (lazy) tidak diunduh. Induk wajib
 * `relative overflow-hidden`.
 */
export function PanelHero({ foto }: { foto: StaticImageData }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-y-0 right-0 hidden w-[57%] bg-line/40 mask-l-from-65% mask-l-to-100% lg:block"
    >
      <Image src={foto} alt="" fill sizes="57vw" fetchPriority="high" className="object-cover" />
    </div>
  );
}

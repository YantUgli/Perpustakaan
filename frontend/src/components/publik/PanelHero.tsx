import { IkonLogo } from "@/components/ui/Logo";

/**
 * Panel kanan hero publik (beranda hal-02, Tentang hal-06; D1a diperhalus: dekoratif CSS, tanpa foto). Bidang ±57%
 * lebar layar di belakang ujung kolom teks: gradasi dari ivory (sama dengan latar hero) makin pekat ke kanan +
 * pendaran lembut, tepi kirinya dipudarkan dengan mask sehingga gradasi, watermark, dan tagline menyatu tanpa garis
 * pemisah. Hanya `lg` ke atas. Induk wajib `relative overflow-hidden`.
 */
export function PanelHero() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-y-0 right-0 hidden w-[57%] bg-linear-to-r from-ivory via-line/30 to-line/60 mask-l-from-65% mask-l-to-100% lg:block"
    >
      <div className="absolute inset-0 bg-radial-[at_70%_35%] from-surface/70 to-transparent to-60%" />
      <div className="absolute inset-0 bg-radial-[at_90%_85%] from-gold/15 to-transparent to-55%" />
      <IkonLogo className="absolute right-12 bottom-10 h-56 text-navy opacity-[0.06]" />
      <div className="absolute top-1/2 right-[10%] flex -translate-y-1/2 flex-col gap-4">
        <p className="font-display text-4xl leading-snug text-navy italic 2xl:text-5xl">
          Lebih Banyak Cerita,
          <span className="block">Lebih Luas Dunia.</span>
        </p>
        <span className="block h-0.5 w-16 bg-gold" />
      </div>
    </div>
  );
}

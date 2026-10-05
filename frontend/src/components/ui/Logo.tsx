type Props = {
  /** `terang` = untuk latar ivory (teks navy); `gelap` = untuk latar navy (teks ivory). */
  latar?: "terang" | "gelap";
  ukuran?: "sedang" | "besar";
  className?: string;
};

/**
 * Logo Naratif. Sementara berupa wordmark Playfair tanpa ikon (P4). Bila SVG asli dari UX tersedia
 * (`public/brand/logo.svg`), ganti isi komponen ini saja; pemakai tidak perlu diubah.
 * Jangan menjiplak logo dari screenshot.
 */
export function Logo({ latar = "terang", ukuran = "sedang", className = "" }: Props) {
  const warna = latar === "terang" ? "text-navy" : "text-ivory";
  const besar = ukuran === "besar" ? "text-4xl" : "text-2xl";
  return (
    <span className={`font-display font-semibold tracking-tight ${warna} ${besar} ${className}`}>
      Naratif
    </span>
  );
}

/** Inisial dari nama: huruf awal kata pertama dan terakhir ("Aulia Rahma" → "AR", "Aulia" → "A"). */
export function inisial(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter(Boolean);
  if (kata.length === 0) return "?";
  const pertama = kata[0][0];
  const terakhir = kata.length > 1 ? kata[kata.length - 1][0] : "";
  return (pertama + terakhir).toLocaleUpperCase("id-ID");
}

const UKURAN = {
  kecil: "size-8 text-xs",
  sedang: "size-11 text-sm",
  besar: "size-24 text-2xl",
  /**
   * Kartu anggota digital `/anggota/qr` (hal-10): 128 px, 160 px mulai `sm`, 144 px di `xl` (kolom identitas
   * ±180 px di 1280 px), 176 px mulai `2xl`.
   */
  kartu: "size-32 text-4xl sm:size-40 sm:text-5xl xl:size-36 2xl:size-44",
} as const;

export type UkuranAvatar = keyof typeof UKURAN;

export function kelasAvatar(ukuran: UkuranAvatar): string {
  return `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${UKURAN[ukuran]}`;
}

/** Avatar inisial; dipakai `Avatar` tanpa foto dan `AvatarFoto` saat foto gagal dimuat (OQ-42). */
export function AvatarInisial({ nama, ukuran }: { nama: string; ukuran: UkuranAvatar }) {
  return (
    <span
      role="img"
      aria-label={nama}
      className={`${kelasAvatar(ukuran)} bg-navy font-semibold text-ivory`}
    >
      <span aria-hidden="true">{inisial(nama)}</span>
    </span>
  );
}

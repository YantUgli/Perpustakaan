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
} as const;

type Props = {
  nama: string;
  /**
   * URL foto (OQ-42: hanya untuk anggota pemiliknya dan admin, tidak publik). Endpoint foto belum ada,
   * jadi saat ini selalu kosong dan avatar menampilkan inisial.
   */
  src?: string | null;
  ukuran?: keyof typeof UKURAN;
};

export function Avatar({ nama, src, ukuran = "sedang" }: Props) {
  const kelas = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${UKURAN[ukuran]}`;
  if (src) {
    // Foto dari endpoint terproteksi (cookie sesi); next/image tidak dipakai agar cookie ikut terkirim.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`Foto ${nama}`} className={`${kelas} object-cover`} />;
  }
  return (
    <span role="img" aria-label={nama} className={`${kelas} bg-navy font-semibold text-ivory`}>
      <span aria-hidden="true">{inisial(nama)}</span>
    </span>
  );
}

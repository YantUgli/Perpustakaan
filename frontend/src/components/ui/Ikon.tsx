import type { ReactNode } from "react";

/** Ikon dekoratif (garis `currentColor`, kecuali varian `…Isi` yang solid). Selalu `aria-hidden`: maknanya dibawa teks di sebelahnya. */
const PATH = {
  cari: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  panah: <path d="M5 12h14m-6-6 6 6-6 6" />,
  /** Varian solid (isi `currentColor`), mendekati ikon kategori hal-02. */
  bukuIsi: (
    <>
      <path
        fill="currentColor"
        stroke="none"
        d="M11.25 6.2C9.3 4.75 6.3 4.1 2.5 4.4v14.4c3.6-.3 6.6.3 8.75 1.75Z"
      />
      <path
        fill="currentColor"
        stroke="none"
        d="M12.75 6.2c1.95-1.45 4.95-2.1 8.75-1.8v14.4c-3.6-.3-6.6.3-8.75 1.75Z"
      />
    </>
  ),
  /** Ikon kategori solid (hal-02): gedung berpilar (sejarah). */
  gedungIsi: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 2.5 2.5 7.5v1.75h19V7.5ZM4 10.5h3v7H4Zm4.5 0h3v7h-3Zm4 0h3v7h-3Zm4.5 0h3v7h-3ZM2.5 18.75h19v2.75h-19Z"
    />
  ),
  /** Atom (sains): orbit garis + inti solid. */
  atom: (
    <>
      <ellipse cx="12" cy="12" rx="10" ry="4" strokeWidth="1.75" />
      <ellipse cx="12" cy="12" rx="10" ry="4" strokeWidth="1.75" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" strokeWidth="1.75" transform="rotate(120 12 12)" />
      <circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none" />
    </>
  ),
  /** Laptop (komputer/teknologi). */
  laptopIsi: (
    <path
      fill="currentColor"
      stroke="none"
      fillRule="evenodd"
      d="M5 4h14a1.5 1.5 0 0 1 1.5 1.5V15h-17V5.5A1.5 1.5 0 0 1 5 4Zm.75 2.25v6.5h12.5v-6.5ZM1.5 16.5h21l-1.2 2.6a1.5 1.5 0 0 1-1.36.9H4.06a1.5 1.5 0 0 1-1.36-.9Z"
    />
  ),
  /** Boneka beruang (anak). */
  beruangIsi: (
    <path
      fill="currentColor"
      stroke="none"
      d="M7 3.5a2.6 2.6 0 0 1 2.45 1.73A6 6 0 0 1 12 4.7a6 6 0 0 1 2.55.53A2.6 2.6 0 1 1 17.6 8.6a5.4 5.4 0 0 1-1.1 4.1 4.6 4.6 0 0 1 2 3.8c0 2.8-2.9 4.5-6.5 4.5s-6.5-1.7-6.5-4.5a4.6 4.6 0 0 1 2-3.8 5.4 5.4 0 0 1-1.1-4.1A2.6 2.6 0 0 1 7 3.5Z"
    />
  ),
  /** Orang (biografi). */
  orangIsi: (
    <>
      <circle cx="12" cy="7.5" r="4.25" fill="currentColor" stroke="none" />
      <path fill="currentColor" stroke="none" d="M3.5 21a8.5 8.5 0 0 1 17 0Z" />
    </>
  ),
  /** Bohlam (nonfiksi/pengetahuan). */
  bohlamIsi: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 2a7 7 0 0 0-4.2 12.6c.7.53 1.2 1.3 1.2 2.15V17.5h6v-.75c0-.85.5-1.62 1.2-2.15A7 7 0 0 0 12 2ZM9 19h6v1.25A1.75 1.75 0 0 1 13.25 22h-2.5A1.75 1.75 0 0 1 9 20.25Z"
    />
  ),
  /** Lentera (agama/spiritual), netral tanpa simbol agama tertentu. */
  lenteraIsi: (
    <path
      fill="currentColor"
      stroke="none"
      fillRule="evenodd"
      d="M12 1.5A2.5 2.5 0 0 0 9.5 4H11a1 1 0 0 1 2 0h1.5A2.5 2.5 0 0 0 12 1.5ZM8 5h8l1.5 2.5h-11ZM7 8.5h10l-.6 10H7.6Zm3 2v6h4v-6ZM6 19.5h12V22H6Z"
    />
  ),
  /** Buku tertutup berpita (referensi/kamus). */
  bukuTutupIsi: (
    <path
      fill="currentColor"
      stroke="none"
      fillRule="evenodd"
      d="M6.5 2H19v16H6.75a1.25 1.25 0 0 0 0 2.5H19V22H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Zm6 0v7l2-1.5 2 1.5V2Z"
    />
  ),
  /** QR solid (pinjam dengan QR anggota). */
  qrIsi: (
    <path
      fill="currentColor"
      stroke="none"
      fillRule="evenodd"
      d="M3 3h8v8H3Zm2 2v4h4V5Zm1 1h2v2H6ZM13 3h8v8h-8Zm2 2v4h4V5Zm1 1h2v2h-2ZM3 13h8v8H3Zm2 2v4h4v-4Zm1 1h2v2H6ZM13 13h3v3h-3Zm5 0h3v3h-3Zm-5 5h3v3h-3Zm5 0h3v3h-3Z"
    />
  ),
  /** Kursi baca solid (ruang baca). */
  kursiIsi: (
    <path
      fill="currentColor"
      stroke="none"
      d="M6 5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v7H6ZM1 11a2 2 0 0 1 4 0v3h14v-3a2 2 0 0 1 4 0v6H1Zm2 7h2.5v3H3Zm15.5 0H21v3h-2.5Z"
    />
  ),
  /** Timbangan (Tentang: layanan adil). Tali garis, lengan & mangkuk solid. */
  timbanganIsi: (
    <>
      <path d="M5 8 2 14M5 8l3 6M19 8l-3 6M19 8l3 6" />
      <path
        fill="currentColor"
        stroke="none"
        d="M11 3h2v16h-2ZM3.5 6.5h17v2h-17ZM1.5 14.5h7a3.5 3.5 0 0 1-7 0Zm14 0h7a3.5 3.5 0 0 1-7 0ZM7 19.5h10V22H7Z"
      />
    </>
  ),
  /** Tunas daun (Tentang: menjaga koleksi agar terawat). */
  daunIsi: (
    <>
      <path d="M12 21v-9" strokeWidth="2" />
      <path
        fill="currentColor"
        stroke="none"
        d="M11.5 14C11.5 8.8 8.2 5.5 2.5 5.5c0 5.5 3.3 8.5 9 8.5Zm1-2.5c0-4.6 3.1-7.7 9-7.7 0 5-3.1 7.7-9 7.7Z"
      />
    </>
  ),
  /** Gelembung percakapan (Tentang: bantuan petugas). */
  bantuanIsi: (
    <path
      fill="currentColor"
      stroke="none"
      d="M4.5 3h15A2.5 2.5 0 0 1 22 5.5v9a2.5 2.5 0 0 1-2.5 2.5H12l-5.5 4.5V17h-2A2.5 2.5 0 0 1 2 14.5v-9A2.5 2.5 0 0 1 4.5 3Z"
    />
  ),
  /** Penanda lokasi (Tentang: alamat). */
  pinIsi: (
    <path
      fill="currentColor"
      stroke="none"
      fillRule="evenodd"
      d="M12 1.5a7.5 7.5 0 0 0-7.5 7.5c0 5.4 7.5 13.5 7.5 13.5s7.5-8.1 7.5-13.5A7.5 7.5 0 0 0 12 1.5Zm0 4.75a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5Z"
    />
  ),
  /** Jam (Tentang: jam buka). */
  jamIsi: (
    <path
      fill="currentColor"
      stroke="none"
      fillRule="evenodd"
      d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21ZM11 6h2v5.45l3.9 2.25-1 1.73-4.9-2.83Z"
    />
  ),
  /** Gagang telepon (Tentang: kontak). */
  teleponIsi: (
    <path
      fill="currentColor"
      stroke="none"
      d="M6.2 2.2 9.4 2l1.9 4.9-2.4 1.9a12.5 12.5 0 0 0 6.3 6.3l1.9-2.4 4.9 1.9-.2 3.2a2.4 2.4 0 0 1-2.5 2.2A17.5 17.5 0 0 1 4 4.7a2.4 2.4 0 0 1 2.2-2.5Z"
    />
  ),
} satisfies Record<string, ReactNode>;

export type NamaIkon = keyof typeof PATH;

export function Ikon({ nama, className = "size-5" }: { nama: NamaIkon; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATH[nama]}
    </svg>
  );
}

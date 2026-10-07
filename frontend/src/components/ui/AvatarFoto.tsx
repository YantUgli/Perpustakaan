"use client";

import { useEffect, useRef, useState } from "react";

import { AvatarInisial, type UkuranAvatar, kelasAvatar } from "./AvatarInisial";

/**
 * Foto anggota (OQ-42) dengan cadangan inisial bila gagal dimuat. Client component hanya karena butuh
 * state `gagal`; `Avatar` tanpa foto tetap server component.
 */
export function AvatarFoto({
  nama,
  src,
  ukuran,
}: {
  nama: string;
  src: string;
  ukuran: UkuranAvatar;
}) {
  const [gagal, setGagal] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // Penjaga hydration: event error yang terjadi sebelum React terpasang tidak sampai ke onError.
  // Gambar yang sudah selesai dimuat tetapi rusak/ditolak (404, 401) punya naturalWidth 0.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setGagal(true);
  }, [src]);

  if (gagal) return <AvatarInisial nama={nama} ukuran={ukuran} />;
  return (
    // Sengaja bukan next/image: pengoptimal mengambil gambar di server tanpa cookie sesi (→ 401) dan
    // bisa menyimpan foto pribadi di cache server (decisions.md OQ-42). Path relatif = cookie ikut.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={`Foto ${nama}`}
      onError={() => setGagal(true)}
      className={`${kelasAvatar(ukuran)} object-cover`}
    />
  );
}

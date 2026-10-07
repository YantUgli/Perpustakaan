import { AvatarFoto } from "./AvatarFoto";
import { AvatarInisial, type UkuranAvatar } from "./AvatarInisial";

export { inisial } from "./AvatarInisial";

type Props = {
  nama: string;
  /**
   * URL foto, path relatif `/api/v1/...` (OQ-42: hanya untuk anggota pemiliknya dan admin, tidak publik).
   * Diisi hanya bila respons profil `ada_foto`; dipakai di profil anggota dan detail anggota admin.
   * Kosong → inisial. Foto gagal dimuat → kembali ke inisial (`AvatarFoto`).
   */
  src?: string | null;
  ukuran?: UkuranAvatar;
};

export function Avatar({ nama, src, ukuran = "sedang" }: Props) {
  if (src) return <AvatarFoto nama={nama} src={src} ukuran={ukuran} />;
  return <AvatarInisial nama={nama} ukuran={ukuran} />;
}

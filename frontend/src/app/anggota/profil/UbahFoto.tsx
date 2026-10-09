"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AvatarFoto } from "@/components/ui/AvatarFoto";
import { AvatarInisial } from "@/components/ui/AvatarInisial";
import { IsianBerkas } from "@/components/ui/IsianBerkas";
import { Pesan } from "@/components/ui/Pesan";
import { Tombol } from "@/components/ui/Tombol";
import { ambil } from "@/lib/api-klien";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";
import { validasiFoto } from "@/lib/validasi-akun";

export const URL_FOTO = "/api/v1/anggota/profil/foto";
export const PESAN_FOTO_BERHASIL = "Foto berhasil diperbarui.";

/**
 * Avatar Profil + ubah foto sendiri (OQ-48; hanya anggota, admin tidak, FR-AKN-11): pilih berkas (`IsianBerkas`,
 * validasi klien `validasiFoto` yang sama dengan daftar) → pratinjau → "Simpan Foto" / "Batal". Kirim multipart
 * `foto` ke `PUT /anggota/profil/foto`; galat backend apa adanya (IR-UI-04, termasuk 503). Sukses: avatar memakai
 * `?v=` agar peramban memuat ulang (respons foto `no-store`, URL sama), lalu `router.refresh()`. Tanpa hapus foto.
 */
export function UbahFoto({ nama, adaFoto }: { nama: string; adaFoto: boolean }) {
  const router = useRouter();
  const [srcFoto, setSrcFoto] = useState<string | null>(adaFoto ? URL_FOTO : null);
  const [berkas, setBerkas] = useState<File | null>(null);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | undefined>();
  const [pesan, setPesan] = useState<{ jenis: "sukses" | "galat"; teks: string } | null>(null);
  const [proses, setProses] = useState(false);
  // Ganti `key` IsianBerkas → input file di-reset (berkas yang sama bisa dipilih lagi).
  const [putaran, setPutaran] = useState(0);

  // Object URL pratinjau dibebaskan saat diganti, batal, selesai, atau unmount.
  useEffect(() => {
    if (!pratinjau) return;
    return () => URL.revokeObjectURL(pratinjau);
  }, [pratinjau]);

  function reset() {
    setBerkas(null);
    setPratinjau(null);
    setGalat(undefined);
    setPutaran((n) => n + 1);
  }

  function pilih(f: File | null) {
    setPesan(null);
    setBerkas(f);
    setPratinjau(null);
    const g = f ? validasiFoto(f) : undefined;
    setGalat(g);
    if (f && !g) setPratinjau(URL.createObjectURL(f));
  }

  async function simpan() {
    if (!berkas || galat) return;
    setProses(true);
    setPesan(null);
    try {
      const data = new FormData();
      data.append("foto", berkas);
      await ambil("/anggota/profil/foto", { method: "PUT", body: data });
      setSrcFoto(`${URL_FOTO}?v=${Date.now()}`);
      reset();
      setPesan({ jenis: "sukses", teks: PESAN_FOTO_BERHASIL });
      router.refresh();
    } catch (err) {
      if (err instanceof GalatApi) {
        setPesan({ jenis: "galat", teks: err.pesan });
        if (err.isian.foto) setGalat(err.isian.foto);
      } else {
        setPesan({ jenis: "galat", teks: PESAN_SISTEM });
      }
    } finally {
      setProses(false);
    }
  }

  const src = pratinjau ?? srcFoto;
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <span className="rounded-full p-1.5 ring-4 ring-gold/30">
        {src ? (
          // key={src}: AvatarFoto di-mount ulang saat src berubah, sehingga state `gagal` lama tidak terbawa.
          <AvatarFoto key={src} nama={nama} src={src} ukuran="kartu" />
        ) : (
          <AvatarInisial nama={nama} ukuran="kartu" />
        )}
      </span>
      {pesan && (
        <Pesan jenis={pesan.jenis} className="w-full text-left">
          {pesan.teks}
        </Pesan>
      )}
      <div className="w-full text-left">
        <IsianBerkas
          key={putaran}
          label="Foto Profil"
          name="foto"
          accept="image/jpeg,image/png"
          teksTombol="Ubah Foto"
          teksKosong="Belum ada foto baru dipilih"
          keterangan="Format JPG atau PNG, maksimal 2 MB."
          berkas={berkas}
          onPilih={pilih}
          galat={galat}
          disabled={proses}
        />
      </div>
      {berkas && (
        <div className="flex w-full flex-wrap gap-2">
          {!galat && (
            <Tombol type="button" onClick={simpan} disabled={proses}>
              {proses ? "Menyimpan…" : "Simpan Foto"}
            </Tombol>
          )}
          <Tombol type="button" varian="sekunder" onClick={reset} disabled={proses}>
            Batal
          </Tombol>
        </div>
      )}
    </div>
  );
}

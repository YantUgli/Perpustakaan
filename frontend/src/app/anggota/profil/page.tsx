import type { Metadata } from "next";

import { Avatar } from "@/components/ui/Avatar";
import { Kartu } from "@/components/ui/Kartu";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { formatTanggal } from "@/lib/format";

import { FormPassword } from "./FormPassword";
import { FormProfil } from "./FormProfil";

type Profil = components["schemas"]["ProfilKeluar"];

export const metadata: Metadata = { title: "Profil" };

/**
 * FR-AKN-07/08 (data diri) dan FR-AKN-09 (ubah password) — dua form terpisah dengan tombol masing-masing,
 * sehingga ubah data diri tidak mensyaratkan password lama (keputusan pemilik proyek, decisions §B "Menu anggota").
 * ID, NIK, tanggal daftar, dan foto hanya ditampilkan (K-05). NIK tampil utuh karena halaman ini
 * hanya untuk pemiliknya (keputusan P3). Foto dari `GET /anggota/profil/foto` hanya bila `ada_foto`;
 * selain itu, atau bila gagal dimuat, avatar inisial (OQ-42).
 */
export default async function HalamanProfil() {
  const profil = await ambilServer<Profil>("/anggota/profil");
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl sm:text-4xl">Profil Saya</h1>
        <p className="text-navy/80">Perbarui data diri dan password Anda.</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr]">
        <Kartu className="flex flex-col items-center gap-4 text-center">
          <Avatar
            nama={profil.nama}
            src={profil.ada_foto ? "/api/v1/anggota/profil/foto" : null}
            ukuran="besar"
          />
          <p className="font-display text-xl">{profil.nama}</p>
          <dl className="grid w-full grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-left text-sm">
            <dt className="text-navy/70">ID Anggota</dt>
            <dd className="angka font-semibold">{profil.kode}</dd>
            <dt className="text-navy/70">NIK</dt>
            <dd className="angka break-all">{profil.nik}</dd>
            <dt className="text-navy/70">Tanggal daftar</dt>
            <dd className="angka">{formatTanggal(profil.tanggal_daftar)}</dd>
          </dl>
          <p className="text-xs text-navy/70">
            NIK dan foto hanya diisi saat pendaftaran dan tidak dapat diubah. Bila ada kesalahan
            data, hubungi petugas perpustakaan.
          </p>
        </Kartu>
        <div className="flex min-w-0 flex-col gap-6">
          <Kartu className="flex flex-col gap-4 p-5 sm:p-6">
            <h2 className="font-display text-2xl">Data Diri</h2>
            <FormProfil awal={profil} />
          </Kartu>
          <Kartu className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-2xl">Ubah Password</h2>
              <p className="text-sm text-navy/80">
                Masukkan password lama Anda. Setelah diubah, Anda tetap masuk di perangkat ini,
                sedangkan sesi di perangkat lain diakhiri.
              </p>
            </div>
            <FormPassword />
          </Kartu>
        </div>
      </div>
    </section>
  );
}

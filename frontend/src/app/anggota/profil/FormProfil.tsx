"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { AreaIsian } from "@/components/ui/AreaIsian";
import { Isian } from "@/components/ui/Isian";
import { Pesan } from "@/components/ui/Pesan";
import { Tombol } from "@/components/ui/Tombol";
import { ambil } from "@/lib/api-klien";
import type { components } from "@/lib/api-skema";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";
import { validasiProfil } from "@/lib/validasi-akun";

type Profil = components["schemas"]["ProfilKeluar"];
type DataDiri = components["schemas"]["UbahProfilMasuk"];

/**
 * FR-AKN-07/08, K-06: anggota mengubah nama, alamat, email (dicek unik lagi oleh backend), dan telepon.
 * Hanya 4 isian ini yang dikirim — backend menolak isian lain (`extra="forbid"`), termasuk NIK & foto (K-05).
 */
export function FormProfil({ awal }: { awal: Profil }) {
  const router = useRouter();
  const [nilai, setNilai] = useState<DataDiri>({
    nama: awal.nama,
    alamat: awal.alamat,
    email: awal.email,
    telepon: awal.telepon,
  });
  const [galatIsian, setGalatIsian] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<{ jenis: "sukses" | "galat"; teks: string } | null>(null);
  const [proses, setProses] = useState(false);

  const ubah = (k: keyof DataDiri) => (e: { target: { value: string } }) =>
    setNilai((n) => ({ ...n, [k]: e.target.value }));

  async function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPesan(null);
    const galat = validasiProfil(nilai);
    setGalatIsian(galat);
    if (Object.keys(galat).length > 0) return;

    setProses(true);
    try {
      const baru = await ambil<Profil>("/anggota/profil", {
        method: "PUT",
        json: {
          nama: nilai.nama,
          alamat: nilai.alamat,
          email: nilai.email,
          telepon: nilai.telepon,
        },
      });
      setNilai({ nama: baru.nama, alamat: baru.alamat, email: baru.email, telepon: baru.telepon });
      setPesan({ jenis: "sukses", teks: "Data diri berhasil disimpan." });
      router.refresh(); // nama di sidebar/header ikut diperbarui
    } catch (err) {
      if (err instanceof GalatApi) {
        setPesan({ jenis: "galat", teks: err.pesan });
        setGalatIsian(err.isian);
      } else {
        setPesan({ jenis: "galat", teks: PESAN_SISTEM });
      }
    } finally {
      setProses(false);
    }
  }

  return (
    <form onSubmit={kirim} noValidate className="flex flex-col gap-5">
      {pesan && <Pesan jenis={pesan.jenis}>{pesan.teks}</Pesan>}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Isian
          label="Nama Lengkap"
          name="nama"
          autoComplete="name"
          required
          value={nilai.nama}
          onChange={ubah("nama")}
          galat={galatIsian.nama}
        />
        <Isian
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={nilai.email}
          onChange={ubah("email")}
          galat={galatIsian.email}
        />
        <Isian
          label="Nomor Telepon"
          name="telepon"
          type="tel"
          autoComplete="tel"
          required
          value={nilai.telepon}
          onChange={ubah("telepon")}
          galat={galatIsian.telepon}
        />
        {/* hal-16: alamat di kolom kanan, sebaris dengan telepon. */}
        <AreaIsian
          label="Alamat sesuai KTP"
          name="alamat"
          autoComplete="street-address"
          required
          value={nilai.alamat}
          onChange={ubah("alamat")}
          galat={galatIsian.alamat}
        />
      </div>
      <div>
        <Tombol type="submit" disabled={proses}>
          {proses ? "Menyimpan…" : "Simpan Data Diri"}
        </Tombol>
      </div>
    </form>
  );
}

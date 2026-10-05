"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { AreaIsian } from "@/components/ui/AreaIsian";
import { Isian } from "@/components/ui/Isian";
import { Pesan } from "@/components/ui/Pesan";
import { Tombol } from "@/components/ui/Tombol";
import { ambil } from "@/lib/api-klien";
import type { components } from "@/lib/api-skema";
import {
  type NilaiUbahAnggota,
  bodyUbahAnggota,
  pesanSuksesUbahAnggota,
  validasiUbahAnggota,
} from "@/lib/data-admin";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";

type Profil = components["schemas"]["ProfilKeluar"];

/**
 * FR-AKN-11, K-03, K-05: admin mengubah nama, alamat, email (keunikan dicek backend, K-06), telepon, dan
 * opsional menetapkan password baru. Kode dan NIK hanya tampil sebagai teks; foto tidak ditampilkan sebagai
 * isian. Body hanya memuat lima isian (backend menolak yang lain, `extra="forbid"`).
 */
export function FormUbahAnggota({ awal }: { awal: Profil }) {
  const router = useRouter();
  const [nilai, setNilai] = useState<NilaiUbahAnggota>({
    nama: awal.nama,
    alamat: awal.alamat,
    email: awal.email,
    telepon: awal.telepon,
    password_baru: "",
  });
  const [galatIsian, setGalatIsian] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<{ jenis: "sukses" | "galat"; teks: string } | null>(null);
  const [proses, setProses] = useState(false);

  const ubah = (k: keyof NilaiUbahAnggota) => (e: { target: { value: string } }) =>
    setNilai((n) => ({ ...n, [k]: e.target.value }));

  async function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPesan(null);
    const galat = validasiUbahAnggota(nilai);
    setGalatIsian(galat);
    if (Object.keys(galat).length > 0) return;

    const passwordDiubah = nilai.password_baru !== "";
    setProses(true);
    try {
      const baru = await ambil<Profil>(`/admin/anggota/${encodeURIComponent(awal.kode)}`, {
        method: "PUT",
        json: bodyUbahAnggota(nilai),
      });
      setNilai({
        nama: baru.nama,
        alamat: baru.alamat,
        email: baru.email,
        telepon: baru.telepon,
        password_baru: "", // password tidak disimpan di layar setelah dikirim
      });
      setPesan({ jenis: "sukses", teks: pesanSuksesUbahAnggota(passwordDiubah) });
      router.refresh();
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

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border border-line bg-ivory/60 p-4 text-sm">
        <dt className="text-navy/70">ID Anggota</dt>
        <dd className="angka font-medium">{awal.kode}</dd>
        <dt className="text-navy/70">NIK</dt>
        <dd className="angka font-medium">{awal.nik}</dd>
        <dd className="col-span-2 text-xs text-navy/70">ID, NIK, dan foto tidak dapat diubah.</dd>
      </dl>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Isian
          label="Nama Lengkap"
          name="nama"
          required
          value={nilai.nama}
          onChange={ubah("nama")}
          galat={galatIsian.nama}
        />
        <Isian
          label="Email"
          name="email"
          type="email"
          required
          value={nilai.email}
          onChange={ubah("email")}
          galat={galatIsian.email}
        />
        <Isian
          label="Nomor Telepon"
          name="telepon"
          type="tel"
          required
          value={nilai.telepon}
          onChange={ubah("telepon")}
          galat={galatIsian.telepon}
        />
      </div>
      <AreaIsian
        label="Alamat sesuai KTP"
        name="alamat"
        required
        value={nilai.alamat}
        onChange={ubah("alamat")}
        galat={galatIsian.alamat}
      />
      <Isian
        label="Password baru (opsional)"
        name="password_baru"
        type="password"
        autoComplete="new-password"
        value={nilai.password_baru}
        onChange={ubah("password_baru")}
        galat={galatIsian.password_baru}
        keterangan="Kosongkan bila password tidak diubah. Minimal 8 karakter. Semua sesi anggota ini akan diakhiri."
      />

      <div>
        <Tombol type="submit" disabled={proses}>
          {proses ? "Menyimpan…" : "Simpan Perubahan"}
        </Tombol>
      </div>
    </form>
  );
}

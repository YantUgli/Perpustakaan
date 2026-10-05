"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { AreaIsian } from "@/components/ui/AreaIsian";
import { Isian } from "@/components/ui/Isian";
import { IsianBerkas } from "@/components/ui/IsianBerkas";
import { Pesan } from "@/components/ui/Pesan";
import { TautanTombol, Tombol } from "@/components/ui/Tombol";
import { ambil } from "@/lib/api-klien";
import type { components } from "@/lib/api-skema";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";
import { type NilaiDaftar, PANJANG_MIN_PASSWORD, validasiDaftar } from "@/lib/validasi-akun";

type HasilDaftar = components["schemas"]["HasilDaftarKeluar"];

const KOSONG: NilaiDaftar = {
  nama: "",
  alamat: "",
  email: "",
  telepon: "",
  nik: "",
  password: "",
  foto: null,
};

/**
 * FR-AKN-01..04: pendaftaran anggota (multipart). Validasi klien hanya kenyamanan dan menahan pengiriman
 * (P3); keputusan, keunikan NIK/email (FR-AKN-02), dan pemeriksaan isi foto tetap di backend.
 * Sukses → tampilkan kode anggota, tanpa login otomatis (OQ-30).
 */
export function FormDaftar() {
  const [nilai, setNilai] = useState<NilaiDaftar>(KOSONG);
  const [lihatPassword, setLihatPassword] = useState(false);
  const [galatIsian, setGalatIsian] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [proses, setProses] = useState(false);
  const [hasil, setHasil] = useState<HasilDaftar | null>(null);

  const ubah = (k: Exclude<keyof NilaiDaftar, "foto">) => (e: { target: { value: string } }) =>
    setNilai((n) => ({ ...n, [k]: e.target.value }));

  async function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPesan(null);
    const galat = validasiDaftar(nilai);
    setGalatIsian(galat);
    if (Object.keys(galat).length > 0) {
      setPesan("Periksa kembali isian yang ditandai.");
      return;
    }

    const data = new FormData();
    for (const k of ["nama", "alamat", "email", "telepon", "nik", "password"] as const) {
      data.append(k, nilai[k]);
    }
    if (nilai.foto) data.append("foto", nilai.foto);

    setProses(true);
    try {
      setHasil(await ambil<HasilDaftar>("/auth/daftar", { method: "POST", body: data }));
    } catch (err) {
      if (err instanceof GalatApi) {
        setPesan(err.pesan);
        setGalatIsian(err.isian);
      } else {
        setPesan(PESAN_SISTEM);
      }
    } finally {
      setProses(false);
    }
  }

  if (hasil) {
    return (
      <div className="flex flex-col gap-5">
        <Pesan jenis="sukses" judul="Pendaftaran berhasil">
          Akun Anda sudah aktif. Silakan masuk dengan email dan password yang baru saja Anda buat.
        </Pesan>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-navy/70">ID Anggota</dt>
          <dd className="angka font-display text-2xl">{hasil.kode}</dd>
          <dt className="text-navy/70">Nama</dt>
          <dd>{hasil.nama}</dd>
          <dt className="text-navy/70">Email</dt>
          <dd>{hasil.email}</dd>
        </dl>
        <div>
          <TautanTombol href="/masuk">Masuk</TautanTombol>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={kirim} noValidate className="flex flex-col gap-5">
      {pesan && <Pesan jenis="galat">{pesan}</Pesan>}
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
          label="NIK"
          name="nik"
          inputMode="numeric"
          maxLength={16}
          placeholder="16 digit angka"
          required
          value={nilai.nik}
          onChange={ubah("nik")}
          galat={galatIsian.nik}
        />
        <Isian
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nama@email.com"
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
      </div>
      <AreaIsian
        label="Alamat sesuai KTP"
        name="alamat"
        autoComplete="street-address"
        required
        value={nilai.alamat}
        onChange={ubah("alamat")}
        galat={galatIsian.alamat}
      />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1">
          <Isian
            label="Password"
            name="password"
            type={lihatPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            keterangan={`Minimal ${PANJANG_MIN_PASSWORD} karakter.`}
            value={nilai.password}
            onChange={ubah("password")}
            galat={galatIsian.password}
          />
          <label className="flex items-center gap-2 self-start text-sm text-navy/80">
            <input
              type="checkbox"
              checked={lihatPassword}
              onChange={(e) => setLihatPassword(e.target.checked)}
            />
            Tampilkan password
          </label>
        </div>
        <IsianBerkas
          label="Foto (opsional)"
          name="foto"
          accept="image/jpeg,image/png"
          teksTombol="Pilih Foto"
          teksKosong="Belum ada foto dipilih"
          keterangan="Format JPG atau PNG, maksimal 2 MB. Foto tidak dapat diubah setelah pendaftaran."
          berkas={nilai.foto}
          onPilih={(foto) => setNilai((n) => ({ ...n, foto }))}
          galat={galatIsian.foto}
        />
      </div>
      <Pesan jenis="info">
        Setelah pendaftaran berhasil, akun Anda langsung aktif dan Anda mendapatkan ID anggota.
      </Pesan>
      <Tombol type="submit" disabled={proses} className="w-full">
        {proses ? "Memproses…" : "Daftar Menjadi Anggota"}
      </Tombol>
      <p className="text-center text-sm text-navy/80">
        Sudah memiliki akun?{" "}
        <Link
          href="/masuk"
          className="font-semibold text-gold-700 underline-offset-4 hover:underline"
        >
          Masuk di sini
        </Link>
      </p>
    </form>
  );
}

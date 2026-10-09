"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { AreaIsian } from "@/components/ui/AreaIsian";
import { Ikon } from "@/components/ui/Ikon";
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
 * Sukses → tampilkan kode anggota, tanpa login otomatis (OQ-30). Tampilan hal-08 (spec `design/specs/daftar.md`):
 * kepala kartu, ikon isian, tombol mata pola `/masuk`; kepala kartu hanya tampil bersama form, bukan di layar sukses.
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
    <>
      <div className="mb-6 flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-700"
        >
          <Ikon nama="orangIsi" className="size-7" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-display text-2xl font-bold">Form Pendaftaran Anggota</h2>
          <p className="text-sm text-navy/80">
            Lengkapi data diri Anda. Isian bertanda * wajib diisi.
          </p>
        </div>
      </div>
      <form onSubmit={kirim} noValidate className="flex flex-col gap-5">
        {pesan && <Pesan jenis="galat">{pesan}</Pesan>}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Isian
            label="Nama Lengkap"
            name="nama"
            autoComplete="name"
            placeholder="Masukkan nama lengkap Anda"
            required
            value={nilai.nama}
            onChange={ubah("nama")}
            galat={galatIsian.nama}
            awalan={<Ikon nama="orang" />}
          />
          <Isian
            label="NIK"
            name="nik"
            inputMode="numeric"
            maxLength={16}
            placeholder="Masukkan 16 digit NIK"
            required
            value={nilai.nik}
            onChange={ubah("nik")}
            galat={galatIsian.nik}
            awalan={<Ikon nama="ktp" />}
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
            awalan={<Ikon nama="amplop" />}
          />
          <Isian
            label="Nomor Telepon"
            name="telepon"
            type="tel"
            autoComplete="tel"
            placeholder="Contoh: 0812 3456 7890"
            required
            value={nilai.telepon}
            onChange={ubah("telepon")}
            galat={galatIsian.telepon}
            awalan={<Ikon nama="telepon" />}
          />
        </div>
        <AreaIsian
          label="Alamat sesuai KTP"
          name="alamat"
          autoComplete="street-address"
          placeholder="Masukkan alamat sesuai KTP"
          required
          value={nilai.alamat}
          onChange={ubah("alamat")}
          galat={galatIsian.alamat}
          awalan={<Ikon nama="pin" />}
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Isian
            label="Password"
            name="password"
            type={lihatPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            required
            keterangan={`Minimal ${PANJANG_MIN_PASSWORD} karakter.`}
            value={nilai.password}
            onChange={ubah("password")}
            galat={galatIsian.password}
            awalan={<Ikon nama="gembok" />}
            akhiran={
              <button
                type="button"
                aria-label="Tampilkan password"
                aria-pressed={lihatPassword}
                onClick={() => setLihatPassword((v) => !v)}
                className="flex size-11 items-center justify-center rounded-lg text-navy/70 hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-navy"
              >
                <Ikon nama={lihatPassword ? "mataCoret" : "mata"} />
              </button>
            }
          />
          <IsianBerkas
            label="Foto (opsional)"
            name="foto"
            accept="image/jpeg,image/png"
            teksTombol="Pilih Foto"
            teksKosong="Belum ada foto dipilih"
            keterangan="Format JPG atau PNG, maksimal 2 MB. Foto dapat diganti nanti dari halaman Profil."
            berkas={nilai.foto}
            onPilih={(foto) => setNilai((n) => ({ ...n, foto }))}
            galat={galatIsian.foto}
            awalan={<Ikon nama="gambar" />}
          />
        </div>
        {/* Keterangan statis, bukan umpan balik: tanpa role status/alert (pola /masuk). OQ-30. */}
        <div className="flex items-start gap-3 rounded-lg border border-line bg-ivory px-4 py-3 text-sm text-navy">
          <Ikon nama="info" className="mt-0.5 size-5 shrink-0 text-gold-700" />
          <p>
            Setelah pendaftaran berhasil, akun Anda langsung aktif dan Anda mendapatkan ID anggota.
          </p>
        </div>
        <Tombol type="submit" disabled={proses} className="w-full">
          {proses ? (
            "Memproses…"
          ) : (
            <>
              Daftar Menjadi Anggota
              <Ikon nama="panah" className="size-4" />
            </>
          )}
        </Tombol>
        <p className="text-center text-sm text-navy/80">
          Sudah memiliki akun?{" "}
          <Link
            href="/masuk"
            className="inline-flex items-center gap-1 font-semibold text-navy underline-offset-4 hover:underline"
          >
            Masuk di sini
            <Ikon nama="panah" className="size-4" />
          </Link>
        </p>
      </form>
    </>
  );
}

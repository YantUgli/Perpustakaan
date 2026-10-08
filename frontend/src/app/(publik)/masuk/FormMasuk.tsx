"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Isian } from "@/components/ui/Isian";
import { Ikon } from "@/components/ui/Ikon";
import { Pesan } from "@/components/ui/Pesan";
import { Tombol } from "@/components/ui/Tombol";
import { ambil } from "@/lib/api-klien";
import type { components } from "@/lib/api-skema";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";
import { berandaRole } from "@/lib/sesi";
import { validasiMasuk } from "@/lib/validasi-akun";

type ResponsLogin = components["schemas"]["ResponsLogin"];

/**
 * FR-AKN-05: login email + password untuk Admin dan Anggota, lalu ke dashboard sesuai role.
 * Gagal → pesan backend apa adanya ("Email atau password salah.", OQ-16). Tanpa lupa password (K-03).
 */
export function FormMasuk() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lihatPassword, setLihatPassword] = useState(false);
  const [galatIsian, setGalatIsian] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [proses, setProses] = useState(false);

  async function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPesan(null);
    const galat = validasiMasuk({ email, password });
    setGalatIsian(galat);
    if (Object.keys(galat).length > 0) return;

    setProses(true);
    try {
      const hasil = await ambil<ResponsLogin>("/auth/login", {
        method: "POST",
        json: { email: email.trim(), password },
      });
      router.replace(berandaRole(hasil.role));
      router.refresh();
    } catch (err) {
      if (err instanceof GalatApi) {
        setPesan(err.pesan);
        setGalatIsian(err.isian);
      } else {
        setPesan(PESAN_SISTEM);
      }
      setProses(false);
    }
  }

  return (
    <form onSubmit={kirim} noValidate className="flex flex-col gap-4">
      {pesan && <Pesan jenis="galat">{pesan}</Pesan>}
      <Isian
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="nama@email.com"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        galat={galatIsian.email}
        awalan={<Ikon nama="amplop" />}
      />
      <Isian
        label="Password"
        name="password"
        type={lihatPassword ? "text" : "password"}
        autoComplete="current-password"
        placeholder="Masukkan password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
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
      <Tombol type="submit" disabled={proses} className="mt-2 w-full">
        {proses ? (
          "Memproses…"
        ) : (
          <>
            Masuk
            <Ikon nama="panah" className="size-4" />
          </>
        )}
      </Tombol>
      {/* Keterangan statis, bukan umpan balik: tanpa role status/alert. Dua role saja (BR-02). */}
      <div className="flex items-start gap-3 rounded-lg border border-line bg-ivory px-4 py-3 text-sm text-navy">
        <Ikon nama="info" className="mt-0.5 size-5 shrink-0 text-gold-700" />
        <p>
          Setelah berhasil masuk, Anda diarahkan ke dashboard sesuai peran Anda (anggota atau
          admin).
        </p>
      </div>
      <p className="border-t border-line pt-5 text-center text-sm text-navy/80">
        Belum punya akun?{" "}
        <Link
          href="/daftar"
          className="inline-flex items-center gap-1 font-semibold text-navy underline-offset-4 hover:underline"
        >
          Daftar Sekarang
          <Ikon nama="panah" className="size-4" />
        </Link>
      </p>
    </form>
  );
}

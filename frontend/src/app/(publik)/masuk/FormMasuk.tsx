"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Isian } from "@/components/ui/Isian";
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
      />
      <div className="flex flex-col gap-1">
        <Isian
          label="Password"
          name="password"
          type={lihatPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
      <Tombol type="submit" disabled={proses} className="w-full">
        {proses ? "Memproses…" : "Masuk"}
      </Tombol>
      <Pesan jenis="info">
        Setelah berhasil masuk, Anda diarahkan ke dashboard sesuai peran Anda (anggota atau admin).
      </Pesan>
      <p className="text-center text-sm text-navy/80">
        Belum punya akun?{" "}
        <Link
          href="/daftar"
          className="font-semibold text-gold-700 underline-offset-4 hover:underline"
        >
          Daftar sekarang
        </Link>
      </p>
    </form>
  );
}

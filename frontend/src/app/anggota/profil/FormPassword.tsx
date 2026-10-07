"use client";

import { type FormEvent, useState } from "react";

import { Isian } from "@/components/ui/Isian";
import { Pesan } from "@/components/ui/Pesan";
import { Tombol } from "@/components/ui/Tombol";
import { ambil } from "@/lib/api-klien";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";
import { PANJANG_MIN_PASSWORD, validasiGantiPassword } from "@/lib/validasi-akun";

const KOSONG = { password_lama: "", password_baru: "", konfirmasi: "" };

export const PESAN_PASSWORD_BERHASIL =
  "Password berhasil diubah. Sesi Anda di perangkat lain telah diakhiri.";

/**
 * FR-AKN-09: ganti password wajib menyertakan password lama; minimal 8 karakter (NFR-SEC-02).
 * Konfirmasi hanya diperiksa di klien. Backend mencabut sesi lain akun ini (OQ-32).
 */
export function FormPassword() {
  const [nilai, setNilai] = useState(KOSONG);
  const [lihat, setLihat] = useState(false);
  const [galatIsian, setGalatIsian] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<{ jenis: "sukses" | "galat"; teks: string } | null>(null);
  const [proses, setProses] = useState(false);

  const ubah = (k: keyof typeof KOSONG) => (e: { target: { value: string } }) =>
    setNilai((n) => ({ ...n, [k]: e.target.value }));

  async function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPesan(null);
    const galat = validasiGantiPassword(nilai);
    setGalatIsian(galat);
    if (Object.keys(galat).length > 0) return;

    setProses(true);
    try {
      await ambil("/anggota/profil/password", {
        method: "PUT",
        json: { password_lama: nilai.password_lama, password_baru: nilai.password_baru },
      });
      setNilai(KOSONG);
      setPesan({ jenis: "sukses", teks: PESAN_PASSWORD_BERHASIL });
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

  const jenis = lihat ? "text" : "password";
  return (
    <form onSubmit={kirim} noValidate className="flex flex-col gap-5">
      {pesan && <Pesan jenis={pesan.jenis}>{pesan.teks}</Pesan>}
      <Isian
        label="Password Lama"
        name="password_lama"
        type={jenis}
        autoComplete="current-password"
        required
        value={nilai.password_lama}
        onChange={ubah("password_lama")}
        galat={galatIsian.password_lama}
      />
      <Isian
        label="Password Baru"
        name="password_baru"
        type={jenis}
        autoComplete="new-password"
        required
        keterangan={`Minimal ${PANJANG_MIN_PASSWORD} karakter.`}
        value={nilai.password_baru}
        onChange={ubah("password_baru")}
        galat={galatIsian.password_baru}
      />
      <Isian
        label="Konfirmasi Password Baru"
        name="konfirmasi"
        type={jenis}
        autoComplete="new-password"
        required
        value={nilai.konfirmasi}
        onChange={ubah("konfirmasi")}
        galat={galatIsian.konfirmasi}
      />
      <label className="flex items-center gap-2 self-start text-sm text-navy/80">
        <input type="checkbox" checked={lihat} onChange={(e) => setLihat(e.target.checked)} />
        Tampilkan password
      </label>
      <div>
        <Tombol type="submit" disabled={proses}>
          {proses ? "Menyimpan…" : "Ubah Password"}
        </Tombol>
      </div>
    </form>
  );
}

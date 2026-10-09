"use client";

import { type FormEvent, useState } from "react";

import { Ikon } from "@/components/ui/Ikon";
import { Isian } from "@/components/ui/Isian";
import { Pesan } from "@/components/ui/Pesan";
import { Tombol } from "@/components/ui/Tombol";
import { ambil } from "@/lib/api-klien";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";
import { PANJANG_MIN_PASSWORD, validasiGantiPassword } from "@/lib/validasi-akun";

const KOSONG = { password_lama: "", password_baru: "", konfirmasi: "" };

export const PESAN_PASSWORD_BERHASIL =
  "Password berhasil diubah. Sesi Anda di perangkat lain telah diakhiri.";

type Kunci = keyof typeof KOSONG;

/** Tombol mata per isian (keputusan Ayen 09/10/2026, pola `/masuk`): label berbeda agar bisa dibedakan. */
const LABEL_MATA: Record<Kunci, string> = {
  password_lama: "Tampilkan password lama",
  password_baru: "Tampilkan password baru",
  konfirmasi: "Tampilkan konfirmasi password",
};

/**
 * FR-AKN-09: ganti password wajib menyertakan password lama; minimal 8 karakter (NFR-SEC-02).
 * Konfirmasi hanya diperiksa di klien. Backend mencabut sesi lain akun ini (OQ-32). Tiap isian berikon gembok dan
 * punya tombol mata sendiri (menggantikan checkbox "Tampilkan password").
 */
export function FormPassword() {
  const [nilai, setNilai] = useState(KOSONG);
  const [lihat, setLihat] = useState<Record<Kunci, boolean>>({
    password_lama: false,
    password_baru: false,
    konfirmasi: false,
  });
  const [galatIsian, setGalatIsian] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<{ jenis: "sukses" | "galat"; teks: string } | null>(null);
  const [proses, setProses] = useState(false);

  const ubah = (k: Kunci) => (e: { target: { value: string } }) =>
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

  const jenis = (k: Kunci) => (lihat[k] ? "text" : "password");
  const mata = (k: Kunci) => (
    <button
      type="button"
      aria-label={LABEL_MATA[k]}
      aria-pressed={lihat[k]}
      onClick={() => setLihat((l) => ({ ...l, [k]: !l[k] }))}
      className="flex size-11 items-center justify-center rounded-lg text-navy/70 hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-navy"
    >
      <Ikon nama={lihat[k] ? "mataCoret" : "mata"} />
    </button>
  );
  return (
    <form onSubmit={kirim} noValidate className="flex flex-col gap-5">
      {pesan && <Pesan jenis={pesan.jenis}>{pesan.teks}</Pesan>}
      <Isian
        label="Password Lama"
        name="password_lama"
        type={jenis("password_lama")}
        autoComplete="current-password"
        placeholder="Masukkan password lama Anda"
        required
        value={nilai.password_lama}
        onChange={ubah("password_lama")}
        galat={galatIsian.password_lama}
        awalan={<Ikon nama="gembok" />}
        akhiran={mata("password_lama")}
      />
      <Isian
        label="Password Baru"
        name="password_baru"
        type={jenis("password_baru")}
        autoComplete="new-password"
        placeholder="Minimal 8 karakter"
        required
        keterangan={`Minimal ${PANJANG_MIN_PASSWORD} karakter.`}
        value={nilai.password_baru}
        onChange={ubah("password_baru")}
        galat={galatIsian.password_baru}
        awalan={<Ikon nama="gembok" />}
        akhiran={mata("password_baru")}
      />
      <Isian
        label="Konfirmasi Password Baru"
        name="konfirmasi"
        type={jenis("konfirmasi")}
        autoComplete="new-password"
        placeholder="Masukkan kembali password baru"
        required
        value={nilai.konfirmasi}
        onChange={ubah("konfirmasi")}
        galat={galatIsian.konfirmasi}
        awalan={<Ikon nama="gembok" />}
        akhiran={mata("konfirmasi")}
      />
      <div>
        <Tombol type="submit" disabled={proses}>
          {proses ? "Menyimpan…" : "Ubah Password"}
        </Tombol>
      </div>
    </form>
  );
}

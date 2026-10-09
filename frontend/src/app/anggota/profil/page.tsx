import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";

import { fotoHeroBeranda } from "@/assets/foto";
import { Ikon } from "@/components/ui/Ikon";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";

import { KotakInfo } from "../_komponen/KotakInfo";
import { FormPassword } from "./FormPassword";
import { FormProfil } from "./FormProfil";
import { RingkasanProfil } from "./RingkasanProfil";

type Profil = components["schemas"]["ProfilKeluar"];
type HalamanRiwayat = components["schemas"]["HalamanRiwayat"];

export const metadata: Metadata = { title: "Profil" };

const BUTIR_KEAMANAN = ["Minimal 8 karakter", "Setelah diubah, sesi di perangkat lain diakhiri"];

/** Total peminjaman (pelengkap kartu kiri): galat → `null`, halaman & form tetap tampil. */
async function ambilTotalPinjaman(): Promise<number | null> {
  try {
    return (await ambilServer<HalamanRiwayat>("/anggota/riwayat?halaman=1&per_halaman=1")).total;
  } catch (e) {
    unstable_rethrow(e);
    console.error("Riwayat tidak dapat dibaca; kartu Total Peminjaman tidak ditampilkan.", e);
    return null;
  }
}

/**
 * FR-AKN-07/08 (data diri) dan FR-AKN-09 (ubah password) — dua form terpisah dengan tombol masing-masing,
 * sehingga ubah data diri tidak mensyaratkan password lama (keputusan pemilik proyek, decisions §B "Menu anggota").
 * Tata letak hal-16/17 dalam satu halaman (keputusan Ayen 09/10/2026, spec `design/specs/profil.md`). ID, NIK, dan
 * tanggal daftar hanya ditampilkan; NIK utuh sebagai teks karena halaman ini hanya untuk pemiliknya (P3). Foto dari
 * `GET /anggota/profil/foto` hanya bila `ada_foto`; selain itu, atau bila gagal dimuat, avatar inisial (OQ-42).
 */
export default async function HalamanProfil() {
  const [profil, totalPinjaman] = await Promise.all([
    ambilServer<Profil>("/anggota/profil"),
    ambilTotalPinjaman(),
  ]);
  return (
    <section className="flex flex-col gap-6">
      <KepalaHalamanArea
        judul="Profil Saya"
        subjudul="Ubah data diri dan password Anda."
        foto={fotoHeroBeranda}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        <RingkasanProfil profil={profil} totalPinjaman={totalPinjaman} />

        <section
          aria-labelledby="judul-informasi-pribadi"
          className="flex min-w-0 flex-col gap-5 rounded-xl border border-line bg-surface p-5 sm:p-6"
        >
          <div className="flex flex-col gap-1">
            <h2 id="judul-informasi-pribadi" className="font-display text-2xl">
              Informasi Pribadi
            </h2>
            <p className="text-sm text-navy/80">Ubah data diri Anda. NIK tidak dapat diubah.</p>
          </div>
          <FormProfil awal={profil} />

          <div className="flex flex-col gap-4 border-t border-line pt-5">
            <h3 className="font-display text-xl">Informasi Tidak Dapat Diubah</h3>
            <dl className="flex flex-col gap-1.5 text-sm md:max-w-[calc(50%-0.625rem)]">
              <dt className="font-medium">NIK</dt>
              <dd className="angka rounded-lg border border-line bg-navy/5 px-4 py-2.5 break-all text-navy/80">
                {profil.nik}
              </dd>
            </dl>
            <KotakInfo>
              NIK hanya diisi saat pendaftaran dan tidak dapat diubah. Bila ada kesalahan data,
              hubungi petugas perpustakaan.
            </KotakInfo>
          </div>
        </section>
      </div>

      <section
        aria-labelledby="judul-ubah-password"
        className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 sm:p-6"
      >
        <div className="flex flex-col gap-1">
          <h2 id="judul-ubah-password" className="font-display text-2xl">
            Ubah Password
          </h2>
          <p className="text-sm text-navy/80">
            Masukkan password lama Anda. Setelah diubah, Anda tetap masuk di perangkat ini,
            sedangkan sesi di perangkat lain diakhiri.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <FormPassword />
          <aside
            aria-labelledby="judul-keamanan"
            className="flex gap-4 rounded-xl border border-status-dipinjam/30 bg-status-dipinjam-bg p-5 text-status-dipinjam"
          >
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface"
            >
              <Ikon nama="gembok" className="size-6" />
            </span>
            <div className="flex min-w-0 flex-col gap-2 text-sm">
              <h3 id="judul-keamanan" className="font-display text-lg font-semibold">
                Demi Keamanan Akun Anda
              </h3>
              <p>Perubahan password memerlukan password lama sebagai verifikasi identitas.</p>
              <ul className="flex flex-col gap-1.5">
                {BUTIR_KEAMANAN.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Ikon nama="centang" className="mt-0.5 size-4 shrink-0 text-status-tersedia" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </section>
  );
}

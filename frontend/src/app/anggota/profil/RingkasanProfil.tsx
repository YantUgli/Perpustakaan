import { Ikon } from "@/components/ui/Ikon";
import type { components } from "@/lib/api-skema";
import { formatTanggal } from "@/lib/format";

import { KartuRingkas } from "../_komponen/KartuRingkas";
import { UbahFoto } from "./UbahFoto";

type Profil = components["schemas"]["ProfilKeluar"];

/**
 * Kartu kiri Profil Saya (hal-16): foto (OQ-42, bila `ada_foto`; gagal muat → inisial) atau inisial beserta ubah foto
 * sendiri (`UbahFoto`, OQ-48), nama, ID
 * Anggota, Tanggal Bergabung, dan Total Peminjaman (`total` riwayat, FR-AGT-03; tidak dirender bila riwayat gagal).
 * Tanpa lencana "Aktif", jenis keanggotaan, maupun status (§13, ∅API). NIK ada di panel Informasi Pribadi.
 */
export function RingkasanProfil({
  profil,
  totalPinjaman,
}: {
  profil: Profil;
  totalPinjaman: number | null;
}) {
  return (
    <section
      aria-label="Ringkasan profil"
      className="flex flex-col items-center gap-5 rounded-xl border border-line bg-surface p-5 text-center sm:p-6"
    >
      <div className="flex w-full flex-col items-center gap-3">
        <UbahFoto nama={profil.nama} adaFoto={profil.ada_foto} />
        <p className="font-display text-2xl leading-tight wrap-break-word">{profil.nama}</p>
      </div>

      <dl className="flex w-full flex-col divide-y divide-line border-y border-line text-left text-sm">
        <div className="flex items-center gap-3 py-3">
          <Ikon nama="orang" className="size-5 shrink-0 text-gold-700" />
          <dt className="text-navy/70">ID Anggota</dt>
          <dd className="angka ml-auto font-semibold">{profil.kode}</dd>
        </div>
        <div className="flex items-center gap-3 py-3">
          <Ikon nama="kalender" className="size-5 shrink-0 text-gold-700" />
          <dt className="text-navy/70">Tanggal Bergabung</dt>
          <dd className="angka ml-auto">{formatTanggal(profil.tanggal_daftar)}</dd>
        </div>
      </dl>

      {totalPinjaman !== null && (
        <div className="w-full text-left">
          <KartuRingkas
            href="/anggota/riwayat"
            label="Total Peminjaman"
            ikon="bukuIsi"
            nada="biru"
            nilai={totalPinjaman}
            satuan="buku"
          />
        </div>
      )}
    </section>
  );
}

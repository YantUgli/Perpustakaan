import { Ikon } from "@/components/ui/Ikon";
import { TautanTombol } from "@/components/ui/Tombol";
import type { components } from "@/lib/api-skema";

type Profil = components["schemas"]["ProfilKeluar"];

/**
 * "Informasi Anggota" di halaman QR (hal-10, FR-AKN-07): hanya tampilan; ubah data lewat `/anggota/profil`.
 * NIK sengaja tidak ditampilkan (P3: NIK tidak di halaman QR).
 */
export function InformasiAnggota({ profil }: { profil: Profil }) {
  const baris: [string, string][] = [
    ["Nama Lengkap", profil.nama],
    ["Email", profil.email],
    ["Telepon", profil.telepon],
    ["Alamat", profil.alamat],
  ];
  return (
    <section
      aria-labelledby="judul-informasi-anggota"
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="judul-informasi-anggota" className="flex items-center gap-3 font-display text-xl">
          <Ikon nama="orang" className="size-6 shrink-0 text-navy" />
          Informasi Anggota
        </h2>
        <TautanTombol href="/anggota/profil" varian="sekunder" className="min-h-9 px-4">
          Edit Profil
        </TautanTombol>
      </div>
      <dl className="flex flex-col divide-y divide-line text-sm">
        {baris.map(([label, isi]) => (
          <div
            key={label}
            className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 py-2.5 first:pt-0 last:pb-0"
          >
            <dt className="text-navy/70">{label}</dt>
            <dd className="wrap-break-word">{isi}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

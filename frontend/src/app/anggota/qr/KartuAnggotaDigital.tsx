import { Avatar } from "@/components/ui/Avatar";
import { Ikon } from "@/components/ui/Ikon";
import { KodeQr } from "@/components/ui/KodeQr";
import { Logo } from "@/components/ui/Logo";
import type { components } from "@/lib/api-skema";
import { formatTanggal } from "@/lib/format";

type Qr = components["schemas"]["QrKeluar"];
type Profil = components["schemas"]["ProfilKeluar"];

/**
 * Kartu anggota digital (hal-10, FR-AGT-01, BR-04): QR dari `isi_qr` apa adanya + nama + ID dari `/anggota/qr`.
 * `profil` opsional: foto (OQ-42, hanya bila `ada_foto`) dan "Bergabung Sejak" (`tanggal_daftar`); bila profil
 * gagal dimuat, kartu tetap tampil dengan avatar inisial. Tanpa status "Aktif", "Jenis Anggota" (∅API, §13), dan
 * tanpa NIK (P3). Di bawah `xl` QR berada di atas identitas (halaman ini dibuka di ponsel untuk dipindai).
 */
export function KartuAnggotaDigital({ qr, profil }: { qr: Qr; profil: Profil | null }) {
  return (
    <article
      aria-label="Kartu anggota digital"
      className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-4 border-gold bg-navy px-5 py-5 sm:px-8">
        <div className="flex flex-col gap-1.5">
          <Logo latar="gelap" />
          <span className="text-xs tracking-[0.3em] text-ivory/80 uppercase">
            Kartu Anggota Digital
          </span>
        </div>
        <span className="text-sm text-ivory">Perpustakaan Naratif</span>
      </div>

      <div className="grid gap-6 p-3 sm:p-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center xl:p-6 2xl:p-8">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-line bg-white p-2 sm:p-4 xl:order-last">
          <KodeQr isi={qr.isi_qr} ukuran={256} judul={`QR anggota ${qr.kode}`} />
          <p className="text-sm text-navy/70">Dipindai oleh petugas perpustakaan</p>
          <span aria-hidden="true" className="h-0.5 w-10 rounded-full bg-gold" />
        </div>

        <div className="flex min-w-0 flex-col items-center gap-3 text-center">
          <span className="rounded-full p-1.5 ring-4 ring-gold/30">
            <Avatar
              nama={qr.nama}
              src={profil?.ada_foto ? "/api/v1/anggota/profil/foto" : null}
              ukuran="kartu"
            />
          </span>
          <p className="font-display text-3xl leading-tight wrap-break-word">{qr.nama}</p>
          <div className="flex flex-col">
            <span className="text-sm text-navy/70">ID Anggota</span>
            <span className="angka text-2xl font-bold tracking-wide">{qr.kode}</span>
          </div>
          {profil && (
            <div className="mt-2 flex items-center gap-3 border-t border-line pt-4 text-left">
              <Ikon nama="kalender" className="size-7 shrink-0 text-gold-700" />
              <div className="flex flex-col">
                <span className="text-xs text-navy/70">Bergabung Sejak</span>
                <span className="angka">{formatTanggal(profil.tanggal_daftar)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

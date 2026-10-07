import Image from "next/image";
import type { ReactNode } from "react";

import { fotoHeroTentang, fotoProfilTentang } from "@/assets/foto";
import { KartuCtaDaftar } from "@/components/publik/KartuCtaDaftar";
import { PanelHero } from "@/components/publik/PanelHero";
import { Ikon, type NamaIkon } from "@/components/ui/Ikon";
import type { BagianTentang } from "@/lib/info-perpustakaan";
import { KONTAINER } from "@/lib/tata-letak";

/** Ikon kartu nilai menurut urutan (hanya tampilan; keputusan 3: kartu tanpa judul). */
const IKON_NILAI: NamaIkon[] = ["bukuIsi", "timbanganIsi", "daunIsi"];

/** Ikon kartu fasilitas dari kata kunci teksnya (hanya tampilan); urutan penting: "qr" sebelum "petugas". */
const IKON_FASILITAS: [string, NamaIkon][] = [
  ["katalog", "laptopIsi"],
  ["qr", "qrIsi"],
  ["peminjaman", "bukuIsi"],
  ["area anggota", "orangIsi"],
  ["ruang baca", "kursiIsi"],
  ["petugas", "bantuanIsi"],
];

const IKON_LOKASI: Record<string, NamaIkon> = {
  Alamat: "pinIsi",
  "Jam Buka": "jamIsi",
  Kontak: "teleponIsi",
};

const SLOT = ["Profil", "Nilai / Visi", "Fasilitas & Layanan", "Alamat", "Jam Buka", "Kontak"];

function ikonFasilitas(teks: string): NamaIkon {
  const kecil = teks.toLowerCase();
  return IKON_FASILITAS.find(([kunci]) => kecil.includes(kunci))?.[1] ?? "bukuIsi";
}

function Penanda({ menunggu }: { menunggu: string }) {
  return (
    <p
      data-penanda
      className="rounded-lg border border-dashed border-gold-700/60 bg-surface px-4 py-3 text-sm text-gold-700"
    >
      [PENANDA] Menunggu data dari pengelola perpustakaan: {menunggu}.
    </p>
  );
}

/** Teks dengan label tebal sampai titik dua PERTAMA; `textContent` tetap sama persis dengan data. */
function TeksBerlabel({ teks }: { teks: string }) {
  const titik = teks.indexOf(":");
  if (titik < 0) return teks;
  return (
    <>
      <strong className="font-semibold">{teks.slice(0, titik + 1)}</strong>
      {teks.slice(titik + 1)}
    </>
  );
}

/** Judul bagian + garis gold (hal-06). Garisnya di dalam h2 agar `parentElement` h2 tetap bagiannya. */
function JudulBagian({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="flex items-center gap-4 font-display text-2xl sm:text-3xl lg:text-4xl lg:font-semibold"
    >
      {children}
      <span aria-hidden="true" className="block h-0.5 w-12 shrink-0 bg-gold" />
    </h2>
  );
}

function idBagian(judul: string) {
  return `bagian-${judul.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

/** Isi standar sebuah bagian: paragraf, daftar, dan penanda bila datanya belum ada. */
function IsiStandar({ b, paragraf = b.paragraf }: { b: BagianTentang; paragraf?: string[] }) {
  return (
    <>
      {paragraf?.map((t) => (
        <p key={t} className="text-sm leading-relaxed text-navy/85 sm:text-base">
          {t}
        </p>
      ))}
      {b.daftar && (
        <ul className="space-y-1.5 text-sm leading-relaxed">
          {b.daftar.map((t) => (
            <li key={t}>
              <TeksBerlabel teks={t} />
            </li>
          ))}
        </ul>
      )}
      {b.menunggu && <Penanda menunggu={b.menunggu} />}
    </>
  );
}

/**
 * FR-KTL-05: isi halaman Tentang dengan tata letak hal-06 (susulan 5.4.2). Seluruh teks faktual dari `bagian`
 * apa adanya: paragraf pertama Profil utuh menjadi pembuka hero (keputusan 1), kartu nilai tanpa judul
 * (keputusan 3), fasilitas berlabel sampai titik dua pertama, lokasi tanpa tautan peta (keputusan 4), kartu CTA
 * bersama beranda (keputusan 5, BR-03). Angka, e-book, dan reservasi hal-06 dibuang; foto hero & foto samping
 * Profil hanya dekoratif (`alt=""`, bukan foto ruangan perpustakaan yang sebenarnya). Setiap slot bagian
 * menampilkan penanda bila `menunggu` terisi; bagian di luar enam slot tetap ditampilkan (tidak hilang diam-diam).
 */
export function IsiTentang({ bagian }: { bagian: BagianTentang[] }) {
  const cari = (judul: string) => bagian.find((b) => b.judul === judul);
  const profil = cari("Profil");
  const nilai = cari("Nilai / Visi");
  const fasilitas = cari("Fasilitas & Layanan");
  const lokasi = ["Alamat", "Jam Buka", "Kontak"].map(cari).filter((b) => b !== undefined);
  const lainnya = bagian.filter((b) => !SLOT.includes(b.judul));
  const [pembuka, ...sisaProfil] = profil?.paragraf ?? [];

  return (
    <>
      <section
        aria-labelledby="judul-halaman"
        className="relative overflow-hidden border-b border-line"
      >
        <div className={`${KONTAINER} py-12 sm:py-16 lg:py-20`}>
          <div className="relative z-10 flex flex-col gap-5 lg:w-1/2 lg:pr-12">
            <p className="text-xs font-semibold tracking-[0.3em] text-gold-700 uppercase">
              Tentang Kami
            </p>
            <h1
              id="judul-halaman"
              className="font-display text-4xl leading-tight sm:text-5xl lg:font-semibold 2xl:text-6xl"
            >
              Tentang Perpustakaan Naratif
            </h1>
            <span aria-hidden="true" className="block h-0.5 w-20 bg-gold" />
            {pembuka && <p className="leading-relaxed text-navy/80 sm:text-lg">{pembuka}</p>}
          </div>
        </div>
        <PanelHero foto={fotoHeroTentang} />
      </section>

      {(profil || nilai) && (
        <div
          className={`${KONTAINER} grid gap-12 py-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-x-16 lg:gap-y-8 lg:py-16 2xl:grid-cols-[minmax(0,4fr)_minmax(0,4fr)_minmax(0,6fr)] 2xl:gap-12`}
        >
          {profil && (
            <section
              aria-labelledby={idBagian(profil.judul)}
              className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1"
            >
              <JudulBagian id={idBagian(profil.judul)}>{profil.judul}</JudulBagian>
              <IsiStandar b={profil} paragraf={sisaProfil} />
            </section>
          )}
          {/* hal-06: foto mulai `lg` (di bawahnya tidak diunduh). `lg`: di bawah teks Profil (kolom kiri);
              `2xl`: kolom tengah antara Profil dan Nilai seperti desain. */}
          {profil && (
            <div
              aria-hidden="true"
              className="relative hidden aspect-[4/3] overflow-hidden rounded-2xl bg-line/40 lg:col-start-1 lg:row-start-2 lg:block 2xl:col-start-2 2xl:row-start-1 2xl:aspect-auto 2xl:min-h-80"
            >
              <Image
                src={fotoProfilTentang}
                alt=""
                fill
                sizes="(min-width: 1536px) 25vw, 40vw"
                className="object-cover object-[50%_60%]"
              />
            </div>
          )}
          {nilai && (
            <section
              aria-labelledby={idBagian(nilai.judul)}
              className="flex flex-col gap-5 lg:col-start-2 lg:row-span-2 lg:row-start-1 2xl:col-start-3 2xl:row-span-1"
            >
              <JudulBagian id={idBagian(nilai.judul)}>{nilai.judul}</JudulBagian>
              {nilai.paragraf?.map((t) => (
                <p key={t} className="text-sm leading-relaxed text-navy/85">
                  {t}
                </p>
              ))}
              {nilai.daftar && (
                <ul className="grid gap-4 sm:grid-cols-3">
                  {nilai.daftar.map((t, i) => (
                    <li
                      key={t}
                      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5"
                    >
                      <span
                        aria-hidden="true"
                        className="flex size-14 items-center justify-center rounded-full bg-gold/15 text-gold"
                      >
                        <Ikon nama={IKON_NILAI[i % IKON_NILAI.length]} className="size-7" />
                      </span>
                      <span className="text-sm leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ul>
              )}
              {nilai.menunggu && <Penanda menunggu={nilai.menunggu} />}
            </section>
          )}
        </div>
      )}

      {fasilitas && (
        <div className="border-y border-line bg-surface">
          <section
            aria-labelledby={idBagian(fasilitas.judul)}
            className={`${KONTAINER} grid gap-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:items-start lg:gap-12 lg:py-16`}
          >
            <JudulBagian id={idBagian(fasilitas.judul)}>{fasilitas.judul}</JudulBagian>
            <div className="flex flex-col gap-4">
              {fasilitas.paragraf?.map((t) => (
                <p key={t} className="text-sm leading-relaxed text-navy/85">
                  {t}
                </p>
              ))}
              {fasilitas.daftar && (
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {fasilitas.daftar.map((t) => (
                    <li
                      key={t}
                      className="flex items-start gap-4 rounded-xl border border-line bg-ivory p-5"
                    >
                      <span
                        aria-hidden="true"
                        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold"
                      >
                        <Ikon nama={ikonFasilitas(t)} className="size-6" />
                      </span>
                      <span className="text-sm leading-relaxed">
                        <TeksBerlabel teks={t} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {fasilitas.menunggu && <Penanda menunggu={fasilitas.menunggu} />}
            </div>
          </section>
        </div>
      )}

      {lokasi.length > 0 && (
        <div className={`${KONTAINER} py-12 lg:py-16`}>
          <div className="grid divide-y divide-line rounded-2xl border border-line bg-surface lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {lokasi.map((b) => (
              <div key={b.judul} className="flex gap-4 p-6 sm:p-8">
                <span
                  aria-hidden="true"
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold"
                >
                  <Ikon nama={IKON_LOKASI[b.judul]} className="size-6" />
                </span>
                <section
                  aria-labelledby={idBagian(b.judul)}
                  className="flex min-w-0 flex-1 flex-col gap-2"
                >
                  <h2 id={idBagian(b.judul)} className="font-display text-xl sm:text-2xl">
                    {b.judul}
                  </h2>
                  <IsiStandar b={b} />
                </section>
              </div>
            ))}
          </div>
        </div>
      )}

      {lainnya.length > 0 && (
        <div className={`${KONTAINER} grid gap-8 pb-12 sm:grid-cols-2 lg:grid-cols-3`}>
          {lainnya.map((b) => (
            <section
              key={b.judul}
              aria-labelledby={idBagian(b.judul)}
              className="flex flex-col gap-2"
            >
              <h2 id={idBagian(b.judul)} className="font-display text-xl sm:text-2xl">
                {b.judul}
              </h2>
              <IsiStandar b={b} />
            </section>
          ))}
        </div>
      )}

      <div className={`${KONTAINER} pb-14`}>
        <KartuCtaDaftar className="lg:px-12 lg:py-10" />
      </div>
    </>
  );
}

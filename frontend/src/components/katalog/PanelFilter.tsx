import Link from "next/link";

import { kelasTombol } from "@/components/ui/Tombol";
import { type FilterKatalog, type Kategori, urlReset } from "@/lib/katalog";

import { LipatFilter } from "./LipatFilter";

/** Kategori yang selalu tampil; sisanya di balik "Lihat lebih banyak" (hal-03). */
const KATEGORI_TAMPIL = 8;

const KELAS_CENTANG = "size-4 shrink-0 accent-gold-700";
const KELAS_ISIAN =
  "min-h-11 w-full min-w-0 rounded-lg border border-navy/30 bg-surface px-3 py-2 text-navy placeholder:text-navy/40 focus:outline-2 focus:outline-offset-1 focus:outline-navy";

function Kotak({ nama, id, centang }: { nama: string; id: number; centang: boolean }) {
  return (
    <li>
      <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm text-navy">
        <input
          type="checkbox"
          name="kategori_id"
          value={String(id)}
          defaultChecked={centang}
          className={KELAS_CENTANG}
        />
        <span className="min-w-0">{nama}</span>
      </label>
    </li>
  );
}

/**
 * OQ-44 (hal-03/04): panel "Filter Pencarian" = form GET ke `/katalog`. Membawa `q` & `urut` sebagai hidden dan
 * TIDAK membawa `halaman` (filter baru → halaman 1). Tanpa hitungan per kategori/tahun (∅API). Isian tahun teks
 * bebas tanpa min/max: batas ≥ 1 dan dari ≤ sampai diputuskan backend (IR-UI-04).
 */
export function PanelFilter({ filter, kategori }: { filter: FilterKatalog; kategori: Kategori[] }) {
  const terpilih = new Set(filter.kategori_id ?? []);
  // Kategori tercentang selalu terlihat walau di luar 8 teratas (filter aktif tidak disembunyikan).
  const tampil = kategori.filter((k, i) => i < KATEGORI_TAMPIL || terpilih.has(String(k.id)));
  const lainnya = kategori.filter((k) => !tampil.includes(k));

  return (
    <LipatFilter id="panel-filter">
      <section
        aria-labelledby="judul-filter"
        className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="judul-filter" className="font-display text-lg whitespace-nowrap">
            Filter Pencarian
          </h2>
          <Link
            href={urlReset(filter)}
            className="shrink-0 text-sm font-medium whitespace-nowrap text-gold-700 underline-offset-4 hover:underline"
          >
            Reset Semua
          </Link>
        </div>
        <form
          method="get"
          action="/katalog"
          aria-label="Filter Pencarian"
          className="flex flex-col gap-5"
        >
          {filter.q !== undefined && <input type="hidden" name="q" value={filter.q} />}
          {filter.urut !== undefined && <input type="hidden" name="urut" value={filter.urut} />}

          <div className="border-t border-line pt-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="pb-2 text-base font-semibold text-navy">Kategori</legend>
              {kategori.length === 0 ? (
                <p className="text-sm text-navy/70">Belum ada kategori.</p>
              ) : (
                <>
                  <ul className="flex flex-col">
                    {tampil.map((k) => (
                      <Kotak
                        key={k.id}
                        nama={k.nama}
                        id={k.id}
                        centang={terpilih.has(String(k.id))}
                      />
                    ))}
                  </ul>
                  {lainnya.length > 0 && (
                    <details className="group">
                      <summary className="cursor-pointer py-1 text-sm font-medium text-gold-700">
                        Lihat lebih banyak ({lainnya.length})
                      </summary>
                      <ul className="flex flex-col">
                        {lainnya.map((k) => (
                          <Kotak key={k.id} nama={k.nama} id={k.id} centang={false} />
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </fieldset>
          </div>

          <div className="border-t border-line pt-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="pb-2 text-base font-semibold text-navy">Ketersediaan</legend>
              <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm text-navy">
                <input
                  type="checkbox"
                  name="tersedia"
                  value="true"
                  defaultChecked={filter.tersedia === true}
                  className={KELAS_CENTANG}
                />
                Tersedia sekarang
              </label>
            </fieldset>
          </div>

          <div className="border-t border-line pt-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="pb-2 text-base font-semibold text-navy">Tahun Terbit</legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm text-navy/80">
                  Dari
                  <input
                    type="text"
                    inputMode="numeric"
                    name="tahun_dari"
                    aria-label="Tahun terbit dari"
                    defaultValue={filter.tahun_dari ?? ""}
                    placeholder="mis. 2000"
                    className={KELAS_ISIAN}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-navy/80">
                  Sampai
                  <input
                    type="text"
                    inputMode="numeric"
                    name="tahun_sampai"
                    aria-label="Tahun terbit sampai"
                    defaultValue={filter.tahun_sampai ?? ""}
                    placeholder="mis. 2024"
                    className={KELAS_ISIAN}
                  />
                </label>
              </div>
            </fieldset>
          </div>

          <button type="submit" className={kelasTombol("primer", "w-full")}>
            Terapkan
          </button>
        </form>
      </section>
    </LipatFilter>
  );
}

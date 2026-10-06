import type { Metadata } from "next";

import { BAGIAN_TENTANG } from "@/lib/info-perpustakaan";
import { KONTAINER } from "@/lib/tata-letak";

export const metadata: Metadata = { title: "Tentang Perpustakaan" };

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

/** FR-KTL-05: halaman Tentang Perpustakaan tanpa login. */
export default function Tentang() {
  return (
    <section className={`${KONTAINER} flex flex-col gap-8 py-10`}>
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl sm:text-4xl">Tentang Perpustakaan</h1>
        <span aria-hidden="true" className="block h-0.5 w-20 bg-gold" />
      </header>
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {BAGIAN_TENTANG.map((b) => (
          <section key={b.judul} className="flex flex-col gap-2">
            <h2 className="font-display text-xl">{b.judul}</h2>
            {b.paragraf?.map((t) => (
              <p key={t} className="text-sm leading-relaxed">
                {t}
              </p>
            ))}
            {b.daftar && (
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {b.daftar.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            {b.menunggu && <Penanda menunggu={b.menunggu} />}
          </section>
        ))}
      </div>
    </section>
  );
}

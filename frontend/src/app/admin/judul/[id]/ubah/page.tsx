import type { Metadata } from "next";
import Link from "next/link";

import { Kartu } from "@/components/ui/Kartu";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";

import { FormJudul } from "../../FormJudul";
import { ambilJudul, idJudulAtau404 } from "../../ambil-judul";

export const metadata: Metadata = { title: "Ubah Judul" };

/** FR-BKU-02, FR-BKU-03: ubah data judul; cover hanya dapat diganti (OQ-19). */
export default async function UbahJudul({ params }: { params: Promise<{ id: string }> }) {
  const id = idJudulAtau404((await params).id);
  const [judul, kategori] = await Promise.all([
    ambilJudul(id),
    ambilServer<components["schemas"]["KategoriKeluar"][]>("/admin/kategori"),
  ]);
  return (
    <section className="flex flex-col gap-6">
      <Link href={`/admin/judul/${judul.id}`} className="text-sm font-semibold text-gold-700">
        ← Kembali ke detail judul
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl sm:text-4xl">Ubah Judul</h1>
        <p className="text-navy/80">{judul.judul}</p>
      </header>
      <Kartu>
        <FormJudul kategori={kategori} awal={judul} />
      </Kartu>
    </section>
  );
}

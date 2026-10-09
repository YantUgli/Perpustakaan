import type { Metadata } from "next";
import Link from "next/link";

import { Kartu } from "@/components/ui/Kartu";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";
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
      <KepalaHalamanArea judul="Ubah Judul" subjudul={judul.judul} />
      <Kartu>
        <FormJudul kategori={kategori} awal={judul} />
      </Kartu>
    </section>
  );
}

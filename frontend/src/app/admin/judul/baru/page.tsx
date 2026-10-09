import type { Metadata } from "next";
import Link from "next/link";

import { Kartu } from "@/components/ui/Kartu";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";

import { FormJudul } from "../FormJudul";

export const metadata: Metadata = { title: "Tambah Judul" };

/** FR-BKU-02: judul baru. Eksemplar ditambahkan setelah judul tersimpan (FR-BKU-04). */
export default async function JudulBaru() {
  const kategori = await ambilServer<components["schemas"]["KategoriKeluar"][]>("/admin/kategori");
  return (
    <section className="flex flex-col gap-6">
      <Link href="/admin/judul" className="text-sm font-semibold text-gold-700">
        ← Kembali ke data buku
      </Link>
      <KepalaHalamanArea
        judul="Tambah Judul"
        subjudul="Isi data judul. Eksemplar ditambahkan sesudah judul tersimpan."
      />
      <Kartu>
        <FormJudul kategori={kategori} />
      </Kartu>
    </section>
  );
}

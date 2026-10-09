import type { Metadata } from "next";

import { fotoHeroBeranda } from "@/assets/foto";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";

import { DaftarMaster } from "../_komponen/DaftarMaster";

export const metadata: Metadata = { title: "Kategori" };

/** FR-BKU-01, DR-03: kelola kategori. Daftar penuh dari API (tanpa halaman, urut A–Z). */
export default async function HalamanKategori() {
  const data = await ambilServer<components["schemas"]["KategoriKeluar"][]>("/admin/kategori");
  return (
    <section className="flex flex-col gap-6">
      <KepalaHalamanArea
        judul="Kategori"
        subjudul="Kelola kategori untuk mengelompokkan judul buku."
        foto={fotoHeroBeranda}
      />
      <DaftarMaster jenis="kategori" data={data} />
    </section>
  );
}

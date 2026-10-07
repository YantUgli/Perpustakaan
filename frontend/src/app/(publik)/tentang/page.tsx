import type { Metadata } from "next";

import { IsiTentang } from "@/components/publik/IsiTentang";
import { BAGIAN_TENTANG } from "@/lib/info-perpustakaan";

export const metadata: Metadata = { title: "Tentang Perpustakaan" };

/** FR-KTL-05: halaman Tentang Perpustakaan tanpa login (tata letak hal-06, `IsiTentang`). */
export default function Tentang() {
  return <IsiTentang bagian={BAGIAN_TENTANG} />;
}

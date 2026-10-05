import type { ReactNode } from "react";

import { FooterPublik } from "@/components/layout/FooterPublik";
import { HeaderPublik } from "@/components/layout/HeaderPublik";
import { ambilSesiAtauTamu } from "@/lib/api-server";

/**
 * Layout situs publik (BR-01: tanpa login). Sesi hanya untuk menampilkan menu pengguna; bila backend
 * tak terjangkau, header tampil sebagai pengunjung agar katalog tetap terbuka (asumsi rencana 5.4.1).
 */
export default async function LayoutPublik({ children }: { children: ReactNode }) {
  const sesi = await ambilSesiAtauTamu();
  return (
    <>
      <HeaderPublik sesi={sesi} />
      <main className="flex-1">{children}</main>
      <FooterPublik />
    </>
  );
}

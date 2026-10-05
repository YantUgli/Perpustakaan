import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";

import { FooterPublik } from "@/components/layout/FooterPublik";
import { HeaderPublik } from "@/components/layout/HeaderPublik";
import { ambilSesiServer } from "@/lib/api-server";
import type { Sesi } from "@/lib/sesi";

/**
 * Layout situs publik (BR-01: tanpa login). Sesi hanya untuk menampilkan menu pengguna; bila backend
 * tak terjangkau, header tampil sebagai pengunjung agar katalog tetap terbuka (asumsi rencana 5.4.1).
 */
async function sesiAtauTamu(): Promise<Sesi | null> {
  try {
    return await ambilSesiServer();
  } catch (e) {
    // Sinyal internal Next (rute dinamis karena cookies(), redirect) wajib diteruskan, bukan ditelan.
    unstable_rethrow(e);
    console.error("Header publik: sesi tidak dapat dibaca, tampil sebagai pengunjung.", e);
    return null;
  }
}

export default async function LayoutPublik({ children }: { children: ReactNode }) {
  const sesi = await sesiAtauTamu();
  return (
    <>
      <HeaderPublik sesi={sesi} />
      <main className="flex-1">{children}</main>
      <FooterPublik />
    </>
  );
}

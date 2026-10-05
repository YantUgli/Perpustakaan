import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SidebarArea } from "@/components/layout/SidebarArea";
import { ambilSesiServer } from "@/lib/api-server";
import { tujuanArea } from "@/lib/sesi";

/**
 * Area anggota (FR-AKN-05). Belum login → /masuk; admin → /admin. Galat backend tidak disamarkan sebagai
 * belum login: diteruskan ke app/error.tsx. Hak akses sesungguhnya tetap di backend (NFR-SEC-03).
 */
export default async function LayoutAnggota({ children }: { children: ReactNode }) {
  const sesi = await ambilSesiServer();
  const tujuan = tujuanArea(sesi, "anggota");
  if (tujuan || !sesi) redirect(tujuan ?? "/masuk");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <SidebarArea varian="anggota" nama={sesi.nama} />
      <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}

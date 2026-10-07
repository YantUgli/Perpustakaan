import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SidebarArea } from "@/components/layout/SidebarArea";
import { ambilSesiServer } from "@/lib/api-server";
import { tujuanArea } from "@/lib/sesi";

/**
 * Area admin (FR-AKN-05). Belum login → /masuk; anggota → /anggota. Sidebar navy + aksen gold (K8);
 * < lg menjadi bilah atas + laci agar halaman sirkulasi dapat dipakai di 360 px (IR-UI-01).
 */
export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  const sesi = await ambilSesiServer();
  const tujuan = tujuanArea(sesi, "admin");
  if (tujuan || !sesi) redirect(tujuan ?? "/masuk");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row print:block">
      {/* Cetak (label A4, 5.4.7): navigasi tidak ikut tercetak. */}
      <div className="contents print:hidden">
        <SidebarArea varian="admin" nama={sesi.nama} />
      </div>
      <main className="flex-1 px-4 py-6 sm:px-8 print:p-0">{children}</main>
    </div>
  );
}

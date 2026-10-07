import { redirect } from "next/navigation";

/** `/admin/laporan` tanpa jenis → laporan transaksi (item menu "Laporan" juga menuju ke sana). */
export default function LaporanAdmin(): never {
  redirect("/admin/laporan/transaksi");
}

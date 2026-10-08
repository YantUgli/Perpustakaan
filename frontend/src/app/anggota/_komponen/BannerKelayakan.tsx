import { Ikon } from "@/components/ui/Ikon";
import { TautanTombol } from "@/components/ui/Tombol";
import type { components } from "@/lib/api-skema";
import { judulAlasan } from "@/lib/area-anggota";

type Kelayakan = components["schemas"]["KelayakanKeluar"];

/**
 * FR-AGT-05 (hal-09): status kelayakan dari `GET /anggota/kelayakan` saja. Layak → ajakan ke katalog. Tidak layak →
 * judul "Anda …" dari `alasan[].kode` dan `pesan` backend apa adanya (IR-UI-04), tanpa tombol katalog.
 */
export function BannerKelayakan({ kelayakan }: { kelayakan: Kelayakan }) {
  const layak = kelayakan.layak;
  return (
    <div
      role={layak ? "status" : "alert"}
      className={`flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center ${
        layak
          ? "border-status-tersedia/30 bg-status-tersedia-bg"
          : "border-status-terlambat/30 bg-status-terlambat-bg"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex size-12 shrink-0 items-center justify-center rounded-full text-white ${
          layak ? "bg-status-tersedia" : "bg-status-terlambat"
        }`}
      >
        <Ikon nama={layak ? "centang" : "seru"} className="size-7 [stroke-width:2.5]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {layak ? (
          <>
            <p className="font-display text-xl text-navy">Anda dapat meminjam buku</p>
            <p className="text-sm text-navy/80">
              Tidak ada buku yang terlambat dan tidak ada tagihan yang belum lunas.
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-xl text-status-terlambat">
              Anda belum dapat meminjam buku
            </p>
            <ul className="flex flex-col gap-2 text-sm text-status-terlambat">
              {kelayakan.alasan.map((a) => (
                <li key={a.kode}>
                  <p className="font-semibold">{judulAlasan(a.kode)}</p>
                  <p>{a.pesan}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {layak && (
        <TautanTombol
          href="/katalog"
          varian="sekunder"
          className="shrink-0 self-start sm:self-center"
        >
          <Ikon nama="bukuIsi" className="size-5" />
          Lihat Katalog Buku
          <Ikon nama="panah" className="size-4" />
        </TautanTombol>
      )}
    </div>
  );
}

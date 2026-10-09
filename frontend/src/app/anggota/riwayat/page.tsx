import type { Metadata } from "next";

import { fotoHeroBeranda } from "@/assets/foto";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";
import { KosongState } from "@/components/ui/KosongState";
import { LabelStatus } from "@/components/ui/LabelStatus";
import { Paginasi } from "@/components/ui/Paginasi";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { formatTanggal } from "@/lib/format";
import { halamanDariParam } from "@/lib/halaman";

type HalamanRiwayat = components["schemas"]["HalamanRiwayat"];
type Item = components["schemas"]["ItemRiwayatKeluar"];

export const metadata: Metadata = { title: "Riwayat Peminjaman" };

/** Tanggal penutup item: kembali (Dikembalikan), kejadian (Hilang/Rusak, OQ-35), atau belum ada (Dipinjam). */
function TanggalAkhir({ item }: { item: Item }) {
  if (item.status === "HILANG" || item.status === "RUSAK") {
    return (
      <>
        <dt className="text-navy/70">Tanggal kejadian</dt>
        <dd className="angka">
          {item.tanggal_kejadian ? formatTanggal(item.tanggal_kejadian) : "—"}
        </dd>
      </>
    );
  }
  return (
    <>
      <dt className="text-navy/70">Tanggal kembali</dt>
      <dd className="angka">
        {item.tanggal_kembali ? formatTanggal(item.tanggal_kembali) : "Belum dikembalikan"}
      </dd>
    </>
  );
}

/**
 * FR-AGT-03, OQ-35: semua item anggota termasuk yang masih Dipinjam dan yang Hilang/Rusak, terbaru dulu,
 * berhalaman. Keterangan & admin pencatat tidak ditampilkan (catatan internal admin).
 */
export default async function HalamanRiwayat({
  searchParams,
}: {
  searchParams: Promise<{ halaman?: string | string[] }>;
}) {
  const halaman = halamanDariParam((await searchParams).halaman);
  const riwayat = await ambilServer<HalamanRiwayat>(`/anggota/riwayat?halaman=${halaman}`);

  return (
    <section className="flex flex-col gap-6">
      <KepalaHalamanArea
        judul="Riwayat Peminjaman"
        subjudul="Semua buku yang pernah dan sedang Anda pinjam."
        foto={fotoHeroBeranda}
      />

      {riwayat.data.length === 0 ? (
        <KosongState judul="Belum ada riwayat peminjaman" />
      ) : (
        <ul className="flex flex-col gap-3">
          {riwayat.data.map((item, i) => (
            // Respons riwayat tidak memuat id item; urutan dari API stabil (OQ-35).
            <li
              key={`${i}-${item.kode_eksemplar}`}
              className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-display text-lg leading-snug">{item.judul}</p>
                <p className="angka text-sm text-navy/70">{item.kode_eksemplar}</p>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                  <dt className="text-navy/70">Tanggal pinjam</dt>
                  <dd className="angka">{formatTanggal(item.tanggal_pinjam)}</dd>
                  <dt className="text-navy/70">Jatuh tempo</dt>
                  <dd className="angka">{formatTanggal(item.jatuh_tempo)}</dd>
                  <TanggalAkhir item={item} />
                </dl>
              </div>
              <LabelStatus status={item.status} terlambat={item.terlambat} className="self-start" />
            </li>
          ))}
        </ul>
      )}

      <Paginasi
        halaman={halaman}
        total={riwayat.total}
        perHalaman={riwayat.per_halaman}
        path="/anggota/riwayat"
      />
    </section>
  );
}

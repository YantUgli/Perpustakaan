import type { Metadata } from "next";
import Link from "next/link";

import { fotoHeroBeranda } from "@/assets/foto";
import { KepalaHalamanArea } from "@/components/ui/KepalaHalamanArea";
import { KosongState } from "@/components/ui/KosongState";
import { Paginasi } from "@/components/ui/Paginasi";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import {
  PER_HALAMAN_RIWAYAT,
  STATUS_RIWAYAT,
  type StatusRiwayat,
  ambilSemuaHalaman,
  hitungPerStatus,
  potongHalaman,
  statusRiwayatDariParam,
} from "@/lib/area-anggota";
import { halamanDariParam } from "@/lib/halaman";
import { LABEL_STATUS } from "@/lib/label";

import { KartuRingkas } from "../_komponen/KartuRingkas";
import { KartuRiwayat } from "../_komponen/KartuRiwayat";
import { TabelRiwayat } from "../_komponen/TabelRiwayat";

type HalamanRiwayat = components["schemas"]["HalamanRiwayat"];
type Item = components["schemas"]["ItemRiwayatKeluar"];

export const metadata: Metadata = { title: "Riwayat Peminjaman" };

const KARTU: {
  status: StatusRiwayat;
  ikon: "jam" | "centang" | "peringatanIsi" | "perkakas";
  nada: "biru" | "gold" | "merah" | "abu";
}[] = [
  { status: "DIPINJAM", ikon: "jam", nada: "biru" },
  { status: "DIKEMBALIKAN", ikon: "centang", nada: "abu" },
  { status: "HILANG", ikon: "peringatanIsi", nada: "merah" },
  { status: "RUSAK", ikon: "perkakas", nada: "gold" },
];

const tautanTab = (status?: StatusRiwayat) =>
  status ? `/anggota/riwayat?status=${status}` : "/anggota/riwayat";

/**
 * FR-AGT-03, OQ-35: semua item anggota termasuk yang masih Dipinjam dan yang Hilang/Rusak, terbaru dulu.
 * Tata letak hal-13 (keputusan Ayen 09/10/2026, opsi b; spec `design/specs/riwayat.md`): semua halaman diambil
 * (`per_halaman=100`), lalu kartu per status, tab `?status=`, dan paginasi 20/halaman dihitung di klien — hanya
 * tampilan. Halaman mana pun gagal → `error.tsx`. Keterangan & admin pencatat tidak ditampilkan.
 */
export default async function HalamanRiwayat({
  searchParams,
}: {
  searchParams: Promise<{ halaman?: string | string[]; status?: string | string[] }>;
}) {
  const p = await searchParams;
  const halaman = halamanDariParam(p.halaman);
  const status = statusRiwayatDariParam(p.status);
  const semua = await ambilSemuaHalaman<Item>("/anggota/riwayat", (path) =>
    ambilServer<HalamanRiwayat>(path),
  );
  const hitungan = hitungPerStatus(semua);
  const tersaring = status ? semua.filter((i) => i.status === status) : semua;
  const tampil = potongHalaman(tersaring, halaman);

  return (
    <section className="flex flex-col gap-6">
      <KepalaHalamanArea
        judul="Riwayat Peminjaman"
        subjudul="Semua buku yang pernah dan sedang Anda pinjam."
        foto={fotoHeroBeranda}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <KartuRingkas
          label="Total Riwayat"
          ikon="bukuIsi"
          nada="biru"
          nilai={semua.length}
          satuan="buku"
        />
        {KARTU.map((k) => (
          <KartuRingkas
            key={k.status}
            label={LABEL_STATUS[k.status]}
            ikon={k.ikon}
            nada={k.nada}
            nilai={hitungan[k.status]}
            satuan="buku"
          />
        ))}
      </div>

      <nav aria-label="Saring riwayat menurut status">
        <ul className="flex flex-wrap gap-2">
          {[undefined, ...STATUS_RIWAYAT].map((s) => {
            const aktif = s === status;
            return (
              <li key={s ?? "SEMUA"}>
                <Link
                  href={tautanTab(s)}
                  aria-current={aktif ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center rounded-full border px-5 text-sm font-medium ${
                    aktif
                      ? "border-gold-700 bg-gold-700 text-white"
                      : "border-line bg-surface text-navy hover:border-gold-700"
                  }`}
                >
                  {s ? LABEL_STATUS[s] : "Semua"}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {semua.length === 0 ? (
        <KosongState judul="Belum ada riwayat peminjaman" />
      ) : tampil.length === 0 ? (
        <KosongState
          judul={
            status && tersaring.length === 0
              ? `Tidak ada riwayat dengan status ${LABEL_STATUS[status]}.`
              : "Tidak ada riwayat di halaman ini."
          }
        />
      ) : (
        <section
          aria-labelledby="judul-daftar-riwayat"
          className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5"
        >
          <h2 id="judul-daftar-riwayat" className="font-display text-2xl">
            Daftar Riwayat Peminjaman
          </h2>
          <div className="hidden xl:block">
            <TabelRiwayat item={tampil} idJudul="judul-daftar-riwayat" />
          </div>
          <ul aria-labelledby="judul-daftar-riwayat" className="flex flex-col gap-3 xl:hidden">
            {tampil.map((item, i) => (
              // Respons riwayat tidak memuat id item; urutan dari API stabil (OQ-35).
              <KartuRiwayat key={`${i}-${item.kode_eksemplar}`} item={item} />
            ))}
          </ul>
        </section>
      )}

      <Paginasi
        halaman={halaman}
        total={tersaring.length}
        perHalaman={PER_HALAMAN_RIWAYAT}
        path="/anggota/riwayat"
        params={{ status }}
      />
    </section>
  );
}

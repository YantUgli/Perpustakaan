"use client";

import Link from "next/link";
import { useState } from "react";

import { Pemindai } from "@/components/pemindai/Pemindai";
import { Kartu } from "@/components/ui/Kartu";
import { Pesan } from "@/components/ui/Pesan";
import { Tombol } from "@/components/ui/Tombol";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { GalatApi } from "@/lib/galat";
import {
  type PengembalianKeluar,
  type PratinjauKeluar,
  konfirmasiKembali,
  pratinjauKembali,
} from "@/lib/sirkulasi";

type Tahap = "scan" | "pratinjau" | "sukses";

/** Alur pengembalian admin (FR-KMB-01..08). Satu eksemplar per proses. */
export function AlurPengembalian() {
  const [tahap, setTahap] = useState<Tahap>("scan");
  const [pratinjau, setPratinjau] = useState<PratinjauKeluar | null>(null);
  const [hasil, setHasil] = useState<PengembalianKeluar | null>(null);
  const [galatScan, setGalatScan] = useState<string | null>(null);
  const [sedangProses, setSedangProses] = useState(false);

  function reset() {
    setTahap("scan");
    setPratinjau(null);
    setHasil(null);
    setGalatScan(null);
    setSedangProses(false);
  }

  async function onHasilPemindai(teks: string) {
    setSedangProses(true);
    setGalatScan(null);
    try {
      const data = await pratinjauKembali(teks.trim());
      setPratinjau(data);
      setTahap("pratinjau");
    } catch (e) {
      setGalatScan(e instanceof GalatApi ? e.pesan : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setSedangProses(false);
    }
  }

  async function konfirmasi() {
    if (!pratinjau) return;
    setSedangProses(true);
    try {
      const data = await konfirmasiKembali(pratinjau.eksemplar.kode);
      setHasil(data);
      setTahap("sukses");
    } catch (e) {
      setGalatScan(e instanceof GalatApi ? e.pesan : "Terjadi kesalahan. Coba lagi.");
      setSedangProses(false);
    }
  }

  if (tahap === "sukses" && hasil) {
    return <SuksesKembali hasil={hasil} onBerikutnya={reset} />;
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl">Pengembalian</h1>

      {tahap === "scan" && (
        <>
          <Pemindai label="Kode Eksemplar" onHasil={onHasilPemindai} nonaktif={sedangProses} />
          {galatScan && <Pesan jenis="galat">{galatScan}</Pesan>}
        </>
      )}

      {tahap === "pratinjau" && pratinjau && (
        <>
          <button
            type="button"
            onClick={reset}
            className="self-start text-sm font-semibold text-gold-700"
          >
            ← Scan ulang
          </button>
          <Kartu className="flex flex-col gap-3">
            <div>
              <p className="font-medium">{pratinjau.eksemplar.judul}</p>
              <p className="angka text-sm text-navy/70">{pratinjau.eksemplar.kode}</p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-navy/70">Peminjam</dt>
              <dd>
                {pratinjau.peminjam.nama}{" "}
                <span className="angka text-navy/70">({pratinjau.peminjam.kode})</span>
              </dd>
              <dt className="text-navy/70">Tgl pinjam</dt>
              <dd className="angka">{formatTanggal(pratinjau.tanggal_pinjam)}</dd>
              <dt className="text-navy/70">Jatuh tempo</dt>
              <dd className="angka">{formatTanggal(pratinjau.jatuh_tempo)}</dd>
              {pratinjau.hari_terlambat > 0 && (
                <>
                  <dt className="text-navy/70">Terlambat</dt>
                  <dd className="text-status-terlambat">{pratinjau.hari_terlambat} hari</dd>
                </>
              )}
            </dl>
            {pratinjau.denda > 0 && (
              <p className="text-sm">
                Estimasi denda:{" "}
                <span className="angka font-semibold">{formatRupiah(pratinjau.denda)}</span>
                <span className="ml-1 text-navy/60 text-xs">
                  (nominal final dihitung saat konfirmasi)
                </span>
              </p>
            )}
          </Kartu>

          {galatScan && <Pesan jenis="galat">{galatScan}</Pesan>}

          <div className="sticky bottom-4 pt-2">
            <Tombol className="w-full" disabled={sedangProses} onClick={konfirmasi}>
              Konfirmasi Pengembalian
            </Tombol>
          </div>
        </>
      )}
    </section>
  );
}

function SuksesKembali({
  hasil,
  onBerikutnya,
}: {
  hasil: PengembalianKeluar;
  onBerikutnya: () => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <Pesan jenis="sukses">
        <strong>Dikembalikan</strong> — {hasil.eksemplar.judul}
      </Pesan>
      <Kartu className="flex flex-col gap-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-navy/70">Peminjam</dt>
          <dd>{hasil.peminjam.nama}</dd>
          <dt className="text-navy/70">Tgl kembali</dt>
          <dd className="angka">{formatTanggal(hasil.tanggal_kembali)}</dd>
          {hasil.tagihan && (
            <>
              <dt className="text-navy/70">Denda final</dt>
              <dd className="angka font-semibold">{formatRupiah(hasil.tagihan.nominal)}</dd>
              <dt className="text-navy/70">Tagihan</dt>
              <dd>
                <Link
                  href={`/admin/tagihan/${hasil.tagihan.id}`}
                  className="font-semibold text-gold-700 underline"
                >
                  Lihat tagihan #{hasil.tagihan.id}
                </Link>
              </dd>
            </>
          )}
        </dl>
        {hasil.transaksi_selesai && <p className="text-sm font-medium">Transaksi selesai</p>}
      </Kartu>
      <Tombol onClick={onBerikutnya}>Pengembalian Berikutnya</Tombol>
    </section>
  );
}

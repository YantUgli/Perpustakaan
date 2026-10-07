"use client";

import { type FormEvent, useState } from "react";

import { Pemindai } from "@/components/pemindai/Pemindai";
import { Kartu } from "@/components/ui/Kartu";
import { KosongState } from "@/components/ui/KosongState";
import { Pesan } from "@/components/ui/Pesan";
import { Tombol } from "@/components/ui/Tombol";
import { formatTanggal } from "@/lib/format";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";
import {
  type IdentitasAnggotaKeluar,
  type ItemValidKeluar,
  type ProfilKeluar,
  type TransaksiKeluar,
  cariAnggota,
  identifikasiAnggota,
  konfirmasiPeminjaman,
  validasiItem,
} from "@/lib/sirkulasi";

type Tahap = "anggota" | "buku" | "sukses";

/** Alur peminjaman admin (FR-PJM-01..13). NFR-USA-01: scan anggota → scan buku → Konfirmasi = 3 tindakan. */
export function AlurPeminjaman() {
  const [tahap, setTahap] = useState<Tahap>("anggota");
  const [anggota, setAnggota] = useState<IdentitasAnggotaKeluar | null>(null);
  const [keranjang, setKeranjang] = useState<ItemValidKeluar[]>([]);
  const [transaksi, setTransaksi] = useState<TransaksiKeluar | null>(null);
  const [galatScan, setGalatScan] = useState<string | null>(null);
  const [galatKonfirmasi, setGalatKonfirmasi] = useState<string | null>(null);
  const [sedangProses, setSedangProses] = useState(false);

  const [kataKunci, setKataKunci] = useState("");
  const [hasilCari, setHasilCari] = useState<ProfilKeluar[] | null>(null);
  const [lebihBanyak, setLebihBanyak] = useState(false);
  const [sedangCari, setSedangCari] = useState(false);

  function reset() {
    setTahap("anggota");
    setAnggota(null);
    setKeranjang([]);
    setTransaksi(null);
    setGalatScan(null);
    setGalatKonfirmasi(null);
    setSedangProses(false);
    setKataKunci("");
    setHasilCari(null);
    setLebihBanyak(false);
    setSedangCari(false);
  }

  async function prosesAnggota(kode: string) {
    setSedangProses(true);
    setGalatScan(null);
    try {
      const data = await identifikasiAnggota(kode.trim());
      setAnggota(data);
      if (data.layak) {
        setHasilCari(null);
        setTahap("buku");
      }
    } catch (e) {
      setGalatScan(e instanceof GalatApi ? e.pesan : PESAN_SISTEM);
      setAnggota(null);
    } finally {
      setSedangProses(false);
    }
  }

  async function onHasilPemindai(teks: string) {
    if (tahap === "anggota") {
      await prosesAnggota(teks);
    } else if (tahap === "buku" && anggota) {
      setSedangProses(true);
      setGalatScan(null);
      try {
        const kodes = keranjang.map((x) => x.kode);
        const item = await validasiItem(anggota.id, teks.trim(), kodes);
        setKeranjang((k) => [...k, item]);
      } catch (e) {
        setGalatScan(e instanceof GalatApi ? e.pesan : PESAN_SISTEM);
      } finally {
        setSedangProses(false);
      }
    }
  }

  async function cari(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!kataKunci.trim()) return;
    setSedangCari(true);
    setHasilCari(null);
    try {
      const data = await cariAnggota(kataKunci.trim());
      setHasilCari(data.data);
      setLebihBanyak(data.total > data.data.length);
    } catch (e) {
      setGalatScan(e instanceof GalatApi ? e.pesan : PESAN_SISTEM);
      setHasilCari(null);
      setLebihBanyak(false);
    } finally {
      setSedangCari(false);
    }
  }

  async function konfirmasi() {
    if (!anggota || keranjang.length === 0) return;
    setSedangProses(true);
    setGalatKonfirmasi(null);
    try {
      const t = await konfirmasiPeminjaman(
        anggota.id,
        keranjang.map((x) => x.kode),
      );
      setTransaksi(t);
      setTahap("sukses");
    } catch (e) {
      setGalatKonfirmasi(e instanceof GalatApi ? e.pesan : PESAN_SISTEM);
    } finally {
      setSedangProses(false);
    }
  }

  if (tahap === "sukses" && transaksi) {
    return <SuksesPeminjaman transaksi={transaksi} onBaru={reset} />;
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Peminjaman</h1>
        <button
          type="button"
          onClick={reset}
          disabled={sedangProses}
          className="text-sm font-semibold text-gold-700 disabled:opacity-50"
        >
          Reset
        </button>
      </header>

      <p className="text-xs text-navy/60" aria-live="polite">
        {tahap === "anggota" ? "① Anggota → ② Buku → ✓ Selesai" : "① ✓ → ② Buku → ✓ Selesai"}
      </p>

      {/* Satu instance Pemindai: label berganti sesuai tahap, kamera tidak mati (butir 10) */}
      <Pemindai
        label={tahap === "anggota" ? "Kode Anggota" : "Kode Eksemplar"}
        onHasil={onHasilPemindai}
        nonaktif={sedangProses}
      />

      {galatScan && <Pesan jenis="galat">{galatScan}</Pesan>}

      {/* ── LANGKAH 1: Identifikasi Anggota ── */}
      {tahap === "anggota" && (
        <div className="flex flex-col gap-3">
          <form onSubmit={cari} className="flex gap-2">
            <input
              type="text"
              placeholder="Cari ID, NIK, atau nama"
              value={kataKunci}
              onChange={(e) => setKataKunci(e.target.value)}
              aria-label="Kata kunci pencarian anggota"
              className="min-h-11 flex-1 rounded-lg border border-navy/40 bg-surface px-3 py-2 text-sm text-navy placeholder:text-navy/50"
            />
            <Tombol type="submit" disabled={sedangCari || !kataKunci.trim()}>
              Cari
            </Tombol>
          </form>

          {/* F3 (butir 5 adj): selalu daftar, tidak pernah otomatis pilih; perjelas bila lebih banyak */}
          {hasilCari !== null && (
            <div className="flex flex-col gap-1">
              {hasilCari.length === 0 ? (
                <p className="text-sm text-navy/70">Anggota tidak ditemukan.</p>
              ) : (
                hasilCari.map((p) => (
                  <button
                    key={p.kode}
                    type="button"
                    onClick={() => prosesAnggota(p.kode)}
                    disabled={sedangProses}
                    className="flex w-full items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-left text-sm hover:bg-ivory disabled:opacity-60"
                  >
                    <span className="font-medium">{p.nama}</span>
                    <span className="angka text-navy/70">{p.kode}</span>
                  </button>
                ))
              )}
              {lebihBanyak && (
                <p className="text-sm text-navy/70">
                  Perjelas kata kunci untuk melihat lebih banyak hasil.
                </p>
              )}
            </div>
          )}

          {/* Identitas anggota + alasan blokir */}
          {anggota && (
            <Kartu className="flex flex-col gap-2">
              <p className="font-medium">{anggota.nama}</p>
              <p className="angka text-sm text-navy/70">{anggota.kode}</p>
              <p className="text-sm text-navy/70">{anggota.pinjaman_aktif} pinjaman aktif</p>
              {anggota.layak ? (
                <p className="text-sm font-medium text-status-tersedia">● Dapat Meminjam</p>
              ) : (
                <div className="flex flex-col gap-1 pt-1">
                  {anggota.alasan.map((a, i) => (
                    <Pesan key={i} jenis="galat">
                      {a.pesan}
                    </Pesan>
                  ))}
                </div>
              )}
            </Kartu>
          )}
        </div>
      )}

      {/* ── LANGKAH 2: Keranjang Buku ── */}
      {tahap === "buku" && anggota && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-navy/70">
            {anggota.nama} — <span className="angka">{anggota.kode}</span>
          </p>

          {/* Galat konfirmasi POST: pesan backend, keranjang tetap ada (FR-PJM-10) */}
          {galatKonfirmasi && <Pesan jenis="galat">{galatKonfirmasi}</Pesan>}

          {keranjang.length > 0 ? (
            <ul aria-label="Keranjang" className="flex flex-col gap-2">
              {keranjang.map((item) => (
                <li
                  key={item.kode}
                  className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.judul}</p>
                    <p className="angka text-xs text-navy/70">{item.kode}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKeranjang((k) => k.filter((x) => x.kode !== item.kode))}
                    aria-label={`Hapus ${item.judul}`}
                    className="px-2 py-1 text-sm font-medium text-status-hilang"
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <KosongState
              judul="Belum ada buku"
              keterangan="Pindai atau ketik kode eksemplar di atas."
            />
          )}

          <div className="sticky bottom-4 pt-2">
            <Tombol
              className="w-full"
              disabled={keranjang.length === 0 || sedangProses}
              onClick={konfirmasi}
            >
              Konfirmasi Peminjaman
            </Tombol>
          </div>
        </div>
      )}
    </section>
  );
}

function SuksesPeminjaman({
  transaksi,
  onBaru,
}: {
  transaksi: TransaksiKeluar;
  onBaru: () => void;
}) {
  // FR-PJM-11 (butir 2): jatuh tempo dari respons per item, tidak dihitung klien
  const jatuhTempo = transaksi.item[0]?.jatuh_tempo;
  return (
    <section className="flex flex-col gap-4">
      <p className="text-xs text-navy/60">① ✓ → ② ✓ → ✓ Selesai</p>
      <Pesan jenis="sukses">
        <strong>Peminjaman berhasil</strong> — {transaksi.anggota.nama}
      </Pesan>
      <Kartu className="flex flex-col gap-3">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-navy/70">Tgl pinjam</dt>
          <dd className="angka">{formatTanggal(transaksi.tanggal_transaksi)}</dd>
          {jatuhTempo && (
            <>
              <dt className="text-navy/70">Jatuh tempo</dt>
              <dd className="angka">{formatTanggal(jatuhTempo)}</dd>
            </>
          )}
        </dl>
        <ul className="flex flex-col gap-1">
          {transaksi.item.map((item) => (
            <li key={item.kode_eksemplar} className="text-sm">
              {item.judul} <span className="angka text-navy/70">({item.kode_eksemplar})</span>
            </li>
          ))}
        </ul>
      </Kartu>
      <Tombol onClick={onBaru}>Pinjaman Baru</Tombol>
    </section>
  );
}

"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { Pemindai } from "@/components/pemindai/Pemindai";
import { AreaIsian } from "@/components/ui/AreaIsian";
import { Isian } from "@/components/ui/Isian";
import { Kartu } from "@/components/ui/Kartu";
import { KosongState } from "@/components/ui/KosongState";
import { Modal } from "@/components/ui/Modal";
import { Pesan } from "@/components/ui/Pesan";
import { Tombol } from "@/components/ui/Tombol";
import { formatTanggal, formatRupiah } from "@/lib/format";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";
import { labelStatus } from "@/lib/label";
import {
  type DaftarItemKeluar,
  type ItemAktifKeluar,
  type JenisHilangRusak,
  type PencatatanKeluar,
  type ProfilKeluar,
  cariAnggota,
  catatHilangRusak,
  daftarItemAnggota,
  pratinjauKembali,
} from "@/lib/sirkulasi";

/** Pesan validasi keterangan — identik backend services/hilang_rusak.py:242 (FR-HLR-03). */
export const PESAN_KETERANGAN_KOSONG = "Keterangan kejadian wajib diisi.";

type Mode = "pindai-anggota" | "pindai-buku";
type Tahap = "identifikasi" | "form" | "sukses";

/** Alur pencatatan hilang/rusak admin (FR-HLR-01..05). Modal konfirmasi sebelum POST (butir 6). */
export function AlurHilangRusak() {
  const [mode, setMode] = useState<Mode>("pindai-anggota");
  const [tahap, setTahap] = useState<Tahap>("identifikasi");
  const [daftar, setDaftar] = useState<DaftarItemKeluar | null>(null);
  const [itemDipilih, setItemDipilih] = useState<ItemAktifKeluar | null>(null);
  const [hasil, setHasil] = useState<PencatatanKeluar | null>(null);

  const [jenis, setJenis] = useState<JenisHilangRusak | "">("");
  const [tanggalKejadian, setTanggalKejadian] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [galatKeterangan, setGalatKeterangan] = useState("");

  const [modal, setModal] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [sedangProses, setSedangProses] = useState(false);

  const [kataKunci, setKataKunci] = useState("");
  const [hasilCari, setHasilCari] = useState<ProfilKeluar[] | null>(null);
  const [lebihBanyak, setLebihBanyak] = useState(false);
  const [sedangCari, setSedangCari] = useState(false);

  function reset() {
    setMode("pindai-anggota");
    setTahap("identifikasi");
    setDaftar(null);
    setItemDipilih(null);
    setHasil(null);
    setJenis("");
    setTanggalKejadian("");
    setKeterangan("");
    setGalatKeterangan("");
    setModal(false);
    setGalat(null);
    setSedangProses(false);
    setKataKunci("");
    setHasilCari(null);
    setLebihBanyak(false);
    setSedangCari(false);
  }

  function gantiMode(m: Mode) {
    setMode(m);
    setDaftar(null);
    setItemDipilih(null);
    setGalat(null);
    setHasilCari(null);
  }

  async function prosesAnggota(kode: string) {
    setSedangProses(true);
    setGalat(null);
    try {
      const data = await daftarItemAnggota(kode.trim());
      setDaftar(data);
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.pesan : PESAN_SISTEM);
    } finally {
      setSedangProses(false);
    }
  }

  async function onHasilPemindai(teks: string) {
    if (mode === "pindai-anggota") {
      await prosesAnggota(teks);
    } else {
      // Jalur B (FR-HLR-02, butir 3): scan eksemplar → ambil kode peminjam → daftar item
      setSedangProses(true);
      setGalat(null);
      try {
        const pratinjau = await pratinjauKembali(teks.trim());
        const data = await daftarItemAnggota(pratinjau.peminjam.kode);
        setDaftar(data);
        // Auto-pilih item yang sesuai eksemplar yang dipindai
        // ASUMSI(OQ-26): backend sudah menormalisasi kode eksemplar; bandingkan langsung
        const cocok = data.item.find((i) => i.kode_eksemplar === pratinjau.eksemplar.kode);
        if (cocok) {
          setItemDipilih(cocok);
          setTahap("form");
        }
      } catch (e) {
        setGalat(e instanceof GalatApi ? e.pesan : PESAN_SISTEM);
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
      setGalat(e instanceof GalatApi ? e.pesan : PESAN_SISTEM);
      setHasilCari(null);
      setLebihBanyak(false);
    } finally {
      setSedangCari(false);
    }
  }

  function pilihItem(item: ItemAktifKeluar) {
    setItemDipilih(item);
    setTahap("form");
    setGalat(null);
  }

  function bukaModal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Validasi sisi klien: keterangan wajib
    if (!keterangan.trim()) {
      setGalatKeterangan(PESAN_KETERANGAN_KOSONG);
      return;
    }
    setGalatKeterangan("");
    setModal(true);
  }

  async function catat() {
    if (!itemDipilih || !jenis || !tanggalKejadian || !keterangan.trim()) return;
    setModal(false);
    setSedangProses(true);
    setGalat(null);
    try {
      const data = await catatHilangRusak(
        itemDipilih.item_id,
        jenis,
        tanggalKejadian,
        keterangan.trim(),
      );
      setHasil(data);
      setTahap("sukses");
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.pesan : PESAN_SISTEM);
    } finally {
      setSedangProses(false);
    }
  }

  if (tahap === "sukses" && hasil) {
    return <SuksesHilangRusak hasil={hasil} onBaru={reset} />;
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-2xl">Hilang / Rusak</h1>

      {/* ── LANGKAH 1: Identifikasi ── */}
      {tahap === "identifikasi" && (
        <div className="flex flex-col gap-3">
          {/* Tab mode: Pindai anggota | Pindai buku (butir 3) */}
          <div
            role="tablist"
            aria-label="Mode pencarian"
            className="flex rounded-lg border border-line bg-surface"
          >
            {(["pindai-anggota", "pindai-buku"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => gantiMode(m)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  mode === m ? "bg-gold-700 text-white" : "text-navy/70 hover:bg-ivory"
                }`}
              >
                {m === "pindai-anggota" ? "Pindai Anggota" : "Pindai Buku"}
              </button>
            ))}
          </div>

          <Pemindai
            label={mode === "pindai-anggota" ? "Kode Anggota" : "Kode Eksemplar"}
            onHasil={onHasilPemindai}
            nonaktif={sedangProses}
          />

          {galat && <Pesan jenis="galat">{galat}</Pesan>}

          {/* Cari teks (hanya untuk mode pindai-anggota) */}
          {mode === "pindai-anggota" && (
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
          )}

          {/* Hasil pencarian anggota */}
          {hasilCari !== null && mode === "pindai-anggota" && (
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

          {/* Daftar item dipinjam anggota */}
          {daftar && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                {daftar.anggota.nama}{" "}
                <span className="angka text-navy/70">({daftar.anggota.kode})</span>
              </p>
              {daftar.item.length === 0 ? (
                // Butir 5: pesan kosong yang jelas
                <KosongState
                  judul="Tidak ada item dipinjam"
                  keterangan="Anggota ini tidak memiliki buku yang sedang dipinjam."
                />
              ) : (
                daftar.item.map((item) => (
                  <button
                    key={item.item_id}
                    type="button"
                    onClick={() => pilihItem(item)}
                    className="flex w-full flex-col gap-1 rounded-lg border border-line bg-surface px-4 py-3 text-left text-sm hover:bg-ivory"
                  >
                    <p className="font-medium">{item.judul}</p>
                    <p className="angka text-xs text-navy/70">
                      {item.kode_eksemplar} · Pinjam: {formatTanggal(item.tanggal_pinjam)}
                      {item.hari_terlambat > 0 && (
                        <span className="ml-2 text-status-terlambat">
                          {item.hari_terlambat} hari terlambat
                        </span>
                      )}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── LANGKAH 2: Form Hilang/Rusak ── */}
      {tahap === "form" && itemDipilih && (
        <form onSubmit={bukaModal} className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => {
              setTahap("identifikasi");
              setItemDipilih(null);
              setGalat(null);
            }}
            className="self-start text-sm font-semibold text-gold-700"
          >
            ← Kembali
          </button>

          <Kartu className="flex flex-col gap-1">
            <p className="font-medium">{itemDipilih.judul}</p>
            <p className="angka text-sm text-navy/70">{itemDipilih.kode_eksemplar}</p>
            {daftar && <p className="text-sm text-navy/70">Peminjam: {daftar.anggota.nama}</p>}
            <p className="angka text-sm text-navy/70">
              Pinjam: {formatTanggal(itemDipilih.tanggal_pinjam)} · Jatuh tempo:{" "}
              {formatTanggal(itemDipilih.jatuh_tempo)}
            </p>
          </Kartu>

          {/* Jenis: tanpa nilai bawaan (butir 4) */}
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-navy">
              Jenis{" "}
              <span aria-hidden="true" className="text-status-hilang">
                {" "}
                *
              </span>
            </legend>
            <div className="flex gap-4">
              {(["HILANG", "RUSAK"] as JenisHilangRusak[]).map((j) => (
                <label key={j} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="jenis"
                    value={j}
                    checked={jenis === j}
                    onChange={() => setJenis(j)}
                    required
                  />
                  {labelStatus(j).label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Tanggal kejadian: min = tanggal_pinjam, tanpa max (butir 4, OQ-26) */}
          <Isian
            label="Tanggal kejadian"
            type="date"
            required
            value={tanggalKejadian}
            min={itemDipilih.tanggal_pinjam}
            onChange={(e) => setTanggalKejadian(e.target.value)}
          />

          <AreaIsian
            label="Keterangan"
            required
            value={keterangan}
            galat={galatKeterangan || undefined}
            onChange={(e) => setKeterangan(e.target.value)}
            rows={3}
          />

          {galat && <Pesan jenis="galat">{galat}</Pesan>}

          <div className="sticky bottom-4 pt-2">
            <Tombol
              type="submit"
              className="w-full"
              disabled={!jenis || !tanggalKejadian || !keterangan.trim() || sedangProses}
            >
              Catat Hilang/Rusak
            </Tombol>
          </div>
        </form>
      )}

      {/* Modal konfirmasi sebelum POST (butir 6) */}
      <Modal
        terbuka={modal}
        judul="Konfirmasi Pencatatan"
        onTutup={() => setModal(false)}
        aksi={
          <>
            <Tombol varian="sekunder" onClick={() => setModal(false)}>
              Batal
            </Tombol>
            <Tombol onClick={catat} disabled={sedangProses}>
              Ya, Catat
            </Tombol>
          </>
        }
      >
        <p>
          Mencatat buku sebagai <strong>{jenis ? labelStatus(jenis).label : ""}</strong> akan
          membentuk tagihan penggantian yang tidak dapat dibatalkan.
        </p>
        {itemDipilih && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-navy/70">Buku</dt>
            <dd>{itemDipilih.judul}</dd>
            <dt className="text-navy/70">Jenis</dt>
            <dd>{jenis ? labelStatus(jenis).label : ""}</dd>
            {daftar && (
              <>
                <dt className="text-navy/70">Anggota</dt>
                <dd>{daftar.anggota.nama}</dd>
              </>
            )}
          </dl>
        )}
        {itemDipilih && (
          // FR-HLR-04: nominal dari API apa adanya; nominal final dari tagihan.nominal setelah POST
          <p className="mt-3 text-sm">
            Tagihan penggantian:{" "}
            <span className="angka font-semibold">
              {formatRupiah(itemDipilih.nominal_penggantian)}
            </span>
            <span className="ml-1 text-navy/60 text-xs">(nominal final dihitung saat dicatat)</span>
          </p>
        )}
      </Modal>
    </section>
  );
}

function SuksesHilangRusak({ hasil, onBaru }: { hasil: PencatatanKeluar; onBaru: () => void }) {
  return (
    <section className="flex flex-col gap-4">
      <Pesan jenis="sukses">
        <strong>Berhasil dicatat</strong> — {labelStatus(hasil.status).label}
      </Pesan>
      <Kartu className="flex flex-col gap-3">
        <p className="font-medium">{hasil.judul}</p>
        <p className="angka text-sm text-navy/70">{hasil.kode_eksemplar}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-navy/70">Anggota</dt>
          <dd>{hasil.anggota.nama}</dd>
          <dt className="text-navy/70">Tagihan penggantian</dt>
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
        </dl>
        {hasil.transaksi_selesai && <p className="text-sm font-medium">Transaksi selesai</p>}
      </Kartu>
      <Tombol onClick={onBaru}>Kasus Baru</Tombol>
    </section>
  );
}

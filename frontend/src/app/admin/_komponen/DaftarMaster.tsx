"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Isian } from "@/components/ui/Isian";
import { KosongState } from "@/components/ui/KosongState";
import { Modal } from "@/components/ui/Modal";
import { Pesan } from "@/components/ui/Pesan";
import { Tombol } from "@/components/ui/Tombol";
import { ambil } from "@/lib/api-klien";
import { bodyKategori, bodyRak, validasiKategori, validasiRak } from "@/lib/data-admin";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";

type Kategori = { id: number; nama: string };
type Rak = { id: number; kode: string; lokasi: string | null };

export type DataMaster = { jenis: "kategori"; data: Kategori[] } | { jenis: "rak"; data: Rak[] };

type Nilai = { nama: string; kode: string; lokasi: string };
type Dialog =
  | { mode: "tambah" | "ubah"; id?: number; awal: Nilai }
  | { mode: "hapus"; id: number; nama: string };

const KOSONG: Nilai = { nama: "", kode: "", lokasi: "" };

const KONFIG = {
  kategori: {
    path: "/admin/kategori",
    judul: "Kategori",
    kosong: "Belum ada kategori",
    ketKosong: "Tambahkan kategori agar judul buku dapat dikelompokkan.",
    tambah: "Tambah Kategori",
    validasi: (n: Nilai) => validasiKategori(n),
    body: (n: Nilai) => bodyKategori(n),
  },
  rak: {
    path: "/admin/rak",
    judul: "Rak",
    kosong: "Belum ada rak",
    ketKosong: "Tambahkan rak agar eksemplar dapat ditempatkan.",
    tambah: "Tambah Rak",
    validasi: (n: Nilai) => validasiRak(n),
    body: (n: Nilai) => bodyRak(n),
  },
} as const;

const TAUTAN = "font-semibold text-gold-700 underline-offset-4 hover:underline";

/**
 * FR-BKU-01, DR-03/04: daftar, tambah, ubah, dan hapus kategori atau rak lewat modal. Keunikan (OQ-09) dan
 * penolakan hapus data yang masih dipakai diputuskan backend; `pesan`-nya ditampilkan apa adanya (IR-UI-04).
 */
export function DaftarMaster(props: DataMaster) {
  const k = KONFIG[props.jenis];
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [nilai, setNilai] = useState<Nilai>(KOSONG);
  const [galatIsian, setGalatIsian] = useState<Record<string, string>>({});
  const [galat, setGalat] = useState<string | null>(null);
  const [proses, setProses] = useState(false);

  const baris =
    props.jenis === "kategori"
      ? props.data.map((d) => ({ id: d.id, nama: d.nama, kode: "", lokasi: "", label: d.nama }))
      : props.data.map((d) => ({
          id: d.id,
          nama: "",
          kode: d.kode,
          lokasi: d.lokasi ?? "",
          label: d.kode,
        }));

  function buka(d: Dialog) {
    setGalat(null);
    setGalatIsian({});
    if (d.mode !== "hapus") setNilai(d.awal);
    setDialog(d);
  }
  const tutup = () => setDialog(null);

  async function jalankan(aksi: () => Promise<unknown>) {
    setProses(true);
    setGalat(null);
    try {
      await aksi();
      tutup();
      router.refresh();
    } catch (err) {
      if (err instanceof GalatApi) {
        setGalat(err.pesan);
        setGalatIsian(err.isian);
      } else {
        setGalat(PESAN_SISTEM);
      }
    } finally {
      setProses(false);
    }
  }

  function simpan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dialog || dialog.mode === "hapus") return;
    const salah = k.validasi(nilai);
    setGalatIsian(salah);
    setGalat(null);
    if (Object.keys(salah).length > 0) return;
    const ubah = dialog.mode === "ubah";
    void jalankan(() =>
      ambil(ubah ? `${k.path}/${dialog.id}` : k.path, {
        method: ubah ? "PUT" : "POST",
        json: k.body(nilai),
      }),
    );
  }

  const hapus = dialog?.mode === "hapus" ? dialog : null;
  const formulir = dialog && dialog.mode !== "hapus" ? dialog : null;
  const set = (f: keyof Nilai) => (e: { target: { value: string } }) =>
    setNilai((n) => ({ ...n, [f]: e.target.value }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="angka text-sm text-navy/80">
          {props.data.length} {k.judul.toLowerCase()}
        </p>
        <Tombol onClick={() => buka({ mode: "tambah", awal: KOSONG })}>{k.tambah}</Tombol>
      </div>

      {baris.length === 0 ? (
        <KosongState judul={k.kosong} keterangan={k.ketKosong} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="border-b border-line text-navy/70">
              <tr>
                {props.jenis === "kategori" ? (
                  <th className="px-4 py-3 font-medium">Nama kategori</th>
                ) : (
                  <>
                    <th className="px-4 py-3 font-medium">Kode rak</th>
                    <th className="px-4 py-3 font-medium">Lokasi</th>
                  </>
                )}
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.id} className="border-b border-line last:border-0">
                  {props.jenis === "kategori" ? (
                    <td className="px-4 py-3 font-medium">{b.nama}</td>
                  ) : (
                    <>
                      <td className="angka px-4 py-3 font-medium">{b.kode}</td>
                      <td className="px-4 py-3">{b.lokasi || "—"}</td>
                    </>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Ubah ${b.label}`}
                      className={TAUTAN}
                      onClick={() =>
                        buka({
                          mode: "ubah",
                          id: b.id,
                          awal: { nama: b.nama, kode: b.kode, lokasi: b.lokasi },
                        })
                      }
                    >
                      Ubah
                    </button>
                    <span aria-hidden="true" className="px-2 text-navy/40">
                      ·
                    </span>
                    <button
                      type="button"
                      aria-label={`Hapus ${b.label}`}
                      className={TAUTAN}
                      onClick={() => buka({ mode: "hapus", id: b.id, nama: b.label })}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        terbuka={dialog !== null}
        judul={
          hapus ? `Hapus ${k.judul}` : `${formulir?.mode === "ubah" ? "Ubah" : "Tambah"} ${k.judul}`
        }
        onTutup={tutup}
        aksi={
          hapus && (
            <>
              <Tombol varian="sekunder" onClick={tutup}>
                Batal
              </Tombol>
              <Tombol
                disabled={proses}
                onClick={() =>
                  void jalankan(() => ambil(`${k.path}/${hapus.id}`, { method: "DELETE" }))
                }
              >
                Ya, Hapus
              </Tombol>
            </>
          )
        }
      >
        {formulir && (
          <form onSubmit={simpan} noValidate className="flex flex-col gap-4">
            {galat && <Pesan jenis="galat">{galat}</Pesan>}
            {props.jenis === "kategori" ? (
              <Isian
                label="Nama"
                name="nama"
                required
                value={nilai.nama}
                onChange={set("nama")}
                galat={galatIsian.nama}
              />
            ) : (
              <>
                <Isian
                  label="Kode"
                  name="kode"
                  required
                  value={nilai.kode}
                  onChange={set("kode")}
                  galat={galatIsian.kode}
                />
                <Isian
                  label="Lokasi (opsional)"
                  name="lokasi"
                  value={nilai.lokasi}
                  onChange={set("lokasi")}
                  galat={galatIsian.lokasi}
                />
              </>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Tombol varian="sekunder" onClick={tutup}>
                Batal
              </Tombol>
              <Tombol type="submit" disabled={proses}>
                {proses ? "Menyimpan…" : "Simpan"}
              </Tombol>
            </div>
          </form>
        )}
        {hapus && (
          <div className="flex flex-col gap-3">
            {galat && <Pesan jenis="galat">{galat}</Pesan>}
            <p>
              {k.judul} <strong>{hapus.nama}</strong> akan dihapus. {k.judul} yang masih dipakai
              tidak dapat dihapus.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

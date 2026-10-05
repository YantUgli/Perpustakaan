"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Isian } from "@/components/ui/Isian";
import { Kartu } from "@/components/ui/Kartu";
import { Modal } from "@/components/ui/Modal";
import { Pesan } from "@/components/ui/Pesan";
import { Tombol } from "@/components/ui/Tombol";
import { ambil } from "@/lib/api-klien";
import type { components } from "@/lib/api-skema";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";
import { LABEL_CARA_PENYELESAIAN } from "@/lib/label";
import {
  type NilaiPenyelesaian,
  bodyPenyelesaian,
  caraTersedia,
  pesanSukses,
  validasiPenyelesaian,
} from "@/lib/tagihan-admin";

type Tagihan = components["schemas"]["TagihanKeluar"];

const KOSONG: NilaiPenyelesaian = { cara: "", nominal: "", tanggal: "" };

/**
 * FR-TGH-02..05: form penyelesaian tagihan Belum Lunas + pesan sukses. Komponen ini tetap terpasang setelah
 * `router.refresh()` sehingga pesan sukses (termasuk pengingat label Buku Pengganti) tidak hilang saat halaman
 * berganti menampilkan status Lunas. Tagihan Lunas: tidak ada form (FR-TGH-06).
 */
export function PanelPenyelesaian({ tagihan }: { tagihan: Tagihan }) {
  const router = useRouter();
  const [nilai, setNilai] = useState<NilaiPenyelesaian>(KOSONG);
  const [galatIsian, setGalatIsian] = useState<Record<string, string>>({});
  const [galat, setGalat] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [proses, setProses] = useState(false);

  // Sukses → pesan menggantikan form segera (tanpa menunggu refresh); Lunas tanpa pesan → tidak ada panel.
  if (sukses || tagihan.status === "LUNAS") {
    return sukses ? (
      <div>
        <Pesan jenis="sukses">{sukses}</Pesan>
      </div>
    ) : null;
  }

  const bukuPengganti = nilai.cara === "BUKU_PENGGANTI";

  function periksa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGalat(null);
    const g = validasiPenyelesaian(nilai, tagihan);
    setGalatIsian(g);
    if (Object.keys(g).length === 0) setKonfirmasi(true);
  }

  async function kirim() {
    setKonfirmasi(false);
    setProses(true);
    const body = bodyPenyelesaian(nilai);
    try {
      await ambil(`/admin/tagihan/${tagihan.id}/penyelesaian`, { method: "POST", json: body });
      setSukses(pesanSukses(body.cara, tagihan.eksemplar.kode));
      router.refresh();
    } catch (err) {
      // FR-TGH-02/03/04/06, OQ-28: pesan penolakan backend apa adanya (IR-UI-04).
      setGalat(err instanceof GalatApi ? err.pesan : PESAN_SISTEM);
    } finally {
      setProses(false);
    }
  }

  return (
    <Kartu className="flex flex-col gap-4">
      <h2 className="font-display text-2xl">Penyelesaian Tagihan</h2>
      <form onSubmit={periksa} noValidate className="flex flex-col gap-5">
        {galat && <Pesan jenis="galat">{galat}</Pesan>}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-navy">
            Cara penyelesaian
            <span aria-hidden="true" className="text-status-hilang">
              {" "}
              *
            </span>
          </legend>
          {caraTersedia(tagihan.jenis).map((cara) => (
            <label
              key={cara}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-navy/40 px-3"
            >
              <input
                type="radio"
                name="cara"
                value={cara}
                checked={nilai.cara === cara}
                onChange={() => setNilai((n) => ({ ...n, cara }))}
              />
              {LABEL_CARA_PENYELESAIAN[cara]}
            </label>
          ))}
          {galatIsian.cara && <p className="text-sm text-status-hilang">{galatIsian.cara}</p>}
        </fieldset>

        {!bukuPengganti && nilai.cara && (
          // P1: kosong; admin mengetik nominal yang dibayar, kecocokan diputuskan backend (FR-TGH-02).
          // Keterangan per Brief §7.5: kembalian di luar sistem, pembayaran sebagian ditolak.
          <Isian
            label="Nominal dibayar"
            name="nominal"
            inputMode="numeric"
            autoComplete="off"
            required
            value={nilai.nominal}
            onChange={(e) => setNilai((n) => ({ ...n, nominal: e.target.value }))}
            galat={galatIsian.nominal}
            keterangan={`Isi sama dengan nominal tagihan (${formatRupiah(tagihan.nominal)}). Kembalian diberikan di luar sistem; pembayaran sebagian tidak diterima.`}
          />
        )}

        {/* P2: kosong, min = tanggal dibentuk, tanpa max (batas hari ini WIB diputuskan backend, OQ-28). */}
        <Isian
          label={bukuPengganti ? "Tanggal penerimaan buku" : "Tanggal penyelesaian"}
          name="tanggal"
          type="date"
          min={tagihan.tanggal_dibentuk}
          required
          value={nilai.tanggal}
          onChange={(e) => setNilai((n) => ({ ...n, tanggal: e.target.value }))}
          galat={galatIsian.tanggal}
          keterangan={`Tidak lebih awal dari ${formatTanggal(tagihan.tanggal_dibentuk)} (tagihan dibentuk).`}
        />

        <div>
          <Tombol type="submit" disabled={proses}>
            {proses ? "Memproses…" : "Selesaikan Tagihan"}
          </Tombol>
        </div>

        <Modal
          terbuka={konfirmasi}
          judul="Selesaikan tagihan ini?"
          onTutup={() => setKonfirmasi(false)}
          aksi={
            <>
              <Tombol varian="sekunder" onClick={() => setKonfirmasi(false)}>
                Batal
              </Tombol>
              <Tombol onClick={kirim}>Ya, Selesaikan</Tombol>
            </>
          }
        >
          <p className="mb-3">Tagihan yang sudah Lunas tidak dapat diubah atau dihapus.</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-navy/70">Cara</dt>
            <dd>{nilai.cara ? LABEL_CARA_PENYELESAIAN[nilai.cara] : "—"}</dd>
            {!bukuPengganti && (
              <>
                <dt className="text-navy/70">Nominal dibayar</dt>
                <dd className="angka">
                  {/^[0-9]+$/.test(nilai.nominal.trim())
                    ? formatRupiah(Number(nilai.nominal.trim()))
                    : nilai.nominal}
                </dd>
              </>
            )}
            <dt className="text-navy/70">{bukuPengganti ? "Tanggal penerimaan" : "Tanggal"}</dt>
            <dd className="angka">{nilai.tanggal ? formatTanggal(nilai.tanggal) : "—"}</dd>
          </dl>
        </Modal>
      </form>
    </Kartu>
  );
}

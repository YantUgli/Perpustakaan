"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Isian } from "@/components/ui/Isian";
import { KosongState } from "@/components/ui/KosongState";
import { LabelStatus } from "@/components/ui/LabelStatus";
import { Modal } from "@/components/ui/Modal";
import { Pesan } from "@/components/ui/Pesan";
import { Pilihan } from "@/components/ui/Pilihan";
import { TautanTombol, Tombol } from "@/components/ui/Tombol";
import { ambil } from "@/lib/api-klien";
import type { components } from "@/lib/api-skema";
import {
  aksiEksemplar,
  bodyTambahEksemplar,
  pesanSuksesTambah,
  teksKonfirmasiTambah,
  validasiTambahEksemplar,
} from "@/lib/data-admin";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";
import { urlLabel } from "@/lib/label-cetak";

type Stok = components["schemas"]["StokJudul"];
type Eksemplar = components["schemas"]["EksemplarKeluar"];
type Rak = components["schemas"]["RakKeluar"];

type Props = {
  judul: { id: number; judul: string };
  stok: Stok;
  rak: Rak[];
};

type Dialog =
  | { mode: "tambah"; body: { jumlah: number; rak_id: number }; teks: string }
  | { mode: "rusak"; eksemplar: Eksemplar };

const labelRak = (r: Rak) => (r.lokasi ? `${r.kode} — ${r.lokasi}` : r.kode);

const REKAP: { kunci: keyof Stok["rekap"]; label: string }[] = [
  { kunci: "total", label: "Total" },
  { kunci: "tersedia", label: "Tersedia" },
  { kunci: "dipinjam", label: "Dipinjam" },
  { kunci: "hilang", label: "Hilang" },
  { kunci: "rusak", label: "Rusak" },
];

/**
 * FR-BKU-04..09, K-02, OQ-20, OQ-21. Rekap stok dari API (tidak dihitung ulang). Tambah eksemplar didahului
 * modal konfirmasi jumlah (eksemplar tidak dapat dihapus). Tandai Rusak hanya ditawarkan untuk Tersedia
 * (dibaca dari `status`; backend tetap yang menolak). Tanpa pemulihan Rusak dan tanpa hapus eksemplar.
 */
export function PanelEksemplar({ judul, stok, rak }: Props) {
  const router = useRouter();
  const [jumlah, setJumlah] = useState("1");
  const [rakTambah, setRakTambah] = useState("");
  const [galatIsian, setGalatIsian] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [galatDialog, setGalatDialog] = useState<string | null>(null);
  const [sukses, setSukses] = useState<{ teks: string; ids: number[] } | null>(null);
  const [pesan, setPesan] = useState<{ jenis: "sukses" | "galat"; teks: string } | null>(null);
  const [rakBaru, setRakBaru] = useState<Record<number, string>>({});
  const [terpilih, setTerpilih] = useState<Set<number>>(new Set());
  const [proses, setProses] = useState(false);

  const idTerpilih = stok.data.filter((e) => terpilih.has(e.id)).map((e) => e.id);
  const opsiRak = rak.map((r) => ({ nilai: String(r.id), label: labelRak(r) }));

  function periksaTambah(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSukses(null);
    const isian = { jumlah, rak_id: rakTambah };
    const galat = validasiTambahEksemplar(isian);
    setGalatIsian(galat);
    if (Object.keys(galat).length > 0) return;
    const body = bodyTambahEksemplar(isian);
    const namaRak = rak.find((r) => r.id === body.rak_id)?.kode ?? String(body.rak_id);
    setGalatDialog(null);
    setDialog({
      mode: "tambah",
      body,
      teks: teksKonfirmasiTambah({ jumlah: body.jumlah, judul: judul.judul, rak: namaRak }),
    });
  }

  async function konfirmasi() {
    if (!dialog) return;
    setProses(true);
    setGalatDialog(null);
    try {
      if (dialog.mode === "tambah") {
        const baru = await ambil<Eksemplar[]>(`/admin/judul/${judul.id}/eksemplar`, {
          method: "POST",
          json: dialog.body,
        });
        setSukses({ teks: pesanSuksesTambah(baru.map((e) => e.kode)), ids: baru.map((e) => e.id) });
      } else {
        await ambil(`/admin/eksemplar/${dialog.eksemplar.id}/rusak`, { method: "POST" });
        setPesan({
          jenis: "sukses",
          teks: `${dialog.eksemplar.kode} ditandai Rusak tanpa tagihan.`,
        });
      }
      setDialog(null);
      router.refresh();
    } catch (err) {
      // FR-BKU-04/07/08: penolakan backend ditampilkan apa adanya (IR-UI-04).
      setGalatDialog(err instanceof GalatApi ? err.pesan : PESAN_SISTEM);
    } finally {
      setProses(false);
    }
  }

  async function simpanRak(e: Eksemplar) {
    setProses(true);
    setPesan(null);
    try {
      await ambil(`/admin/eksemplar/${e.id}/rak`, {
        method: "PUT",
        json: { rak_id: Number(rakBaru[e.id]) },
      });
      setRakBaru((s) => {
        const sisa = { ...s };
        delete sisa[e.id];
        return sisa;
      });
      setPesan({ jenis: "sukses", teks: `Rak ${e.kode} berhasil diubah.` });
      router.refresh();
    } catch (err) {
      setPesan({ jenis: "galat", teks: err instanceof GalatApi ? err.pesan : PESAN_SISTEM });
    } finally {
      setProses(false);
    }
  }

  const alihPilih = (id: number) =>
    setTerpilih((s) => {
      const baru = new Set(s);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });
  const semuaTerpilih = stok.data.length > 0 && idTerpilih.length === stok.data.length;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-2xl">Eksemplar</h2>

      <dl aria-label="Rekap stok" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {REKAP.map(({ kunci, label }) => (
          <div key={kunci} className="rounded-lg border border-line px-4 py-3">
            <dt className="text-sm text-navy/70">{label}</dt>
            <dd className="angka font-display text-2xl">{stok.rekap[kunci]}</dd>
          </div>
        ))}
      </dl>

      <form
        onSubmit={periksaTambah}
        noValidate
        aria-label="Tambah eksemplar"
        className="grid grid-cols-1 items-start gap-4 rounded-xl border border-line p-4 sm:grid-cols-[10rem_1fr_auto]"
      >
        <Isian
          label="Jumlah eksemplar"
          name="jumlah"
          inputMode="numeric"
          autoComplete="off"
          value={jumlah}
          onChange={(e) => setJumlah(e.target.value)}
          galat={galatIsian.jumlah}
          keterangan="Maksimal 100 per penambahan."
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <Pilihan
            label="Rak"
            name="rak"
            value={rakTambah}
            onChange={(e) => setRakTambah(e.target.value)}
            opsi={[{ nilai: "", label: "Pilih rak" }, ...opsiRak]}
          />
          {galatIsian.rak_id && <p className="text-sm text-status-hilang">{galatIsian.rak_id}</p>}
        </div>
        <div className="sm:pt-7">
          <Tombol type="submit">Tambah Eksemplar</Tombol>
        </div>
        <p className="text-xs text-navy/70 sm:col-span-3">
          Kode dan QR dibuat otomatis, status awal Tersedia. Eksemplar tidak dapat dihapus setelah
          ditambahkan.
        </p>
      </form>

      {sukses && (
        <Pesan jenis="sukses">
          <p>{sukses.teks}</p>
          <p className="mt-2">
            <a
              href={urlLabel(sukses.ids)}
              target="_blank"
              rel="noopener"
              className="font-semibold underline underline-offset-4"
            >
              Cetak label eksemplar baru
            </a>
          </p>
        </Pesan>
      )}
      {pesan && <Pesan jenis={pesan.jenis}>{pesan.teks}</Pesan>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="angka text-sm text-navy/80">{stok.data.length} eksemplar terdaftar</p>
        {idTerpilih.length > 0 ? (
          <TautanTombol
            href={urlLabel(idTerpilih)}
            target="_blank"
            rel="noopener"
            varian="sekunder"
          >
            Cetak Label ({idTerpilih.length})
          </TautanTombol>
        ) : (
          <Tombol varian="sekunder" disabled>
            Cetak Label (0)
          </Tombol>
        )}
      </div>

      {stok.data.length === 0 ? (
        <KosongState
          judul="Belum ada eksemplar"
          keterangan="Tambahkan eksemplar agar judul ini dapat dipinjam."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table aria-label="Daftar eksemplar" className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-line text-navy/70">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua eksemplar"
                    checked={semuaTerpilih}
                    onChange={() =>
                      setTerpilih(semuaTerpilih ? new Set() : new Set(stok.data.map((e) => e.id)))
                    }
                    className="size-5"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Kode</th>
                <th className="px-4 py-3 font-medium">Rak</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {stok.data.map((e) => {
                const aksi = aksiEksemplar(e.status);
                const nilaiRak = rakBaru[e.id] ?? String(e.rak.id);
                const berubah = nilaiRak !== String(e.rak.id);
                return (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Pilih ${e.kode}`}
                        checked={terpilih.has(e.id)}
                        onChange={() => alihPilih(e.id)}
                        className="size-5"
                      />
                    </td>
                    <td className="angka px-4 py-3 font-medium">{e.kode}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Rak ${e.kode}`}
                          value={nilaiRak}
                          onChange={(ev) => setRakBaru((s) => ({ ...s, [e.id]: ev.target.value }))}
                          className="min-h-11 min-w-0 rounded-lg border border-navy/40 bg-surface px-2"
                        >
                          {opsiRak.map((o) => (
                            <option key={o.nilai} value={o.nilai}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {berubah && (
                          <Tombol
                            varian="sekunder"
                            disabled={proses}
                            aria-label={`Simpan rak ${e.kode}`}
                            onClick={() => void simpanRak(e)}
                          >
                            Simpan
                          </Tombol>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <LabelStatus status={e.status} />
                    </td>
                    <td className="px-4 py-3">
                      {aksi.tandaiRusak ? (
                        <Tombol
                          varian="sekunder"
                          aria-label={`Tandai Rusak ${e.kode}`}
                          onClick={() => {
                            setGalatDialog(null);
                            setDialog({ mode: "rusak", eksemplar: e });
                          }}
                        >
                          Tandai Rusak
                        </Tombol>
                      ) : (
                        <span className="text-navy/70">{aksi.keterangan ?? "—"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        terbuka={dialog !== null}
        judul={dialog?.mode === "rusak" ? "Tandai Rusak?" : "Konfirmasi tambah eksemplar"}
        onTutup={() => setDialog(null)}
        aksi={
          dialog && (
            <>
              <Tombol varian="sekunder" onClick={() => setDialog(null)}>
                Batal
              </Tombol>
              <Tombol disabled={proses} onClick={() => void konfirmasi()}>
                {dialog.mode === "rusak" ? "Ya, Tandai Rusak" : "Ya, Tambahkan"}
              </Tombol>
            </>
          )
        }
      >
        {dialog && (
          <div className="flex flex-col gap-3">
            {galatDialog && <Pesan jenis="galat">{galatDialog}</Pesan>}
            {dialog.mode === "tambah" ? (
              <p>{dialog.teks}</p>
            ) : (
              <p>
                Eksemplar <strong>{dialog.eksemplar.kode}</strong> ditandai Rusak tanpa tagihan.
                Status Rusak tidak dapat dipulihkan.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

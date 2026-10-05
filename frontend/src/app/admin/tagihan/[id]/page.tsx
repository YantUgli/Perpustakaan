import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Kartu } from "@/components/ui/Kartu";
import { LabelStatus } from "@/components/ui/LabelStatus";
import { ambilServer } from "@/lib/api-server";
import type { components } from "@/lib/api-skema";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { GalatApi } from "@/lib/galat";
import { LABEL_CARA_PENYELESAIAN, LABEL_JENIS_TAGIHAN } from "@/lib/label";

import { PanelPenyelesaian } from "./PanelPenyelesaian";

type Tagihan = components["schemas"]["TagihanKeluar"];

export const metadata: Metadata = { title: "Detail Tagihan" };

async function ambilTagihan(id: string): Promise<Tagihan> {
  if (!/^[1-9][0-9]*$/.test(id)) notFound();
  try {
    return await ambilServer<Tagihan>(`/admin/tagihan/${id}`);
  } catch (e) {
    if (e instanceof GalatApi && e.status === 404) notFound();
    throw e;
  }
}

/**
 * FR-TGH-02..06: detail tagihan. Belum Lunas → form penyelesaian. Lunas → cara, nominal dibayar (OQ-08),
 * tanggal, admin pengonfirmasi; tanpa tombol ubah/hapus (FR-TGH-06).
 */
export default async function DetailTagihan({ params }: { params: Promise<{ id: string }> }) {
  const t = await ambilTagihan((await params).id);
  return (
    <section className="flex flex-col gap-6">
      <Link href="/admin/tagihan" className="text-sm font-semibold text-gold-700">
        ← Kembali ke daftar tagihan
      </Link>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl sm:text-4xl">
          Tagihan {LABEL_JENIS_TAGIHAN[t.jenis]}
        </h1>
        <LabelStatus status={t.status} />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_24rem]">
        <Kartu className="flex flex-col gap-4">
          <p className="angka font-display text-3xl">{formatRupiah(t.nominal)}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-navy/70">Tanggal dibentuk</dt>
            <dd className="angka">{formatTanggal(t.tanggal_dibentuk)}</dd>
            <dt className="text-navy/70">Anggota</dt>
            <dd>
              <span className="angka font-medium">{t.anggota.kode}</span> · {t.anggota.nama}
            </dd>
            <dt className="text-navy/70">Buku</dt>
            <dd>
              {t.eksemplar.judul} <span className="angka text-navy/70">· {t.eksemplar.kode}</span>
            </dd>
            {t.status === "LUNAS" && (
              <>
                <dt className="text-navy/70">Cara penyelesaian</dt>
                <dd>{t.cara_penyelesaian ? LABEL_CARA_PENYELESAIAN[t.cara_penyelesaian] : "—"}</dd>
                {t.nominal_dibayar !== null && (
                  <>
                    <dt className="text-navy/70">Nominal dibayar</dt>
                    <dd className="angka">{formatRupiah(t.nominal_dibayar)}</dd>
                  </>
                )}
                <dt className="text-navy/70">
                  {t.cara_penyelesaian === "BUKU_PENGGANTI"
                    ? "Tanggal penerimaan buku"
                    : "Tanggal penyelesaian"}
                </dt>
                <dd className="angka">
                  {t.tanggal_penyelesaian ? formatTanggal(t.tanggal_penyelesaian) : "—"}
                </dd>
                <dt className="text-navy/70">Dikonfirmasi oleh</dt>
                <dd>{t.admin_pengonfirmasi ?? "—"}</dd>
              </>
            )}
          </dl>
          {t.status === "LUNAS" && (
            <p className="text-sm text-navy/70">
              Tagihan yang sudah Lunas tidak dapat diubah atau dihapus.
            </p>
          )}
        </Kartu>

        <PanelPenyelesaian tagihan={t} />
      </div>
    </section>
  );
}

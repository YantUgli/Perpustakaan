import type { Metadata } from "next";
import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import { Kartu } from "@/components/ui/Kartu";
import { TautanTombol } from "@/components/ui/Tombol";
import { formatTanggal } from "@/lib/format";

import { ambilAnggota } from "../ambil-anggota";

export const metadata: Metadata = { title: "Detail Anggota" };

/**
 * FR-AKN-10: detail anggota. NIK tampil di sini (dan di halaman ubah) saja, sebagai teks (K-05).
 * Kelayakan & pinjaman aktif sengaja tidak ada: itu milik alur peminjaman (FR-PJM-02, WP 5.4.6).
 * Foto dari `GET /admin/anggota/{kode}/foto` hanya bila `ada_foto` (OQ-42); kode dari respons API.
 */
export default async function DetailAnggota({ params }: { params: Promise<{ kode: string }> }) {
  const a = await ambilAnggota((await params).kode);
  return (
    <section className="flex flex-col gap-6">
      <Link href="/admin/anggota" className="text-sm font-semibold text-gold-700">
        ← Kembali ke daftar anggota
      </Link>
      <header className="flex flex-wrap items-center gap-4">
        <Avatar
          nama={a.nama}
          src={a.ada_foto ? `/api/v1/admin/anggota/${encodeURIComponent(a.kode)}/foto` : null}
          ukuran="besar"
        />
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl sm:text-4xl">{a.nama}</h1>
          <p className="angka text-navy/80">{a.kode}</p>
        </div>
      </header>

      <Kartu className="flex flex-col gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-navy/70">NIK</dt>
          <dd className="angka">{a.nik}</dd>
          <dt className="text-navy/70">Email</dt>
          <dd>{a.email}</dd>
          <dt className="text-navy/70">Telepon</dt>
          <dd className="angka">{a.telepon}</dd>
          <dt className="text-navy/70">Alamat sesuai KTP</dt>
          <dd>{a.alamat}</dd>
          <dt className="text-navy/70">Tanggal daftar</dt>
          <dd className="angka">{formatTanggal(a.tanggal_daftar)}</dd>
        </dl>
        <p className="text-xs text-navy/70">NIK dan foto tidak dapat diubah.</p>
        <div className="flex flex-wrap gap-2">
          <TautanTombol href={`/admin/anggota/${a.kode}/ubah`}>Ubah Data</TautanTombol>
          <TautanTombol
            href={`/admin/tagihan?anggota=${encodeURIComponent(a.kode)}`}
            varian="sekunder"
          >
            Lihat tagihan
          </TautanTombol>
        </div>
      </Kartu>
    </section>
  );
}

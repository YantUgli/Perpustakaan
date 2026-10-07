"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Isian } from "@/components/ui/Isian";
import { IsianBerkas } from "@/components/ui/IsianBerkas";
import { Pesan } from "@/components/ui/Pesan";
import { Pilihan } from "@/components/ui/Pilihan";
import { Tombol } from "@/components/ui/Tombol";
import { ambil } from "@/lib/api-klien";
import type { components } from "@/lib/api-skema";
import { type NilaiJudul, bodyJudul, pesanCoverGagal, validasiJudul } from "@/lib/data-admin";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";

type Kategori = components["schemas"]["KategoriKeluar"];
type Judul = components["schemas"]["JudulKeluar"];

type Props = {
  kategori: Kategori[];
  /** Ada = ubah judul ini; tidak ada = judul baru. */
  awal?: Judul;
};

/**
 * FR-BKU-02, FR-BKU-03, DR-05, NFR-SEC-06. Tahun dan harga dikirim sebagai integer (tanpa float). Cover
 * diperiksa di klien SEBELUM judul dikirim. Judul dan cover adalah dua permintaan (API terpisah): bila cover
 * gagal, judul tetap tersimpan dan pesan backend ditampilkan tanpa pembatalan otomatis.
 */
export function FormJudul({ kategori, awal }: Props) {
  const router = useRouter();
  const [nilai, setNilai] = useState<NilaiJudul>({
    isbn: awal?.isbn ?? "",
    judul: awal?.judul ?? "",
    penulis: awal?.penulis ?? "",
    penerbit: awal?.penerbit ?? "",
    tahun: awal ? String(awal.tahun) : "",
    kategori_id: awal ? String(awal.kategori.id) : "",
    harga: awal ? String(awal.harga) : "",
  });
  const [cover, setCover] = useState<File | null>(null);
  const [galatIsian, setGalatIsian] = useState<Record<string, string>>({});
  const [pesan, setPesan] = useState<string | null>(null);
  const [tersimpanId, setTersimpanId] = useState<number | null>(null);
  const [proses, setProses] = useState(false);

  const ubah = (k: keyof NilaiJudul) => (e: { target: { value: string } }) =>
    setNilai((n) => ({ ...n, [k]: e.target.value }));
  const pesanDari = (err: unknown) => (err instanceof GalatApi ? err.pesan : PESAN_SISTEM);

  // Judul baru yang sudah tersimpan (cover gagal) tidak boleh dikirim ulang: akan menjadi judul ganda.
  const terkunci = proses || (!awal && tersimpanId !== null);

  async function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (terkunci) return;
    setPesan(null);
    const galat = validasiJudul(nilai, cover);
    setGalatIsian(galat);
    if (Object.keys(galat).length > 0) return;

    setProses(true);
    let id: number;
    try {
      const tersimpan = await ambil<Judul>(awal ? `/admin/judul/${awal.id}` : "/admin/judul", {
        method: awal ? "PUT" : "POST",
        json: bodyJudul(nilai),
      });
      id = tersimpan.id;
    } catch (err) {
      setPesan(pesanDari(err));
      setGalatIsian(err instanceof GalatApi ? err.isian : {});
      setProses(false);
      return;
    }
    setTersimpanId(id);

    if (cover) {
      const data = new FormData();
      data.append("berkas", cover);
      try {
        await ambil(`/admin/judul/${id}/cover`, { method: "PUT", body: data });
      } catch (err) {
        setPesan(pesanCoverGagal(pesanDari(err)));
        setProses(false);
        return;
      }
    }
    router.push(`/admin/judul/${id}`);
  }

  const urlCover = awal?.cover_url;
  return (
    <form onSubmit={kirim} noValidate className="flex flex-col gap-5">
      {pesan && (
        <Pesan jenis="galat">
          <p>{pesan}</p>
          {!awal && tersimpanId !== null && (
            <p className="mt-2">
              <Link
                href={`/admin/judul/${tersimpanId}/ubah`}
                className="font-semibold underline underline-offset-4"
              >
                Buka halaman ubah judul ini
              </Link>
            </p>
          )}
        </Pesan>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Isian
          label="ISBN"
          name="isbn"
          required
          value={nilai.isbn}
          onChange={ubah("isbn")}
          galat={galatIsian.isbn}
          keterangan="10 karakter atau 13 digit; tanda hubung boleh."
        />
        <Isian
          label="Judul"
          name="judul"
          required
          value={nilai.judul}
          onChange={ubah("judul")}
          galat={galatIsian.judul}
        />
        <Isian
          label="Penulis"
          name="penulis"
          required
          value={nilai.penulis}
          onChange={ubah("penulis")}
          galat={galatIsian.penulis}
        />
        <Isian
          label="Penerbit"
          name="penerbit"
          required
          value={nilai.penerbit}
          onChange={ubah("penerbit")}
          galat={galatIsian.penerbit}
        />
        <Isian
          label="Tahun terbit"
          name="tahun"
          inputMode="numeric"
          autoComplete="off"
          required
          value={nilai.tahun}
          onChange={ubah("tahun")}
          galat={galatIsian.tahun}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <Pilihan
            label="Kategori"
            name="kategori_id"
            value={nilai.kategori_id}
            onChange={ubah("kategori_id")}
            opsi={[
              { nilai: "", label: "Pilih kategori" },
              ...kategori.map((k) => ({ nilai: String(k.id), label: k.nama })),
            ]}
          />
          {galatIsian.kategori_id && (
            <p className="text-sm text-status-hilang">{galatIsian.kategori_id}</p>
          )}
        </div>
        <Isian
          label="Harga (Rupiah)"
          name="harga"
          inputMode="numeric"
          autoComplete="off"
          required
          value={nilai.harga}
          onChange={ubah("harga")}
          galat={galatIsian.harga}
          keterangan="Rupiah bulat tanpa titik atau koma, mis. 98000. Berlaku untuk semua eksemplar judul ini."
        />
      </div>

      <div className="flex flex-wrap items-start gap-4">
        {urlCover && (
          // Cover publik per judul (path dari DB); next/image tidak dipakai.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlCover}
            alt={`Cover ${awal?.judul}`}
            className="h-32 w-24 rounded object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <IsianBerkas
            label={awal ? "Ganti cover" : "Cover (opsional)"}
            name="cover"
            accept="image/png,image/jpeg"
            teksTombol="Pilih Cover"
            teksKosong="Belum ada cover dipilih"
            berkas={cover}
            onPilih={setCover}
            galat={galatIsian.cover}
            keterangan={
              awal
                ? "JPG atau PNG, maksimal 2 MB. Cover hanya dapat diganti, tidak dapat dihapus."
                : "JPG atau PNG, maksimal 2 MB. Tanpa cover, katalog memakai gambar pengganti."
            }
          />
        </div>
      </div>

      <div>
        <Tombol type="submit" disabled={terkunci}>
          {proses ? "Menyimpan…" : "Simpan Judul"}
        </Tombol>
      </div>
    </form>
  );
}

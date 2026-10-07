"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { Pesan } from "@/components/ui/Pesan";
import { Tombol } from "@/components/ui/Tombol";
import { ambil } from "@/lib/api-klien";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";

/**
 * FR-BKU-02, OQ-12: hapus judul. Eksemplar judul ikut terhapus; judul yang pernah dipinjam ditolak backend,
 * dan `pesan`-nya ditampilkan apa adanya (IR-UI-04).
 */
export function HapusJudul({ id, judul }: { id: number; judul: string }) {
  const router = useRouter();
  const [terbuka, setTerbuka] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [proses, setProses] = useState(false);

  function buka() {
    setGalat(null);
    setTerbuka(true);
  }

  async function hapus() {
    setProses(true);
    setGalat(null);
    try {
      await ambil(`/admin/judul/${id}`, { method: "DELETE" });
      setTerbuka(false);
      router.push("/admin/judul");
    } catch (err) {
      setGalat(err instanceof GalatApi ? err.pesan : PESAN_SISTEM);
    } finally {
      setProses(false);
    }
  }

  return (
    <>
      <Tombol varian="sekunder" onClick={buka}>
        Hapus Judul
      </Tombol>
      <Modal
        terbuka={terbuka}
        judul="Hapus judul?"
        onTutup={() => setTerbuka(false)}
        aksi={
          <>
            <Tombol varian="sekunder" onClick={() => setTerbuka(false)}>
              Batal
            </Tombol>
            <Tombol disabled={proses} onClick={() => void hapus()}>
              Ya, Hapus
            </Tombol>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {galat && <Pesan jenis="galat">{galat}</Pesan>}
          <p>
            Judul <strong>{judul}</strong> akan dihapus beserta seluruh eksemplarnya. Judul yang
            pernah dipinjam tidak dapat dihapus.
          </p>
        </div>
      </Modal>
    </>
  );
}

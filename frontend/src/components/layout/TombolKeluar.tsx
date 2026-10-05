"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Pesan } from "@/components/ui/Pesan";
import { ambil } from "@/lib/api-klien";
import { GalatApi, PESAN_SISTEM } from "@/lib/galat";

type Props = { className?: string };

/** FR-AKN-06: logout mengakhiri sesi di server (backend menghapus cookie), lalu kembali ke beranda. */
export function TombolKeluar({ className = "" }: Props) {
  const router = useRouter();
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function keluar() {
    setProses(true);
    setGalat(null);
    try {
      await ambil("/auth/logout", { method: "POST" });
      router.replace("/");
      router.refresh();
    } catch (e) {
      // Galat tak terduga (bukan dari API) tidak ditampilkan mentah ke pengguna.
      setGalat(e instanceof GalatApi ? e.pesan : PESAN_SISTEM);
      setProses(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={keluar}
        disabled={proses}
        className={`text-left text-sm font-medium underline-offset-4 hover:underline disabled:opacity-60 ${className}`}
      >
        {proses ? "Keluar…" : "Keluar"}
      </button>
      {galat && <Pesan jenis="galat">{galat}</Pesan>}
    </div>
  );
}

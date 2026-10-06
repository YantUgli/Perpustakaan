"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

import { Isian } from "@/components/ui/Isian";
import { Pesan } from "@/components/ui/Pesan";
import { Tombol } from "@/components/ui/Tombol";
import type { KendaliPindai } from "@/lib/kamera-qr";
import { PESAN_KAMERA, buatPenyaringGanda, kameraDidukung, pesanGalatKamera } from "@/lib/pemindai";

type Props = {
  /** Nama kode yang dipindai, mis. "Kode eksemplar"; dipakai sebagai label input manual. */
  label: string;
  /** Teks hasil pindai/ketikan apa adanya; normalisasi & validasi kode di backend. */
  onHasil: (teks: string) => void;
  /** Induk sedang memproses: bacaan kamera dibuang (decisions §B "Jeda pindai ganda"), input manual dikunci. */
  nonaktif?: boolean;
};

type Keadaan = { jenis: "memuat" } | { jenis: "aktif" } | { jenis: "galat"; pesan: string };

/**
 * Pemindai QR via kamera browser dengan input manual yang SELALU tampil (IR-HW-01). Kamera belakang menyala
 * otomatis saat tampil (decisions §B "Kamera pemindai menyala otomatis") dan dihentikan saat unmount.
 * Kegagalan kamera → pesan spesifik + "Coba lagi" (IR-UI-04).
 */
export function Pemindai({ label, onHasil, nonaktif = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onHasilRef = useRef(onHasil);
  const nonaktifRef = useRef(nonaktif);
  const saringRef = useRef(buatPenyaringGanda());
  const [keadaan, setKeadaan] = useState<Keadaan>({ jenis: "memuat" });
  const [percobaan, setPercobaan] = useState(0);
  const [manual, setManual] = useState("");
  const [galatManual, setGalatManual] = useState<string>();

  useEffect(() => {
    onHasilRef.current = onHasil;
    nonaktifRef.current = nonaktif;
  });

  useEffect(() => {
    let batal = false;
    let kendali: KendaliPindai | null = null;

    const terima = (teks: string) => {
      if (saringRef.current(teks, Date.now(), { nonaktif: nonaktifRef.current })) {
        onHasilRef.current(teks);
      }
    };

    async function mulai() {
      await Promise.resolve();
      if (batal) return;
      if (!kameraDidukung()) {
        setKeadaan({ jenis: "galat", pesan: PESAN_KAMERA.tanpaHttps });
        return;
      }
      try {
        // Dimuat dinamis: library tidak ikut render server maupun bundle halaman lain.
        const { mulaiPindai } = await import("@/lib/kamera-qr");
        if (batal || !videoRef.current) return;
        const k = await mulaiPindai(videoRef.current, terima);
        if (batal) {
          k.hentikan();
          return;
        }
        kendali = k;
        setKeadaan({ jenis: "aktif" });
      } catch (galat) {
        if (!batal) setKeadaan({ jenis: "galat", pesan: pesanGalatKamera(galat) });
      }
    }

    void mulai();
    return () => {
      batal = true;
      kendali?.hentikan();
    };
  }, [percobaan]);

  function cobaLagi() {
    setKeadaan({ jenis: "memuat" });
    setPercobaan((n) => n + 1);
  }

  function kirimManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (manual.trim() === "") {
      setGalatManual(`${label} wajib diisi.`);
      return;
    }
    setGalatManual(undefined);
    onHasil(manual);
    setManual("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square w-full max-w-sm self-center overflow-hidden rounded-xl bg-navy">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Pratinjau kamera pemindai"
          className={`h-full w-full object-cover ${keadaan.jenis === "aktif" ? "" : "invisible"}`}
        />
        {keadaan.jenis === "memuat" && (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-ivory">
            Menyalakan kamera…
          </p>
        )}
        {keadaan.jenis === "galat" && (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-ivory">
            Kamera tidak aktif
          </p>
        )}
      </div>

      {keadaan.jenis === "galat" && (
        <div className="flex flex-col gap-2">
          <Pesan jenis="galat">{keadaan.pesan}</Pesan>
          {keadaan.pesan !== PESAN_KAMERA.tanpaHttps && (
            <Tombol varian="sekunder" onClick={cobaLagi} className="self-start">
              Coba lagi
            </Tombol>
          )}
        </div>
      )}

      <form onSubmit={kirimManual} noValidate className="flex flex-col gap-2">
        <Isian
          label={label}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          galat={galatManual}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={nonaktif}
        />
        <Tombol type="submit" disabled={nonaktif}>
          Gunakan
        </Tombol>
      </form>
    </div>
  );
}

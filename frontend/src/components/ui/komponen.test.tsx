// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AreaIsian } from "./AreaIsian";
import { Avatar, inisial } from "./Avatar";
import { Isian } from "./Isian";
import { IsianBerkas } from "./IsianBerkas";
import { LabelStatus } from "./LabelStatus";
import { Paginasi } from "./Paginasi";
import { Pesan } from "./Pesan";
import { kelasTombol } from "./Tombol";
import { FormCari } from "@/components/katalog/FormCari";

afterEach(cleanup);

describe("LabelStatus (IR-UI-03)", () => {
  it("IR_UI_03_label_status_selalu_berisi_teks", () => {
    render(<LabelStatus status="DIKEMBALIKAN" />);
    const badge = screen.getByText("Dikembalikan");
    expect(badge.className).toContain("bg-status-dikembalikan-bg");
  });

  it("IR_UI_03_terlambat_dari_prop_terlambat", () => {
    render(<LabelStatus status="DIPINJAM" terlambat />);
    expect(screen.getByText("Terlambat").className).toContain("text-status-terlambat");
    expect(screen.queryByText("Dipinjam")).toBeNull();
  });

  it("Belum Lunas memakai warna hilang, Lunas memakai warna tersedia", () => {
    render(
      <>
        <LabelStatus status="BELUM_LUNAS" />
        <LabelStatus status="LUNAS" />
      </>,
    );
    expect(screen.getByText("Belum Lunas").className).toContain("text-status-hilang");
    expect(screen.getByText("Lunas").className).toContain("text-status-tersedia");
  });
});

describe("Avatar (OQ-42)", () => {
  it.each([
    ["Aulia Rahma", "AR"],
    ["  siti   nur   aisyah ", "SA"],
    ["Aulia", "A"],
    ["", "?"],
  ])("OQ_42_inisial: %j → %s", (nama, hasil) => {
    expect(inisial(nama)).toBe(hasil);
  });

  it("OQ_42_avatar_inisial_tanpa_foto", () => {
    render(<Avatar nama="Aulia Rahma" />);
    expect(screen.getByRole("img", { name: "Aulia Rahma" }).textContent).toBe("AR");
  });

  it("OQ_42_avatar_dengan_src_menampilkan_img", () => {
    render(<Avatar nama="Aulia Rahma" src="/api/v1/anggota/profil/foto" />);
    const img = screen.getByRole("img", { name: "Foto Aulia Rahma" });
    expect(img.getAttribute("src")).toBe("/api/v1/anggota/profil/foto");
  });

  it("OQ_42_avatar_src_null_tampil_inisial_tanpa_img", () => {
    const { container } = render(<Avatar nama="Aulia Rahma" src={null} />);
    expect(screen.getByRole("img", { name: "Aulia Rahma" }).textContent).toBe("AR");
    expect(container.querySelector("img")).toBeNull();
  });

  it("OQ_42_avatar_foto_gagal_dimuat_kembali_ke_inisial", () => {
    const { container } = render(<Avatar nama="Aulia Rahma" src="/api/v1/anggota/profil/foto" />);
    fireEvent.error(screen.getByRole("img", { name: "Foto Aulia Rahma" }));
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "Aulia Rahma" }).textContent).toBe("AR");
  });

  it("OQ_42_avatar_foto_sudah_gagal_sebelum_hydration_kembali_ke_inisial", () => {
    // onError yang terjadi sebelum React terpasang tidak pernah sampai ke handler; gambar rusak
    // dikenali dari complete=true dan naturalWidth=0 saat effect berjalan.
    const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    const lebar = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    try {
      const { container } = render(<Avatar nama="Aulia Rahma" src="/api/v1/anggota/profil/foto" />);
      expect(container.querySelector("img")).toBeNull();
      expect(screen.getByRole("img", { name: "Aulia Rahma" }).textContent).toBe("AR");
    } finally {
      complete.mockRestore();
      lebar.mockRestore();
    }
  });

  it("OQ_42_avatar_foto_sudah_termuat_sebelum_hydration_tetap_tampil", () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    const lebar = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(96);
    try {
      render(<Avatar nama="Aulia Rahma" src="/api/v1/anggota/profil/foto" />);
      expect(screen.getByRole("img", { name: "Foto Aulia Rahma" })).toBeTruthy();
    } finally {
      complete.mockRestore();
      lebar.mockRestore();
    }
  });
});

describe("Isian & Pesan (IR-UI-04)", () => {
  it("IR_UI_04_isian_menampilkan_pesan_galat_backend", () => {
    render(<Isian label="NIK" name="nik" galat="NIK harus tepat 16 digit angka." />);
    const input = screen.getByLabelText("NIK");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const idGalat = input.getAttribute("aria-describedby");
    expect(idGalat).toBeTruthy();
    expect(document.getElementById(idGalat!)?.textContent).toBe("NIK harus tepat 16 digit angka.");
  });

  it("isian tanpa galat tidak bertanda invalid", () => {
    render(<Isian label="Email" name="email" />);
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBeNull();
  });

  it("IR_UI_04_pesan_galat_tampil_penuh_dan_diumumkan", () => {
    const pesan = "Eksemplar EKS-000012 berstatus Dipinjam sehingga tidak dapat dipinjam.";
    render(<Pesan jenis="galat">{pesan}</Pesan>);
    expect(screen.getByRole("alert").textContent).toBe(pesan);
  });
});

describe("Tombol (decisions §B, keputusan 2026-10-06)", () => {
  it("primer: latar gold-700 + teks putih (5,51, AA); sekunder: outline navy", () => {
    expect(kelasTombol("primer")).toContain("bg-gold-700 text-white");
    // Gold #B08D57 tidak lagi menjadi latar tombol, dan teks navy di atas gold tidak dipakai lagi.
    expect(kelasTombol("primer")).not.toMatch(/\bbg-gold\b(?!-)|\btext-navy\b/);
    expect(kelasTombol("sekunder")).toContain("border-navy");
    // Fokus terlihat di latar terang (outline navy) maupun di latar navy (cincin ivory).
    expect(kelasTombol("primer")).toContain("focus-visible:outline-navy");
    expect(kelasTombol("primer")).toContain("focus-visible:ring-ivory");
  });

  it("tombol Cari di FormCari memakai kelas varian primer yang sama", () => {
    render(<FormCari />);
    const cari = screen.getByRole("button", { name: "Cari" });
    for (const k of kelasTombol("primer").split(/\s+/)) expect(cari.className).toContain(k);
  });
});

describe("IsianBerkas (NFR-USA-02, IR-UI-04)", () => {
  function Uji({
    galat,
    onPilih = () => {},
  }: {
    galat?: string;
    onPilih?: (b: File | null) => void;
  }) {
    const [berkas, setBerkas] = useState<File | null>(null);
    return (
      <IsianBerkas
        label="Foto (opsional)"
        name="foto"
        accept="image/jpeg,image/png"
        teksTombol="Pilih Foto"
        teksKosong="Belum ada foto dipilih"
        berkas={berkas}
        onPilih={(b) => {
          setBerkas(b);
          onPilih(b);
        }}
        galat={galat}
      />
    );
  }

  it("NFR_USA_02_tombol_pilih_foto_memicu_input_file (tanpa teks bawaan peramban)", () => {
    render(<Uji />);
    const input = screen.getByLabelText("Foto (opsional)") as HTMLInputElement;
    expect(input.type).toBe("file");
    expect(input.className).toContain("sr-only");
    expect(input.getAttribute("accept")).toBe("image/jpeg,image/png");
    const klik = vi.fn();
    input.addEventListener("click", klik);
    fireEvent.click(screen.getByText("Pilih Foto"));
    expect(klik).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Belum ada foto dipilih")).toBeTruthy();
    expect(screen.queryByText(/choose file|no file chosen/i)).toBeNull();
  });

  it("nama berkas tampil setelah dipilih dan diteruskan ke induk", () => {
    const onPilih = vi.fn();
    render(<Uji onPilih={onPilih} />);
    const foto = new File([new Uint8Array(5)], "ktp-aulia.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Foto (opsional)"), { target: { files: [foto] } });
    expect(screen.getByText("ktp-aulia.png")).toBeTruthy();
    expect(screen.queryByText("Belum ada foto dipilih")).toBeNull();
    expect(onPilih).toHaveBeenCalledWith(foto);
  });

  it("IR_UI_04_galat_foto_tertempel_pada_input", () => {
    render(<Uji galat="Ukuran berkas melebihi batas 2 MB." />);
    const input = screen.getByLabelText("Foto (opsional)");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    const teks = ids.map((id) => document.getElementById(id)?.textContent);
    expect(teks).toContain("Ukuran berkas melebihi batas 2 MB.");
  });
});

describe("lebar isian aman di layar sempit (360–414 px)", () => {
  it("Isian & AreaIsian: wrapper min-w-0, kontrol w-full min-w-0", () => {
    render(
      <>
        <Isian label="Nama" name="nama" />
        <AreaIsian label="Alamat" name="alamat" />
      </>,
    );
    for (const label of ["Nama", "Alamat"]) {
      const kontrol = screen.getByLabelText(label);
      expect(kontrol.className).toContain("w-full");
      expect(kontrol.className).toContain("min-w-0");
      expect(kontrol.parentElement!.className).toContain("min-w-0");
    }
  });
});

describe("Paginasi (FR-AGT-03/04)", () => {
  it("halaman tengah: tautan sebelumnya & berikutnya", () => {
    render(<Paginasi halaman={2} total={45} perHalaman={20} path="/anggota/riwayat" />);
    expect(screen.getByRole("link", { name: "Sebelumnya" }).getAttribute("href")).toBe(
      "/anggota/riwayat?halaman=1",
    );
    expect(screen.getByRole("link", { name: "Berikutnya" }).getAttribute("href")).toBe(
      "/anggota/riwayat?halaman=3",
    );
    expect(screen.getByText("Halaman 2 dari 3")).toBeTruthy();
  });

  it("ujung: tombol nonaktif (bukan tautan)", () => {
    render(<Paginasi halaman={1} total={5} perHalaman={20} path="/anggota/tagihan" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Sebelumnya").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Berikutnya").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Halaman 1 dari 1")).toBeTruthy();
  });
});

describe("Paginasi mempertahankan filter (FR-TGH-01)", () => {
  it("params ikut di setiap tautan, nilai kosong dibuang", () => {
    render(
      <Paginasi
        halaman={2}
        total={60}
        perHalaman={20}
        path="/admin/tagihan"
        params={{ status: "BELUM_LUNAS", jenis: undefined, anggota: "AGT-000001" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Berikutnya" }).getAttribute("href")).toBe(
      "/admin/tagihan?status=BELUM_LUNAS&anggota=AGT-000001&halaman=3",
    );
  });
});

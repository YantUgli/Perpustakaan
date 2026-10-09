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

  it("tanpa awalan/akhiran: input langsung di bawah wrapper, kelas tanpa padding tambahan", () => {
    const { container } = render(<Isian label="Email" name="email" />);
    const input = screen.getByLabelText("Email");
    expect(input.parentElement).toBe(container.firstElementChild);
    expect(input.className).not.toMatch(/\bpl-11\b|\bpr-12\b|\s{2}/);
  });

  it("IR_UI_04_awalan_akhiran_tidak_mengubah_aria_pada_input", () => {
    render(
      <Isian
        label="Password"
        name="password"
        galat="Password wajib diisi."
        awalan={<span data-testid="awalan" />}
        akhiran={<button type="button">Tampilkan password</button>}
      />,
    );
    const input = screen.getByLabelText("Password");
    expect(input.className).toContain("pl-11");
    expect(input.className).toContain("pr-12");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const idGalat = input.getAttribute("aria-describedby");
    expect(document.getElementById(idGalat!)?.textContent).toBe("Password wajib diisi.");
    expect(screen.getByTestId("awalan").parentElement?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("button", { name: "Tampilkan password" })).toBeTruthy();
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

/*
 * Patokan DOM diambil dari AreaIsian & IsianBerkas SEBELUM prop `awalan` ditambahkan (09/10/2026, hal-08):
 * tanpa `awalan`, pemakai lama harus mendapat DOM & kelas yang sama persis.
 */
const PATOKAN = {
  AREA: '<div class="flex min-w-0 flex-col gap-1.5"><label for="alamat" class="text-sm font-medium text-navy">Alamat</label><textarea id="alamat" rows="3" class="w-full min-w-0 rounded-lg border bg-surface px-3 py-2 text-navy placeholder:text-navy/50 focus:outline-2 focus:outline-offset-1 focus:outline-navy border-navy/40 " name="alamat"></textarea></div>',
  AREA_GALAT:
    '<div class="flex min-w-0 flex-col gap-1.5"><label for="alamat" class="text-sm font-medium text-navy">Alamat<span aria-hidden="true" class="text-status-hilang"> *</span></label><textarea id="alamat" required="" rows="3" aria-invalid="true" aria-describedby="alamat-galat" class="w-full min-w-0 rounded-lg border bg-surface px-3 py-2 text-navy placeholder:text-navy/50 focus:outline-2 focus:outline-offset-1 focus:outline-navy border-status-hilang " name="alamat" placeholder="X"></textarea><p id="alamat-galat" class="text-sm text-status-hilang">Alamat wajib diisi.</p></div>',
  BERKAS:
    '<div class="flex min-w-0 flex-col gap-1.5"><label for="foto" class="text-sm font-medium text-navy">Foto</label><div class="flex min-w-0 flex-wrap items-center gap-3"><input id="foto" aria-describedby="foto-nama foto-ket" class="peer sr-only" type="file" name="foto"><label for="foto" class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy focus-visible:ring-2 focus-visible:ring-ivory disabled:cursor-not-allowed disabled:opacity-60 bg-transparent text-navy border border-navy hover:bg-navy/5 cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy ">Pilih Foto</label><span id="foto-nama" aria-live="polite" class="min-w-0 truncate text-sm text-navy/80">Belum ada foto dipilih</span></div><p id="foto-ket" class="text-xs text-navy/70">Ket.</p></div>',
  BERKAS_GALAT:
    '<div class="flex min-w-0 flex-col gap-1.5"><label for="foto" class="text-sm font-medium text-navy">Foto</label><div class="flex min-w-0 flex-wrap items-center gap-3"><input id="foto" aria-invalid="true" aria-describedby="foto-nama foto-galat" class="peer sr-only" type="file" name="foto"><label for="foto" class="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy focus-visible:ring-2 focus-visible:ring-ivory disabled:cursor-not-allowed disabled:opacity-60 bg-transparent text-navy border border-navy hover:bg-navy/5 cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy border-status-hilang">Pilih Berkas</label><span id="foto-nama" aria-live="polite" class="min-w-0 truncate text-sm text-navy/80">Belum ada berkas dipilih</span></div><p id="foto-galat" class="text-sm text-status-hilang">Galat.</p></div>',
};

describe("AreaIsian & IsianBerkas: prop awalan (hal-08)", () => {
  it("AreaIsian_tanpa_awalan_DOM_lama", () => {
    const a = render(<AreaIsian id="alamat" label="Alamat" name="alamat" />);
    expect(a.container.innerHTML).toBe(PATOKAN.AREA);
    a.unmount();
    const b = render(
      <AreaIsian
        id="alamat"
        label="Alamat"
        name="alamat"
        required
        galat="Alamat wajib diisi."
        placeholder="X"
      />,
    );
    expect(b.container.innerHTML).toBe(PATOKAN.AREA_GALAT);
  });

  it("IsianBerkas_tanpa_awalan_DOM_lama", () => {
    const a = render(
      <IsianBerkas
        id="foto"
        label="Foto"
        name="foto"
        berkas={null}
        onPilih={() => {}}
        teksTombol="Pilih Foto"
        teksKosong="Belum ada foto dipilih"
        keterangan="Ket."
      />,
    );
    expect(a.container.innerHTML).toBe(PATOKAN.BERKAS);
    a.unmount();
    const b = render(
      <IsianBerkas
        id="foto"
        label="Foto"
        name="foto"
        berkas={null}
        onPilih={() => {}}
        galat="Galat."
      />,
    );
    expect(b.container.innerHTML).toBe(PATOKAN.BERKAS_GALAT);
  });

  it("AreaIsian_IsianBerkas_awalan_aria_hidden_dan_aria_input_tidak_berubah", () => {
    const ikon = <svg data-uji="ikon" />;
    const { container } = render(
      <>
        <AreaIsian id="alamat" label="Alamat" name="alamat" galat="Wajib." awalan={ikon} />
        <IsianBerkas
          id="foto"
          label="Foto"
          name="foto"
          berkas={null}
          onPilih={() => {}}
          galat="Galat."
          awalan={ikon}
        />
      </>,
    );
    const ikonAll = container.querySelectorAll('[data-uji="ikon"]');
    expect(ikonAll.length).toBe(2);
    for (const i of ikonAll) {
      const bungkus = i.parentElement!;
      expect(bungkus.getAttribute("aria-hidden")).toBe("true");
      expect(bungkus.className).toContain("pointer-events-none");
    }
    const area = screen.getByLabelText("Alamat");
    expect(area.getAttribute("aria-invalid")).toBe("true");
    expect(area.getAttribute("aria-describedby")).toBe("alamat-galat");
    expect(area.className).toContain("pl-11");
    const berkas = screen.getByLabelText("Foto");
    expect(berkas.getAttribute("aria-invalid")).toBe("true");
    expect(berkas.getAttribute("aria-describedby")).toBe("foto-nama foto-galat");
    expect(berkas.className).toContain("sr-only");
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

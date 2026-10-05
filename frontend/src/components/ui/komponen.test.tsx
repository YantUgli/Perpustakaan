// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Avatar, inisial } from "./Avatar";
import { Isian } from "./Isian";
import { LabelStatus } from "./LabelStatus";
import { Pesan } from "./Pesan";
import { kelasTombol } from "./Tombol";

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

describe("Tombol (P2, decisions §B)", () => {
  it("primer: latar gold + teks navy; sekunder: outline navy", () => {
    expect(kelasTombol("primer")).toContain("bg-gold text-navy");
    expect(kelasTombol("primer")).not.toContain("text-white");
    expect(kelasTombol("sekunder")).toContain("border-navy");
  });
});

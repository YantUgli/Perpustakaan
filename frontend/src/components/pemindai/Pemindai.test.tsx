// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PESAN_KAMERA } from "@/lib/pemindai";

type Panggilan = {
  onTeks: (teks: string) => void;
  hentikan: ReturnType<typeof vi.fn>;
  selesai: () => void;
  gagal: (galat: unknown) => void;
};
const panggilan: Panggilan[] = [];

vi.mock("@/lib/kamera-qr", () => ({
  mulaiPindai: (_video: HTMLVideoElement, onTeks: (teks: string) => void) =>
    new Promise((resolve, reject) => {
      const hentikan = vi.fn();
      panggilan.push({
        onTeks,
        hentikan,
        selesai: () => resolve({ hentikan }),
        gagal: reject,
      });
    }),
}));

const { Pemindai } = await import("./Pemindai");

function aturKamera(didukung: boolean) {
  Object.defineProperty(window, "isSecureContext", { value: didukung, configurable: true });
  Object.defineProperty(navigator, "mediaDevices", {
    value: didukung ? { getUserMedia: vi.fn() } : undefined,
    configurable: true,
  });
}

function galatDom(name: string) {
  const g = new Error("x");
  g.name = name;
  return g;
}

let sekarang = 0;
beforeEach(() => {
  panggilan.length = 0;
  sekarang = 0;
  vi.spyOn(Date, "now").mockImplementation(() => sekarang);
  aturKamera(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function tampilkan(props: Partial<Parameters<typeof Pemindai>[0]> = {}) {
  const onHasil = vi.fn();
  const hasil = render(<Pemindai label="Kode eksemplar" onHasil={onHasil} {...props} />);
  await waitFor(() => expect(panggilan).toHaveLength(1));
  return { onHasil, ...hasil };
}

async function kameraAktif() {
  await act(async () => panggilan[0].selesai());
}

const isian = () => screen.getByLabelText("Kode eksemplar") as HTMLInputElement;
const ketikDanKirim = (nilai: string) => {
  fireEvent.change(isian(), { target: { value: nilai } });
  fireEvent.click(screen.getByRole("button", { name: "Gunakan" }));
};

describe("Pemindai (IR-HW-01)", () => {
  it("test_IR_HW_01_kamera_menyala_otomatis_dan_input_manual_tampil", async () => {
    const { onHasil } = await tampilkan();
    await kameraAktif();
    expect(isian()).toBeTruthy();
    ketikDanKirim("EKS-000001");
    expect(onHasil).toHaveBeenCalledWith("EKS-000001");
  });

  it("test_IR_HW_01_IR_UI_04_izin_ditolak_pesan_spesifik_input_manual_tetap_berfungsi", async () => {
    const { onHasil } = await tampilkan();
    await act(async () => panggilan[0].gagal(galatDom("NotAllowedError")));
    expect(screen.getByRole("alert").textContent).toBe(PESAN_KAMERA.izinDitolak);
    ketikDanKirim("EKS-000002");
    expect(onHasil).toHaveBeenCalledWith("EKS-000002");
  });

  it("test_IR_UI_04_kamera_sedang_dipakai_pesan_lengkap", async () => {
    await tampilkan();
    await act(async () => panggilan[0].gagal(galatDom("NotReadableError")));
    expect(screen.getByRole("alert").textContent).toBe(PESAN_KAMERA.sedangDipakai);
  });

  it("test_IR_HW_01_tanpa_https_library_tidak_dipanggil", async () => {
    aturKamera(false);
    const onHasil = vi.fn();
    render(<Pemindai label="Kode eksemplar" onHasil={onHasil} />);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", PESAN_KAMERA.tanpaHttps);
    expect(panggilan).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
    ketikDanKirim("EKS-000003");
    expect(onHasil).toHaveBeenCalledWith("EKS-000003");
  });

  it("test_IR_UI_04_coba_lagi_menyalakan_ulang_kamera", async () => {
    await tampilkan();
    await act(async () => panggilan[0].gagal(galatDom("NotFoundError")));
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(panggilan).toHaveLength(2));
    await act(async () => panggilan[1].selesai());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Pemindai: keluaran apa adanya (tanpa aturan bisnis)", () => {
  it("test_hasil_pindai_diteruskan_apa_adanya", async () => {
    const { onHasil } = await tampilkan();
    await kameraAktif();
    act(() => panggilan[0].onTeks(" eks-000012 "));
    expect(onHasil).toHaveBeenCalledWith(" eks-000012 ");
  });

  it("test_input_manual_diteruskan_apa_adanya_lalu_dikosongkan", async () => {
    const { onHasil } = await tampilkan();
    ketikDanKirim(" agt-000001 ");
    expect(onHasil).toHaveBeenCalledWith(" agt-000001 ");
    expect(isian().value).toBe("");
  });

  it("test_input_manual_kosong_atau_spasi_saja_ditahan", async () => {
    const { onHasil } = await tampilkan();
    ketikDanKirim("");
    ketikDanKirim("   ");
    expect(onHasil).not.toHaveBeenCalled();
    expect(screen.getByText("Kode eksemplar wajib diisi.")).toBeTruthy();
  });
});

describe("Pemindai: jeda pindai ganda", () => {
  it("test_pindai_ganda_kode_sama_beruntun_terkirim_sekali", async () => {
    const { onHasil } = await tampilkan();
    await kameraAktif();
    act(() => panggilan[0].onTeks("EKS-000001"));
    sekarang = 500;
    act(() => panggilan[0].onTeks("EKS-000001"));
    sekarang = 1000;
    act(() => panggilan[0].onTeks("EKS-000002"));
    expect(onHasil.mock.calls).toEqual([["EKS-000001"], ["EKS-000002"]]);
  });

  it("test_pindai_ganda_input_manual_tidak_terkena_jeda", async () => {
    const { onHasil } = await tampilkan();
    await kameraAktif();
    act(() => panggilan[0].onTeks("EKS-000001"));
    ketikDanKirim("EKS-000001");
    expect(onHasil.mock.calls).toEqual([["EKS-000001"], ["EKS-000001"]]);
  });

  it("test_nonaktif_kode_sama_tetap_memperpanjang_jeda", async () => {
    const { onHasil, rerender } = await tampilkan();
    await kameraAktif();
    act(() => panggilan[0].onTeks("EKS-000001"));
    rerender(<Pemindai label="Kode eksemplar" onHasil={onHasil} nonaktif />);
    sekarang = 2500;
    act(() => panggilan[0].onTeks("EKS-000001"));
    rerender(<Pemindai label="Kode eksemplar" onHasil={onHasil} />);
    sekarang = 4000;
    act(() => panggilan[0].onTeks("EKS-000001"));
    expect(onHasil.mock.calls).toEqual([["EKS-000001"]]);
    expect(isian().disabled).toBe(false);
  });

  it("test_nonaktif_kode_berbeda_dibuang_lalu_langsung_lolos", async () => {
    const { onHasil, rerender } = await tampilkan();
    await kameraAktif();
    rerender(<Pemindai label="Kode eksemplar" onHasil={onHasil} nonaktif />);
    act(() => panggilan[0].onTeks("EKS-000009"));
    expect(onHasil).not.toHaveBeenCalled();
    expect(isian().disabled).toBe(true);
    rerender(<Pemindai label="Kode eksemplar" onHasil={onHasil} />);
    sekarang = 100;
    act(() => panggilan[0].onTeks("EKS-000009"));
    expect(onHasil.mock.calls).toEqual([["EKS-000009"]]);
  });
});

describe("Pemindai: siklus hidup kamera", () => {
  it("test_kamera_dihentikan_saat_unmount", async () => {
    const { unmount } = await tampilkan();
    await kameraAktif();
    unmount();
    expect(panggilan[0].hentikan).toHaveBeenCalledTimes(1);
  });

  it("test_unmount_sebelum_kamera_siap_tetap_dihentikan", async () => {
    const { unmount } = await tampilkan();
    unmount();
    await act(async () => panggilan[0].selesai());
    expect(panggilan[0].hentikan).toHaveBeenCalledTimes(1);
  });
});

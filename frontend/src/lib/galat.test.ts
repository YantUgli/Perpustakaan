import { describe, expect, it } from "vitest";

import { GalatApi, PESAN_JARINGAN, PESAN_SISTEM, bacaGalat, galatJaringan } from "./galat";

function json(status: number, isi: unknown): Response {
  return new Response(JSON.stringify(isi), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("bacaGalat (IR-UI-04, format galat decisions §B)", () => {
  it("IR_UI_04_galat_bisnis_pesan_apa_adanya", async () => {
    const pesan = "Anggota memiliki 2 tagihan Belum Lunas dengan total Rp35.555.";
    const g = await bacaGalat(
      json(422, { detail: { kode: "PJM_ADA_TAGIHAN", pesan, rujukan: "FR-PJM-03" } }),
    );
    expect(g).toBeInstanceOf(GalatApi);
    expect(g).toMatchObject({
      status: 422,
      kode: "PJM_ADA_TAGIHAN",
      pesan,
      rujukan: "FR-PJM-03",
      isian: {},
      sistem: false,
    });
    expect(g.message).toBe(pesan);
  });

  it("IR_UI_04_isian_per_field_dari_detail_isian", async () => {
    const g = await bacaGalat(
      json(422, {
        detail: {
          kode: "VALIDASI_ISIAN",
          pesan: "NIK dan email tidak valid.",
          rujukan: "IR-UI-04",
          isian: { nik: "NIK harus tepat 16 digit angka.", email: "Format email tidak valid." },
        },
      }),
    );
    expect(g.isian).toEqual({
      nik: "NIK harus tepat 16 digit angka.",
      email: "Format email tidak valid.",
    });
  });

  it("rujukan opsional boleh null", async () => {
    const g = await bacaGalat(
      json(409, { detail: { kode: "X", pesan: "Duplikat.", rujukan: null } }),
    );
    expect(g.rujukan).toBeNull();
    expect(g.sistem).toBe(false);
  });

  it.each([
    ["5xx berisi HTML", new Response("<html>Bad Gateway</html>", { status: 502 })],
    ["JSON tanpa bentuk galat", json(404, { detail: "Not Found" })],
    [
      "JSON rusak",
      new Response("{", { status: 500, headers: { "content-type": "application/json" } }),
    ],
  ])("IR_UI_04_galat_non_bisnis_pakai_pesan_sistem: %s", async (_nama, res) => {
    const g = await bacaGalat(res);
    expect(g).toMatchObject({ kode: "SISTEM", pesan: PESAN_SISTEM, sistem: true, isian: {} });
    expect(g.status).toBe(res.status);
  });

  it("IR_UI_04_galat_jaringan_pakai_pesan_jaringan", () => {
    const g = galatJaringan(new TypeError("fetch failed"));
    expect(g).toMatchObject({ kode: "JARINGAN", pesan: PESAN_JARINGAN, sistem: true, status: 0 });
  });
});

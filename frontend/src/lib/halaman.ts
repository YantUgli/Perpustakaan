/** Daftar berhalaman (FR-KTL-04, FR-AGT-03/04, decisions §B "Daftar berhalaman"). */

/** `?halaman=` → bilangan bulat ≥ 1; selain itu 1 (backend menolak < 1 dengan 422). */
export function halamanDariParam(nilai: string | string[] | undefined): number {
  if (typeof nilai !== "string" || !/^[1-9][0-9]*$/.test(nilai)) return 1;
  return Number(nilai);
}

/** Jumlah halaman untuk navigasi; minimal 1 agar daftar kosong tetap punya satu halaman. */
export function jumlahHalaman(total: number, perHalaman: number): number {
  return Math.max(1, Math.ceil(total / perHalaman));
}

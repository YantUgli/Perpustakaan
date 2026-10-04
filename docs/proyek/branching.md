# Aturan Repositori dan Branching (WBS 5.1.1)

## Cabang

| Cabang | Isi | Aturan |
|---|---|---|
| `main` | Versi stabil, siap dipasang ke staging/produksi | Hanya menerima merge dari `develop` (rilis) atau `hotfix/*`. Tidak ada commit langsung. |
| `develop` | Integrasi WP yang sudah selesai | Menerima merge dari `wp/*` dan `chore/*` setelah review. |
| `wp/<kode>-<slug>` | Satu paket kerja WBS, misal `wp/5.3.8-peminjaman` | Dibuat dari `develop`. Satu WP = satu cabang (sesuai aturan "satu sesi = satu WP"). |
| `chore/<slug>` | Tugas kecil di luar WP (perapian, catatan, CI), misal `chore/ci` | Dibuat dari `develop`. Satu tugas = satu cabang. Jenis commit `chore`, `docs`, atau `fix`. |
| `hotfix/<slug>` | Perbaikan mendesak di produksi | Dibuat dari `main`, di-merge ke `main` **dan** `develop`. |

Syarat merge `wp/*` atau `chore/*` → `develop`: definisi selesai terpenuhi
(test lulus, lint bersih, `progress.md` diperbarui bila relevan) dan direview minimal satu anggota tim lain.

## Pesan commit

Format: `<jenis>(<lingkup>): <ringkasan>` dalam Bahasa Indonesia, lingkup = kode WP atau modul.

- Jenis: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `db` (migration).
- Contoh: `feat(5.3.8): tolak item keempat saat pemindaian (FR-PJM-08)`.
- Sebutkan kode kebutuhan (FR-/NFR-) bila commit menyentuh perilaku bisnis.
- Commit hanya dibuat bila diminta pemilik repo.

## Yang wajib / dilarang di-commit

- **Wajib:** `backend/uv.lock`, `frontend/package-lock.json`, `*.env.example`.
- **Dilarang:** `.env`, `.env.local`, kredensial apa pun (termasuk akun admin seed — diambil dari env saat seed,
  WP 5.2.2), folder unggahan `backend/storage/`.
- Migration yang sudah di-commit tidak diedit; perubahan skema lewat migration baru (NFR-MNT-01).

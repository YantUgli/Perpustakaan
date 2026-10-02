# Keputusan dan Asumsi

## A. Keputusan klarifikasi yang mengikat (SRS BAB 3)

| Kode | Keputusan |
|---|---|
| K-01 | Lapor hilang secara lisan; admin yang mencatat. Tidak ada menu lapor hilang di area anggota. |
| K-02 | Rusak di luar transaksi: admin ubah status eksemplar Tersedia → Rusak, tanpa tagihan. |
| K-03 | Tidak ada lupa password mandiri. Admin menetapkan password baru lewat ubah data anggota. |
| K-04 | Akun admin hanya lewat seed saat instalasi. |
| K-05 | Foto anggota hanya saat daftar, tidak bisa diubah. |
| K-06 | Ubah email tetap cek keunikan. |
| K-07 | Semua tanggal Asia/Jakarta (WIB). |
| K-08 | Hosting & domain HTTPS disediakan tim. |
| K-09 | Satu programmer frontend, satu backend. |

## B. Default teknis (boleh diganti tim, ubah di sini bila berubah)

Bagian ini mengisi celah yang di WBS menjadi tanggung jawab System Analyst/Data Engineer (WBS 3.2–3.5).
Bila dokumen desain final dari SA/DE sudah ada, **dokumen itu yang dipakai** dan tabel ini diperbarui.

| Area | Default |
|---|---|
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic, pytest |
| Paket backend | `uv` + `pyproject.toml`; `uv.lock` wajib di-commit |
| Driver DB | `psycopg` v3, **sinkron** (SQLAlchemy `postgresql+psycopg`). Endpoint `def`, bukan `async def` |
| Lint/format backend | Ruff (`ruff check`, `ruff format`); aturan `DTZ` aktif untuk menjaga K-07 |
| PostgreSQL dev/test | `docker-compose.yml` di root, image `postgres:16` (tag dipatok), port host **5434**; DB `perpustakaan` (dev) dan `perpustakaan_test` (pytest, wajib berakhiran `_test`) |
| Frontend | Next.js App Router + TypeScript, Tailwind |
| Lint/format/test frontend | ESLint (konfigurasi Next) + Prettier (`eslint-config-prettier`), Vitest; Node ≥ 24 |
| Arsitektur backend | `api/` (router tipis) → `services/` (aturan bisnis, transaksi DB) → `models/`. Aturan bisnis **tidak** boleh di router. |
| Kontrak API | OpenAPI otomatis dari FastAPI adalah kontrak (IR-COM-01). Prefix `/api/v1`. |
| Format error | `{"detail": {"kode": "PJM_ITEM_MELEBIHI_BATAS", "pesan": "<kalimat Indonesia spesifik>", "rujukan": "FR-PJM-08"}}` |
| QR scan (frontend) | library pemindai QR berbasis kamera browser (mis. `html5-qrcode` atau `@zxing/browser`) |
| QR generate | dibuat di backend atau frontend; isi QR = kode teks polos |
| Ekspor | PDF dan `.xlsx` dibuat di backend (mis. `openpyxl` untuk Excel) |
| Penyimpanan file | cover & foto: JPG/PNG ≤ 2 MB (NFR-SEC-06), disimpan di disk/volume, path di DB |
| CI | **Ditunda** (diputuskan 2026-10-02). Dibuat setelah repo punya remote, sebagai tugas kecil terpisah di luar WP fitur: jalankan pytest, Ruff, ESLint/Prettier, Vitest, dan build di setiap PR. Jangan dikerjakan di dalam WP mana pun. |

## C. Pertanyaan terbuka (OQ) — default sementara

Pakai default ini dan tandai di kode `ASUMSI(OQ-xx)`. Konfirmasi ke BA/SA sebelum UAT.

| Kode | Pertanyaan | Default sementara |
|---|---|---|
| OQ-01 | 10% harga bisa menghasilkan pecahan rupiah (mis. harga Rp15.555). Pembulatan bagaimana? | Hitung `minggu × harga` dulu, lalu bagi 10 dengan pembulatan **setengah ke atas**, integer. |
| OQ-02 | Admin dan anggota tabel terpisah (DR-01/02), tetapi login sama-sama pakai email. Email unik lintas keduanya? | **Ya**, unik lintas admin dan anggota; cek kedua tabel saat daftar dan ubah email. |
| OQ-03 | Format ID anggota dan kode eksemplar (WBS 3.5.1). | Anggota `AGT-000001`, eksemplar `EKS-000001`; berurutan dari sequence DB. |
| OQ-04 | Mekanisme sesi (WBS 3.2.2). NFR-SEC-04: berakhir setelah 8 jam tanpa aktivitas. | Token sesi opaque di cookie `httpOnly; Secure; SameSite=Lax`, disimpan di tabel sesi, kedaluwarsa geser 8 jam. |
| OQ-05 | Satu judul satu kategori atau banyak? | Satu kategori per judul (DR-05 menyebut "kategori" tunggal). |
| OQ-06 | ISBN wajib dan unik? | Wajib, unik, disimpan sebagai teks (boleh ISBN-10 atau ISBN-13). |
| OQ-07 | Isi laporan transaksi (kolom) dan definisi "rentang tanggal" (tanggal pinjam atau kembali). | Filter berdasarkan tanggal pinjam; kolom: anggota, judul, kode eksemplar, tgl pinjam, jatuh tempo, tgl kembali, status. |

Bila menemukan celah baru yang tidak ada di tabel ini: **jangan pilih sendiri**. Tanyakan, lalu tambahkan
baris OQ baru di sini setelah dijawab.

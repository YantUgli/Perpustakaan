# Progres Implementasi

Diperbarui setiap akhir WP. Status: `Belum` · `Berjalan` · `Selesai` · `Tertahan`.
Kolom "Asumsi" berisi kode OQ yang dipakai; kolom "Catatan" berisi hal yang perlu diperiksa manusia.

| WP | Nama | Status | FR tercakup & teruji | Asumsi | Catatan |
|---|---|---|---|---|---|
| 5.1.1–5.1.3 | Setup repo, Next.js, FastAPI | Selesai | IR-COM-01, K-07 (`hari_ini_wib`), NFR-MNT-01 (alembic up/down); backend 18/18, frontend 2/2 | — | Belum ada commit (menunggu izin). CI belum ada (di luar WBS 5.1). |
| 5.1.4 | Staging HTTPS | Belum | — | — | dikerjakan manusia |
| 5.2.1 | Migration skema | Selesai | DR-01..09, NFR-REL-02 (lapis DB), FR-PJM-07, FR-PJM-11, FR-TGH-02/03/05 (CHECK), FR-BKU-01/02 (FK), FR-KTL-02 (indeks), NFR-MNT-01; backend 99/99 | OQ-03, 05, 06, 08, 09, 10, 11, 12 | OQ-08..12 keputusan sementara reviewer → konfirmasi BA/SA sebelum UAT (terutama OQ-10, OQ-12). FR-TGH-06 (Lunas tak bisa diubah) belum ditegakkan di DB, menunggu service WP 5.3.11. |
| 5.2.2 | Seed | Selesai | FR-AKN-12, K-04, NFR-SEC-01/02, FR-AKN-03 (email admin), OQ-02/09 (email lintas tabel), NFR-PRF-01 (data 10.000 eksemplar); backend 135/135 | OQ-02, 09, 14, 15 | Prosedur OQ-14 (admin lupa password) wajib masuk panduan instalasi WBS 7.3. Waktu pencarian ≤ 2 dtk diukur di WP 5.3.2. |
| 5.3.1 | Autentikasi | Belum | | | |
| 5.3.5 | Judul, kategori, rak | Belum | | | Lanjutan dari 5.2.1: OQ-13 normalisasi ISBN (unik & pencarian abaikan tanda hubung/spasi, x→X) lewat migration baru; `skema_awal` tidak disentuh. |
| 5.3.6 | Eksemplar | Belum | | | |
| 5.3.2 | Katalog & pencarian | Belum | | | |
| 5.3.3 | Pendaftaran | Belum | | | Lanjutan dari 5.1: pesan validasi 422 bawaan FastAPI masih Bahasa Inggris → wajib di-Indonesiakan di WP ini (NFR-USA-02, IR-UI-04). |
| 5.3.4 | Profil & cari anggota | Belum | | | |
| 5.3.7 | Kalkulasi denda | Belum | | | |
| 5.3.8 | Peminjaman | Belum | | | |
| 5.3.9 | Pengembalian | Belum | | | |
| 5.3.10 | Hilang/rusak | Belum | | | |
| 5.3.11 | Tagihan | Belum | | | Lanjutan dari 5.2.1: trigger DB tolak UPDATE/DELETE tagihan LUNAS (FR-TGH-06) lewat migration baru + test. |
| 5.3.12 | Area anggota | Belum | | | |
| 5.2.3 / 5.3.13 | Dashboard & laporan | Belum | | | |
| 5.4.1–5.4.9 | Frontend | Belum | | | rinci per WP saat mulai |

## Log sesi

<!-- Format: YYYY-MM-DD · WP · ringkasan 1–2 kalimat · test: X lulus / Y total -->
- 2026-10-02 · 5.1.1–5.1.3 · Repo git + aturan branching, docker-compose PostgreSQL 16 (port 5434), kerangka FastAPI (health, `hari_ini_wib`, `GalatBisnis`, Alembic kosong, penjaga DB `_test`), kerangka Next.js (ESLint+Prettier+Vitest). · test: backend 18 lulus / 18, frontend 2 lulus / 2
- 2026-10-02 · 5.2.1 · Migration `skema_awal` (9 tabel, CHECK status/konsistensi, unique partial index pinjaman aktif, sequence kode AGT/EKS, pg_trgm), model SQLAlchemy sinkron, filter autogenerate indeks ekspresi. · test: backend 99 lulus / 99
- 2026-10-02 · 5.2.2 · Seed admin awal dari env (argon2, idempoten tanpa menimpa), data uji (8 kategori, 10 rak, 60 judul, 205 eksemplar) dan data performa (2.000 judul/10.000 eksemplar), penjaga APP_ENV. · test: backend 135 lulus / 135

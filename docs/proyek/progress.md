# Progres Implementasi

Diperbarui setiap akhir WP. Status: `Belum` · `Berjalan` · `Selesai` · `Tertahan`.
Kolom "Asumsi" berisi kode OQ yang dipakai; kolom "Catatan" berisi hal yang perlu diperiksa manusia.

| WP | Nama | Status | FR tercakup & teruji | Asumsi | Catatan |
|---|---|---|---|---|---|
| 5.1.1–5.1.3 | Setup repo, Next.js, FastAPI | Selesai | IR-COM-01, K-07 (`hari_ini_wib`), NFR-MNT-01 (alembic up/down); backend 18/18, frontend 2/2 | — | Belum ada commit (menunggu izin). CI belum ada (di luar WBS 5.1). |
| 5.1.4 | Staging HTTPS | Belum | — | — | dikerjakan manusia. Dari 5.3.1: frontend & API **satu origin** — reverse proxy wajib meneruskan `/api/v1` ke FastAPI di domain yang sama (cookie sesi `Secure; SameSite=Lax`, tanpa CORS). Saran (disetujui sebagai catatan): rate limiting `POST /api/v1/auth/login` di reverse proxy; penguncian akun tidak dibangun. Dari 5.3.5: batasi ukuran body di reverse proxy (mis. `client_max_body_size 3m`), karena Starlette menampung seluruh unggahan sebelum aplikasi memeriksa batas 2 MB. |
| 5.2.1 | Migration skema | Selesai | DR-01..09, NFR-REL-02 (lapis DB), FR-PJM-07, FR-PJM-11, FR-TGH-02/03/05 (CHECK), FR-BKU-01/02 (FK), FR-KTL-02 (indeks), NFR-MNT-01; backend 99/99 | OQ-03, 05, 06, 08, 09, 10, 11, 12 | OQ-08..12 keputusan sementara reviewer → konfirmasi BA/SA sebelum UAT (terutama OQ-10, OQ-12). FR-TGH-06 (Lunas tak bisa diubah) belum ditegakkan di DB, menunggu service WP 5.3.11. |
| 5.2.2 | Seed | Selesai | FR-AKN-12, K-04, NFR-SEC-01/02, FR-AKN-03 (email admin), OQ-02/09 (email lintas tabel), NFR-PRF-01 (data 10.000 eksemplar); backend 135/135 | OQ-02, 09, 14, 15 | Prosedur OQ-14 (admin lupa password) wajib masuk panduan instalasi WBS 7.3. Waktu pencarian ≤ 2 dtk diukur di WP 5.3.2. |
| 5.3.1 | Autentikasi | Selesai | FR-AKN-05/06/12, NFR-SEC-01/03/04, BR-02; backend 163/163 | OQ-02, 04, 09, 16, 17 | Halaman login & pengalihan per role di WP 5.4.3 (pakai `role` dari `/auth/login` atau `/auth/saya`). Endpoint fitur baru wajib lewat `router_admin`/`router_anggota`. |
| 5.3.5 | Judul, kategori, rak | Selesai | FR-BKU-01/02/03, DR-03/04/05, NFR-SEC-06 (cover), NFR-SEC-03 (router_admin); backend 229/229 | OQ-05, 06, 08, 09, 10, 12, 13, 18, 19 | OQ-13 lewat migration baru `isbn_normal` (kolom generated + UNIQUE + trigram). `test_skema.py` disesuaikan (nama constraint/indeks ISBN). Daftar judul admin tanpa pencarian (pakai service pencarian 5.3.2). |
| 5.3.6 | Eksemplar | Selesai | FR-BKU-04/05/06 (data label)/07/08/09, K-02, NFR-REL-01 (tambah N atomik), NFR-REL-02 (FOR UPDATE + test konkurensi); backend 265/265 | OQ-03, 10, 20, 21 | Cetak label A4 + gambar QR (FR-BKU-06, IR-HW-02) dikerjakan di WP 5.4.7. Tidak ada hapus eksemplar (OQ-20, konfirmasi client). |
| 5.3.2 | Katalog & pencarian | Belum | | | Dari 5.3.5: (1) kata kunci ISBN dinormalisasi dengan `normalisasi_isbn` sebelum dicocokkan ke `isbn_normal` (ketik `978-602` menemukan `978602…`). (2) Pencarian ditulis sebagai fungsi service yang bisa dipanggil ulang halaman admin, tanpa logika pencarian kedua. (3) URL publik cover (`cover_path` relatif `STORAGE_DIR`) disediakan di WP ini. |
| 5.3.3 | Pendaftaran | Belum | | | Dari 5.3.5: foto anggota pakai `berkas.periksa_gambar`/`UKURAN_MAKS_GAMBAR` yang sama (kode galat `BKU_COVER_*` perlu dibuat umum). Lanjutan dari 5.1: pesan validasi 422 bawaan FastAPI masih Bahasa Inggris → wajib di-Indonesiakan di WP ini (NFR-USA-02, IR-UI-04). |
| 5.3.4 | Profil & cari anggota | Belum | | | Pertanyaan terbuka (belum disetujui): apakah ganti password mencabut sesi lain akun itu? SRS tidak memuatnya — ajukan di rencana WP ini. |
| 5.3.7 | Kalkulasi denda | Belum | | | |
| 5.3.8 | Peminjaman | Belum | | | Dari 5.3.6: kunci eksemplar dengan pola yang sama seperti `eksemplar.tandai_rusak` (`with_for_update` + `populate_existing`); pesan status pakai `LABEL_STATUS_EKSEMPLAR` (FR-PJM-06). Dari 5.3.1 (berlaku 5.3.8–5.3.11): dependency auth sudah commit (`terakhir_aktif`) sebelum endpoint jalan; service wajib membuka transaksinya sendiri secara eksplisit, satu per operasi + `FOR UPDATE`, tanpa mengandalkan state transaksi dependency. |
| 5.3.9 | Pengembalian | Belum | | | |
| 5.3.10 | Hilang/rusak | Belum | | | |
| 5.3.11 | Tagihan | Belum | | | Lanjutan dari 5.2.1: trigger DB tolak UPDATE/DELETE tagihan LUNAS (FR-TGH-06) lewat migration baru + test. |
| 5.3.12 | Area anggota | Belum | | | |
| 5.2.3 / 5.3.13 | Dashboard & laporan | Belum | | | |
| 5.4.1–5.4.9 | Frontend | Belum | | | rinci per WP saat mulai. 5.4.7 (dari 5.3.6): wajib memenuhi FR-BKU-06 & IR-HW-02 — gambar QR (isi = kode) + beberapa label per halaman A4 via CSS cetak, data dari `GET /admin/eksemplar/label`; konfirmasi jumlah sebelum simpan tambah eksemplar (mitigasi OQ-20). |

## Log sesi

<!-- Format: YYYY-MM-DD · WP · ringkasan 1–2 kalimat · test: X lulus / Y total -->
- 2026-10-02 · 5.1.1–5.1.3 · Repo git + aturan branching, docker-compose PostgreSQL 16 (port 5434), kerangka FastAPI (health, `hari_ini_wib`, `GalatBisnis`, Alembic kosong, penjaga DB `_test`), kerangka Next.js (ESLint+Prettier+Vitest). · test: backend 18 lulus / 18, frontend 2 lulus / 2
- 2026-10-02 · 5.2.1 · Migration `skema_awal` (9 tabel, CHECK status/konsistensi, unique partial index pinjaman aktif, sequence kode AGT/EKS, pg_trgm), model SQLAlchemy sinkron, filter autogenerate indeks ekspresi. · test: backend 99 lulus / 99
- 2026-10-02 · 5.2.2 · Seed admin awal dari env (argon2, idempoten tanpa menimpa), data uji (8 kategori, 10 rak, 60 judul, 205 eksemplar) dan data performa (2.000 judul/10.000 eksemplar), penjaga APP_ENV. · test: backend 135 lulus / 135
- 2026-10-02 · 5.3.1 · Login/logout/`saya`, tabel `sesi` (migration baru, token ter-hash, kedaluwarsa geser 8 jam), cookie Secure tanpa saklar, `router_admin`/`router_anggota` + test audit route. · test: backend 163 lulus / 163
- 2026-10-02 · 5.3.5 · CRUD kategori/rak/judul di `router_admin`, migration `isbn_normal` (OQ-13/18), unggah cover JPG/PNG ≤ 2 MB diperiksa dari isi + anti decompression bomb, galat DB balapan → 409. · test: backend 229 lulus / 229
- 2026-10-02 · 5.3.6 · Tambah N eksemplar atomik, ubah rak (status apa pun), rusak manual Tersedia→Rusak dengan FOR UPDATE + test konkurensi, rekap stok per judul, data label (judul singkat 30 karakter). · test: backend 265 lulus / 265

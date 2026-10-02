DOKUMENTASI

Work Breakdown Structure

Sistem Informasi Perpustakaan Berbasis Web

Versi Dokumen: 1.0

BAB 1 — Pendahuluan

1.1 Tujuan Dokumen

Dokumen ini memecah seluruh pekerjaan pengembangan Sistem Informasi Perpustakaan Berbasis Web ke dalam struktur hierarkis yang terukur, mulai dari fase besar hingga paket kerja (*work package*) yang dapat ditugaskan kepada satu penanggung jawab. WBS menjadi dasar penyusunan jadwal, pembagian tugas, pemantauan progres, dan pengendalian perubahan oleh Project Manager.

1.2 Dasar Acuan

WBS disusun sepenuhnya berdasarkan Project Brief versi final (v3.0) yang telah disepakati bersama client. Seluruh fitur pada BAB 4, aturan bisnis BR-01 hingga BR-20 pada BAB 8, serta kebutuhan teknis pada BAB 10 project brief dipetakan ke dalam paket kerja. Hal yang berada di luar lingkup (BAB 2.2 project brief) tidak dimasukkan ke dalam WBS, termasuk penyusunan dokumen Software Requirements Specification (SRS) yang dikerjakan sebagai pekerjaan terpisah.

1.3 Prinsip Penyusunan

- **Aturan 100%.** Total pekerjaan pada level anak sama dengan cakupan level induknya; tidak ada pekerjaan di luar lingkup dan tidak ada pekerjaan yang tercatat dua kali.

- **Berorientasi deliverable.** Setiap paket kerja menghasilkan keluaran yang dapat diperiksa, baik berupa dokumen, diagram, kode, maupun hasil pengujian.

- **Satu penanggung jawab per paket kerja.** Setiap paket kerja memiliki satu PIC (*person in charge*), dengan role lain sebagai pendukung bila diperlukan.

- **Level 1 berbasis fase, level 2–3 berbasis modul/deliverable.** Struktur ini dipilih agar urutan pengerjaan mudah dijadwalkan sekaligus memudahkan pelacakan per fitur.

1.4 Konvensi Kode Role

| **Kode** | **Role** | **Jumlah Orang** |
| --- | --- | --- |
| CL | Client (Dosen) | — |
| PM | Project Manager | 1 |
| BA | Business Analyst | 1 |
| SA | System Analyst | 1 |
| DE | Data Engineer | 1 |
| UX | UI/UX Designer | 1 |
| FE | Programmer Frontend (Next.js) | 1 |
| BE | Programmer Backend (FastAPI) | 1 |
| QA | Quality Assurance | 1 |

Pembagian dua programmer menjadi FE dan BE mengikuti keterangan role pada project brief (implementasi frontend Next.js dan backend FastAPI).

BAB 2 — Struktur WBS Tingkat Atas

2.1 Fase Utama

| **Kode** | **Fase** | **PIC Utama** | **Keluaran Utama** |
| --- | --- | --- | --- |
| 1.0 | Manajemen Proyek | PM | Rencana proyek, laporan progres, log perubahan, laporan penutupan |
| 2.0 | Analisis Kebutuhan | BA | Aturan bisnis terperinci, user story, acceptance criteria, persetujuan kebutuhan |
| 3.0 | Perancangan Sistem dan Data | SA | Use case, activity diagram, arsitektur, hak akses, spesifikasi API, ERD, skema basis data |
| 4.0 | Perancangan UI/UX | UX | User flow, wireframe, design system, mockup, prototype |
| 5.0 | Implementasi | BE / FE / DE | Basis data, backend, frontend yang terintegrasi |
| 6.0 | Pengujian | QA | Test plan, test case, laporan pengujian, berita acara UAT |
| 7.0 | Deployment dan Serah Terima | PM | Sistem berjalan di lingkungan produksi HTTPS, dokumentasi, berita acara serah terima |

2.2 Diagram Hierarki Ringkas

| Sistem Informasi Perpustakaan Berbasis Web ├── 1.0 Manajemen Proyek │   ├── 1.1 Inisiasi │   ├── 1.2 Perencanaan │   ├── 1.3 Pemantauan dan Pengendalian │   └── 1.4 Penutupan Proyek ├── 2.0 Analisis Kebutuhan │   ├── 2.1 Elisitasi dan Klarifikasi Kebutuhan │   ├── 2.2 Spesifikasi Aturan Bisnis │   ├── 2.3 User Story dan Acceptance Criteria │   └── 2.4 Persetujuan Kebutuhan ├── 3.0 Perancangan Sistem dan Data │   ├── 3.1 Pemodelan Proses │   ├── 3.2 Arsitektur dan Hak Akses │   ├── 3.3 Spesifikasi API │   ├── 3.4 Perancangan Basis Data │   ├── 3.5 Perancangan Barcode/QR │   └── 3.6 Review Desain Sistem ├── 4.0 Perancangan UI/UX │   ├── 4.1 User Flow │   ├── 4.2 Wireframe │   ├── 4.3 Design System │   ├── 4.4 Mockup │   ├── 4.5 Prototype │   └── 4.6 Review dan Handoff Desain ├── 5.0 Implementasi │   ├── 5.1 Lingkungan Pengembangan │   ├── 5.2 Basis Data │   ├── 5.3 Backend │   ├── 5.4 Frontend │   └── 5.5 Integrasi ├── 6.0 Pengujian │   ├── 6.1 Perencanaan Pengujian │   ├── 6.2 Pengujian Internal │   ├── 6.3 User Acceptance Test (UAT) │   └── 6.4 Laporan Pengujian └── 7.0 Deployment dan Serah Terima     ├── 7.1 Lingkungan Produksi     ├── 7.2 Deployment     ├── 7.3 Dokumentasi     └── 7.4 Serah Terima |
| --- |

BAB 3 — Rincian Paket Kerja

3.1 Fase 1.0 — Manajemen Proyek

| **Kode** | **Paket Kerja** | **Deliverable** | **PIC** | **Pendukung** |
| --- | --- | --- | --- | --- |
| 1.1 | **Inisiasi** |  |  |  |
| 1.1.1 | Kick-off meeting dengan client | Notulen kick-off | PM | Seluruh tim, CL |
| 1.1.2 | Penetapan struktur tim dan tanggung jawab | Matriks RACI | PM | — |
| 1.1.3 | Penyiapan alat kolaborasi (repositori, task board, kanal komunikasi) | Workspace proyek aktif | PM | FE, BE |
| 1.2 | **Perencanaan** |  |  |  |
| 1.2.1 | Penyusunan WBS dan WBS dictionary | Dokumen WBS | PM | Seluruh tim |
| 1.2.2 | Penyusunan jadwal dan milestone | Gantt chart / timeline | PM | — |
| 1.2.3 | Rencana komunikasi dengan client dan internal tim | Rencana komunikasi | PM | — |
| 1.2.4 | Identifikasi risiko awal | Risk register | PM | SA, QA |
| 1.2.5 | Penetapan prosedur change request | Formulir dan alur change request | PM | BA |
| 1.3 | **Pemantauan dan Pengendalian** |  |  |  |
| 1.3.1 | Rapat progres rutin tim | Notulen rapat | PM | Seluruh tim |
| 1.3.2 | Pelaporan progres kepada client | Laporan progres berkala | PM | — |
| 1.3.3 | Pengelolaan change request | Log change request | PM | BA |
| 1.3.4 | Pemutakhiran risiko dan isu | Risk register dan issue log terbaru | PM | — |
| 1.4 | **Penutupan Proyek** |  |  |  |
| 1.4.1 | Evaluasi dan lessons learned | Catatan lessons learned | PM | Seluruh tim |
| 1.4.2 | Laporan akhir proyek | Laporan penutupan proyek | PM | — |

3.2 Fase 2.0 — Analisis Kebutuhan

| **Kode** | **Paket Kerja** | **Deliverable** | **PIC** | **Pendukung** |
| --- | --- | --- | --- | --- |
| 2.1 | **Elisitasi dan Klarifikasi Kebutuhan** |  |  |  |
| 2.1.1 | Sesi klarifikasi kebutuhan dengan client | Notulen dan daftar keputusan | BA | PM, CL |
| 2.1.2 | Finalisasi project brief | Project Brief v3.0 (selesai) | BA | PM |
| 2.1.3 | Penyusunan glosarium istilah domain (judul, eksemplar, item transaksi, tagihan, jatuh tempo, plafon) | Glosarium | BA | SA |
| 2.2 | **Spesifikasi Aturan Bisnis** |  |  |  |
| 2.2.1 | Perincian aturan bisnis BR-01 s.d. BR-20 beserta kondisi pengecualian | Katalog aturan bisnis | BA | SA |
| 2.2.2 | Spesifikasi perhitungan jatuh tempo, denda, dan plafon dengan contoh kasus batas | Tabel keputusan dan contoh perhitungan | BA | QA |
| 2.2.3 | Spesifikasi siklus status eksemplar, item transaksi, dan tagihan | Daftar status dan transisinya | BA | SA |
| 2.3 | **User Story dan Acceptance Criteria** |  |  |  |
| 2.3.1 | User story pengunjung umum (katalog, pencarian, detail, pendaftaran) | User story + AC | BA | — |
| 2.3.2 | User story anggota (profil, barcode, pinjaman, riwayat, tagihan, laporan hilang) | User story + AC | BA | — |
| 2.3.3 | User story admin sirkulasi (peminjaman, pengembalian, hilang/rusak) | User story + AC | BA | — |
| 2.3.4 | User story admin pengelolaan data (buku, eksemplar, anggota, master data) | User story + AC | BA | — |
| 2.3.5 | User story admin tagihan, dashboard, dan laporan | User story + AC | BA | — |
| 2.3.6 | Penyusunan dan prioritisasi product backlog | Product backlog berprioritas | BA | PM, CL |
| 2.4 | **Persetujuan Kebutuhan** |  |  |  |
| 2.4.1 | Review kebutuhan bersama client | Notulen review | BA | PM, CL |
| 2.4.2 | Sign-off kebutuhan | Persetujuan tertulis client (Milestone M1) | PM | BA, CL |

3.3 Fase 3.0 — Perancangan Sistem dan Data

| **Kode** | **Paket Kerja** | **Deliverable** | **PIC** | **Pendukung** |
| --- | --- | --- | --- | --- |
| 3.1 | **Pemodelan Proses** |  |  |  |
| 3.1.1 | Use case diagram dan skenario use case | Use case diagram + spesifikasi skenario | SA | BA |
| 3.1.2 | Activity diagram alur pendaftaran, peminjaman, pengembalian, hilang/rusak, dan penyelesaian tagihan | 5 activity diagram | SA | BA |
| 3.1.3 | State diagram status eksemplar, item transaksi, dan tagihan | State diagram | SA | DE |
| 3.2 | **Arsitektur dan Hak Akses** |  |  |  |
| 3.2.1 | Rancangan arsitektur sistem (Next.js – FastAPI – PostgreSQL) | Diagram arsitektur | SA | FE, BE |
| 3.2.2 | Rancangan mekanisme autentikasi dan sesi | Spesifikasi autentikasi | SA | BE |
| 3.2.3 | Matriks hak akses role terhadap menu dan endpoint (publik, anggota, admin) | Matriks hak akses | SA | BA |
| 3.3 | **Spesifikasi API** |  |  |  |
| 3.3.1 | Daftar endpoint per modul | Katalog endpoint | SA | BE |
| 3.3.2 | Format request/response dan kode pesan validasi spesifik | Spesifikasi API (OpenAPI) | SA | BE, FE |
| 3.4 | **Perancangan Basis Data** |  |  |  |
| 3.4.1 | ERD konseptual dan logis (judul, eksemplar, anggota, transaksi, item transaksi, tagihan, kategori, rak, admin) | ERD | DE | SA |
| 3.4.2 | Kamus data | Data dictionary | DE | — |
| 3.4.3 | Desain skema fisik PostgreSQL (constraint unik NIK/email/barcode, foreign key, indeks pencarian) | Skrip DDL rancangan | DE | BE |
| 3.4.4 | Rancangan query dashboard dan laporan | Spesifikasi query laporan | DE | BA |
| 3.5 | **Perancangan Barcode/QR** |  |  |  |
| 3.5.1 | Skema penomoran ID anggota dan kode eksemplar | Spesifikasi format kode | SA | DE |
| 3.5.2 | Spesifikasi format QR dan tata letak label eksemplar | Spesifikasi QR dan label | SA | UX |
| 3.6 | **Review Desain Sistem** |  |  |  |
| 3.6.1 | Review desain sistem dan data bersama client | Persetujuan desain sistem (bagian Milestone M2) | SA | PM, DE, CL |

3.4 Fase 4.0 — Perancangan UI/UX

| **Kode** | **Paket Kerja** | **Deliverable** | **PIC** | **Pendukung** |
| --- | --- | --- | --- | --- |
| 4.1 | **User Flow** |  |  |  |
| 4.1.1 | User flow pengunjung umum dan anggota | Diagram user flow | UX | BA |
| 4.1.2 | User flow admin sirkulasi dan pengelolaan data | Diagram user flow | UX | BA |
| 4.2 | **Wireframe** |  |  |  |
| 4.2.1 | Wireframe halaman publik (beranda, katalog, pencarian, detail, tentang, login/daftar) | Wireframe | UX | — |
| 4.2.2 | Wireframe menu anggota | Wireframe | UX | — |
| 4.2.3 | Wireframe sirkulasi admin mobile-first (peminjaman, pengembalian, hilang/rusak) | Wireframe mobile | UX | SA |
| 4.2.4 | Wireframe admin desktop (dashboard, data, tagihan, laporan) | Wireframe | UX | — |
| 4.3 | **Design System** |  |  |  |
| 4.3.1 | Warna, tipografi, spacing, dan komponen dasar | Design system | UX | FE |
| 4.3.2 | Label status konsisten (Tersedia, Dipinjam, Terlambat, Hilang, Rusak, Belum Lunas, Lunas) dan pola pesan validasi | Komponen status dan pesan | UX | BA |
| 4.4 | **Mockup** |  |  |  |
| 4.4.1 | Mockup high-fidelity seluruh halaman | Mockup | UX | — |
| 4.5 | **Prototype** |  |  |  |
| 4.5.1 | Prototype interaktif alur peminjaman dan pengembalian via pemindaian | Prototype | UX | — |
| 4.6 | **Review dan Handoff Desain** |  |  |  |
| 4.6.1 | Review dan revisi desain bersama client | Persetujuan desain UI (bagian Milestone M2) | UX | PM, CL |
| 4.6.2 | Handoff desain ke programmer | Spesifikasi desain dan aset | UX | FE |

3.5 Fase 5.0 — Implementasi

3.5.1 Lingkungan Pengembangan dan Basis Data

| **Kode** | **Paket Kerja** | **Deliverable** | **PIC** | **Pendukung** |
| --- | --- | --- | --- | --- |
| 5.1 | **Lingkungan Pengembangan** |  |  |  |
| 5.1.1 | Struktur repositori dan aturan branching | Repositori siap pakai | BE | FE |
| 5.1.2 | Setup proyek Next.js | Kerangka proyek frontend | FE | — |
| 5.1.3 | Setup proyek FastAPI dan tool migration | Kerangka proyek backend | BE | DE |
| 5.1.4 | Lingkungan staging dengan HTTPS untuk uji kamera | Staging aktif (Milestone M3) | BE | PM |
| 5.2 | **Basis Data** |  |  |  |
| 5.2.1 | Migration skema basis data | File migration | DE | BE |
| 5.2.2 | Seed data (akun admin awal, kategori, rak, data buku uji) | Skrip seed | DE | — |
| 5.2.3 | Implementasi query/view dashboard dan laporan | Query laporan teruji | DE | BE |
| 5.2.4 | Prosedur backup dan restore | Skrip dan prosedur backup/restore | DE | — |

3.5.2 Backend (FastAPI)

| **Kode** | **Paket Kerja** | **Deliverable** | **PIC** | **Pendukung** |
| --- | --- | --- | --- | --- |
| 5.3 | **Backend** |  |  |  |
| 5.3.1 | Autentikasi, hashing password, dan otorisasi berbasis role | API autentikasi | BE | — |
| 5.3.2 | Katalog publik dan pencarian (judul, penulis, ISBN, kategori) beserta jumlah eksemplar tersedia | API katalog | BE | — |
| 5.3.3 | Pendaftaran anggota (validasi keunikan NIK/email, pembuatan ID dan barcode, aktivasi langsung) | API registrasi | BE | — |
| 5.3.4 | Profil anggota dan pencarian anggota oleh admin (ID, NIK, nama) | API anggota | BE | — |
| 5.3.5 | Pengelolaan judul buku, upload cover, kategori, dan rak | API data buku dan master data | BE | — |
| 5.3.6 | Pengelolaan eksemplar (pembuatan barcode otomatis, data label, perubahan status, rekap stok per judul) | API eksemplar | BE | — |
| 5.3.7 | Layanan perhitungan jatuh tempo dan denda (pembulatan per minggu, plafon 10 minggu) | Modul kalkulasi + unit test | BE | QA |
| 5.3.8 | Peminjaman (cek kelayakan/blokir, batas 3 eksemplar aktif, status Tersedia, multi-eksemplar per transaksi) | API peminjaman | BE | — |
| 5.3.9 | Pengembalian (pencarian item aktif, pembentukan tagihan denda, pengembalian sebagian, penutupan transaksi) | API pengembalian | BE | — |
| 5.3.10 | Pencatatan buku hilang/rusak dan tagihan penggantian | API hilang/rusak | BE | — |
| 5.3.11 | Penyelesaian tagihan (pembayaran tunai/transfer, penerimaan buku pengganti, pencatatan admin) | API tagihan | BE | — |
| 5.3.12 | Data area anggota (pinjaman aktif, riwayat, tagihan) | API area anggota | BE | — |
| 5.3.13 | Dashboard admin dan laporan (filter, ekspor PDF dan Excel) | API dashboard dan laporan | BE | DE |

3.5.3 Frontend (Next.js)

| **Kode** | **Paket Kerja** | **Deliverable** | **PIC** | **Pendukung** |
| --- | --- | --- | --- | --- |
| 5.4 | **Frontend** |  |  |  |
| 5.4.1 | Layout dan komponen dasar sesuai design system | Library komponen | FE | UX |
| 5.4.2 | Halaman publik (beranda, katalog, pencarian, detail buku, tentang perpustakaan) | Halaman publik | FE | — |
| 5.4.3 | Halaman login dan pendaftaran anggota | Halaman autentikasi | FE | — |
| 5.4.4 | Area anggota (dashboard, profil, barcode QR, buku dipinjam, riwayat, tagihan) | Halaman anggota | FE | — |
| 5.4.5 | Komponen pemindai QR via kamera browser dengan input manual sebagai cadangan | Komponen scanner | FE | — |
| 5.4.6 | Halaman sirkulasi admin mobile-first (peminjaman, pengembalian, hilang/rusak) | Halaman sirkulasi | FE | — |
| 5.4.7 | Halaman pengelolaan data admin (buku, eksemplar dan cetak label, anggota, master data) | Halaman data admin | FE | — |
| 5.4.8 | Halaman tagihan admin (konfirmasi pembayaran dan penggantian) | Halaman tagihan | FE | — |
| 5.4.9 | Dashboard dan laporan admin (filter, cetak, ekspor) | Halaman dashboard dan laporan | FE | — |

3.5.4 Integrasi

| **Kode** | **Paket Kerja** | **Deliverable** | **PIC** | **Pendukung** |
| --- | --- | --- | --- | --- |
| 5.5 | **Integrasi** |  |  |  |
| 5.5.1 | Integrasi frontend–backend per modul | Fitur end-to-end berjalan di staging | FE | BE |
| 5.5.2 | Perbaikan bug hasil pengujian | Build terkoreksi (Milestone M4: fitur lengkap) | BE | FE |

3.6 Fase 6.0 — Pengujian

| **Kode** | **Paket Kerja** | **Deliverable** | **PIC** | **Pendukung** |
| --- | --- | --- | --- | --- |
| 6.1 | **Perencanaan Pengujian** |  |  |  |
| 6.1.1 | Penyusunan test plan | Test plan | QA | PM |
| 6.1.2 | Penyusunan test case per modul, termasuk kasus batas (keterlambatan 0, 1, 7, 8, 70, 71 hari; pinjaman ke-4; anggota terblokir) | Test case | QA | BA |
| 6.2 | **Pengujian Internal** |  |  |  |
| 6.2.1 | Pengujian fungsional per modul | Bug report | QA | — |
| 6.2.2 | Pengujian integrasi end-to-end alur pendaftaran hingga penyelesaian tagihan | Hasil uji integrasi | QA | — |
| 6.2.3 | Pengujian hak akses (akses tanpa login, anggota ke fungsi admin) | Hasil uji hak akses | QA | SA |
| 6.2.4 | Pengujian pemindaian pada ponsel nyata dan uji responsif | Hasil uji perangkat | QA | FE |
| 6.2.5 | Regression test setelah perbaikan | Hasil regression (Milestone M5) | QA | — |
| 6.3 | **User Acceptance Test (UAT)** |  |  |  |
| 6.3.1 | Penyusunan skenario UAT | Skenario UAT | QA | BA |
| 6.3.2 | Pelaksanaan dan pendampingan UAT bersama client | Catatan hasil UAT | QA | PM, CL |
| 6.3.3 | Berita acara UAT | Berita acara UAT ditandatangani (Milestone M6) | PM | QA, CL |
| 6.4 | **Laporan Pengujian** |  |  |  |
| 6.4.1 | Rekap hasil pengujian | Laporan hasil pengujian | QA | — |

3.7 Fase 7.0 — Deployment dan Serah Terima

| **Kode** | **Paket Kerja** | **Deliverable** | **PIC** | **Pendukung** |
| --- | --- | --- | --- | --- |
| 7.1 | **Lingkungan Produksi** |  |  |  |
| 7.1.1 | Penyiapan server/hosting, domain, dan sertifikat HTTPS | Server produksi siap | BE | PM |
| 7.2 | **Deployment** |  |  |  |
| 7.2.1 | Deployment frontend, backend, dan basis data produksi | Sistem berjalan di produksi | BE | FE, DE |
| 7.2.2 | Konfigurasi akun admin awal | Akun admin produksi | DE | BE |
| 7.2.3 | Smoke test di lingkungan produksi | Hasil smoke test | QA | — |
| 7.3 | **Dokumentasi** |  |  |  |
| 7.3.1 | Manual pengguna admin | Manual admin | BA | UX |
| 7.3.2 | Panduan penggunaan untuk anggota | Panduan anggota | BA | UX |
| 7.3.3 | Dokumentasi teknis (instalasi, API, backup dan restore) | Dokumentasi teknis | SA | BE, DE |
| 7.4 | **Serah Terima** |  |  |  |
| 7.4.1 | Demo akhir dan serah terima kepada client | Berita acara serah terima (Milestone M7) | PM | Seluruh tim, CL |

BAB 4 — Milestone dan Ketergantungan

4.1 Daftar Milestone

| **Kode** | **Milestone** | **Ditandai oleh Paket Kerja** |
| --- | --- | --- |
| M1 | Kebutuhan disetujui client | 2.4.2 |
| M2 | Desain sistem dan desain UI disetujui client | 3.6.1 dan 4.6.1 |
| M3 | Lingkungan pengembangan dan staging HTTPS siap | 5.1.4 |
| M4 | Seluruh fitur selesai dan terintegrasi | 5.5.2 |
| M5 | Pengujian internal selesai | 6.2.5 |
| M6 | UAT diterima client | 6.3.3 |
| M7 | Serah terima sistem | 7.4.1 |

4.2 Ketergantungan Utama

| **Paket Kerja** | **Bergantung pada** | **Alasan** |
| --- | --- | --- |
| 3.0 dan 4.0 | 2.4.2 | Desain baru dimulai setelah kebutuhan disetujui |
| 5.2.1 | 3.4.3 | Migration mengikuti skema fisik yang disetujui |
| 5.3 (seluruh API) | 3.3.2, 5.2.1 | Backend mengikuti spesifikasi API dan skema basis data |
| 5.4 (seluruh halaman) | 4.6.2, 3.3.2 | Frontend mengikuti handoff desain dan kontrak API |
| 5.3.9, 5.3.10 | 5.3.7, 5.3.8 | Pengembalian dan hilang/rusak memakai layanan kalkulasi dan data peminjaman |
| 5.4.5, 6.2.4 | 5.1.4 | Akses kamera browser hanya berjalan pada koneksi HTTPS |
| 6.1.2 | 2.2.2, 2.3 | Test case diturunkan dari aturan bisnis dan acceptance criteria |
| 6.3 | 6.2.5 | UAT dilaksanakan setelah pengujian internal tuntas |
| 7.2.1 | 6.3.3, 7.1.1 | Deployment produksi setelah UAT diterima dan server siap |

BAB 5 — Keterlacakan Kebutuhan

5.1 Pemetaan Fitur ke Paket Kerja

| **Fitur (Project Brief BAB 4)** | **Backend** | **Frontend** | **Pengujian** |
| --- | --- | --- | --- |
| Katalog Buku | 5.3.2 | 5.4.2 | 6.2.1 |
| Pencarian Buku | 5.3.2 | 5.4.2 | 6.2.1 |
| Pendaftaran Anggota | 5.3.3 | 5.4.3 | 6.2.1, 6.2.2 |
| Profil Anggota | 5.3.4 | 5.4.4 | 6.2.1 |
| Barcode Anggota | 5.3.3 | 5.4.4 | 6.2.4 |
| Manajemen Eksemplar | 5.3.6 | 5.4.7 | 6.2.1 |
| Peminjaman | 5.3.8 | 5.4.5, 5.4.6 | 6.2.2, 6.2.4 |
| Pengembalian | 5.3.9 | 5.4.5, 5.4.6 | 6.2.2, 6.2.4 |
| Denda | 5.3.7 | 5.4.4, 5.4.8 | 6.2.1 |
| Buku Hilang/Rusak | 5.3.10 | 5.4.6 | 6.2.2 |
| Penyelesaian Tagihan | 5.3.11 | 5.4.8 | 6.2.2 |
| Blokir Peminjaman | 5.3.8 | 5.4.6 | 6.2.1 |
| Riwayat | 5.3.12 | 5.4.4 | 6.2.1 |
| Dashboard Admin | 5.3.13 | 5.4.9 | 6.2.1 |
| Laporan (PDF dan Excel) | 5.3.13, 5.2.3 | 5.4.9 | 6.2.1 |

5.2 Pemetaan Aturan Bisnis ke Paket Kerja Implementasi

| **Aturan** | **Paket Kerja** | **Aturan** | **Paket Kerja** |
| --- | --- | --- | --- |
| BR-01 | 5.3.2, 5.4.2 | BR-11 | 5.3.7, 5.3.8 |
| BR-02 | 3.2.3, 5.3.1 | BR-12 | 5.3.7 |
| BR-03 | 5.3.3, 3.4.3 | BR-13 | 5.3.7 |
| BR-04 | 5.3.3, 3.5.1 | BR-14 | 5.3.10 |
| BR-05 | 5.3.6, 3.4.3 | BR-15 | 5.3.10, 5.3.11 |
| BR-06 | 3.4.1, 5.3.5 | BR-16 | 5.3.10 |
| BR-07 | 5.3.8, 3.2.3 | BR-17 | 5.3.11 |
| BR-08 | 5.3.8 | BR-18 | 5.3.8 |
| BR-09 | 5.3.8 | BR-19 | 5.3.8, 5.3.11 |
| BR-10 | 5.3.8 | BR-20 | 5.3.9, 5.3.11 |

BAB 6 — Catatan Klarifikasi

Bagian ini memuat hal-hal yang belum dinyatakan secara tegas dalam project brief namun berpengaruh pada isi paket kerja. Setiap butir perlu dikonfirmasi kepada client melalui BA sebelum WBS difinalkan.

| **No.** | **Hal yang Perlu Dikonfirmasi** | **Paket Kerja Terdampak** |
| --- | --- | --- |
| 1 | Mekanisme "anggota melaporkan buku hilang": melalui fitur di sistem (menu anggota) atau cukup lisan kepada admin yang kemudian mencatatnya. BAB 3.2 menyiratkan fitur sistem, sedangkan BAB 6.4 menyiratkan pencatatan oleh admin. | 2.3.2, 5.3.10, 5.4.4 |
| 2 | Pencatatan buku rusak yang ditemukan di luar transaksi peminjaman (misalnya rusak di rak). BAB 6.4 hanya mengatur pencatatan pada item transaksi. | 5.3.6, 5.3.10 |
| 3 | Fitur lupa/reset password untuk anggota tidak disebutkan. | 5.3.1, 5.4.3 |
| 4 | Pengelolaan akun admin tambahan: hanya akun admin awal saat instalasi, atau admin dapat menambah admin lain. | 3.2.3, 5.3.1 |
| 5 | Perubahan foto anggota: foto tidak dapat diubah anggota, namun belum jelas apakah admin dapat mengubahnya. | 5.3.4 |
| 6 | Pengubahan email oleh anggota tetap wajib memeriksa keunikan email. | 5.3.4 |
| 7 | Zona waktu acuan perhitungan tanggal (diasumsikan WIB / Asia/Jakarta). | 5.3.7 |
| 8 | Lingkungan hosting produksi dan domain HTTPS: disediakan client atau tim. | 7.1.1 |
| 9 | Ketentuan pembagian dua programmer menjadi FE dan BE, atau keduanya bekerja fullstack per modul. | Seluruh 5.3 dan 5.4 |
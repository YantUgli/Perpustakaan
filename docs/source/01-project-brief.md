PROJECT BRIEF

Sistem Informasi Perpustakaan Berbasis Web

Dokumen Kesepakatan Kebutuhan Sistem — Versi Final

Versi Dokumen: 3.0

BAB 1 — Pendahuluan

1.1 Gambaran Umum Project

Sistem Informasi Perpustakaan merupakan aplikasi berbasis web yang menyediakan informasi katalog buku serta mendukung pengelolaan keanggotaan, peminjaman, pengembalian, denda, dan penggantian buku hilang atau rusak. Katalog dapat diakses secara umum tanpa login, sedangkan peminjaman hanya dapat dilakukan oleh pengguna yang telah terdaftar sebagai anggota dan diproses oleh admin perpustakaan.

Seluruh koleksi yang dikelola merupakan buku fisik. Sistem tidak menyediakan layanan membaca, mengunduh, maupun meminjam buku digital.

Dokumen ini merupakan versi final project brief yang menggabungkan draf awal (v2) dengan seluruh hasil diskusi penyamaan kebutuhan antara tim pengembang dan client. Dokumen ini menjadi acuan bagi penyusunan Work Breakdown Structure (WBS), analisis, desain, implementasi, dan pengujian.

1.2 Latar Belakang

Perpustakaan membutuhkan sistem yang membantu masyarakat memperoleh informasi koleksi buku dan membantu admin mengelola transaksi perpustakaan. Pencatatan manual membuat pelayanan kurang efisien, menyulitkan pelacakan stok setiap eksemplar buku, dan berisiko menimbulkan kesalahan dalam perhitungan keterlambatan maupun denda.

Sistem dirancang dengan tampilan sederhana dan informatif sehingga mudah digunakan oleh pengunjung umum, anggota, maupun admin perpustakaan.

1.3 Tujuan Sistem

- Menyediakan katalog buku yang dapat diakses masyarakat umum tanpa login.

- Mempermudah pencarian dan penelusuran informasi buku beserta ketersediaannya.

- Memfasilitasi pendaftaran dan pengelolaan data anggota.

- Mempermudah admin memproses peminjaman dan pengembalian melalui pemindaian barcode dengan kamera ponsel.

- Melacak stok buku hingga tingkat eksemplar fisik.

- Menghitung keterlambatan dan denda secara otomatis sesuai aturan yang disepakati.

- Mencatat penyelesaian denda serta penggantian buku hilang atau rusak.

- Mencegah peminjaman baru oleh anggota yang memiliki tagihan belum lunas atau buku terlambat yang belum dikembalikan.

- Menyimpan riwayat transaksi secara terstruktur dan menyediakan laporan yang dapat dicetak maupun diekspor.

1.4 Pihak yang Terlibat

Project ini dijalankan dalam format roleplay proyek perangkat lunak. Dosen berperan sebagai client yang menetapkan kebutuhan dan menyetujui hasil kerja, sedangkan mahasiswa berperan sebagai tim pengembang yang terdiri atas 8 orang dengan 7 role berikut.

| **Role** | **Tanggung Jawab Utama** |
| --- | --- |
| Client (Dosen) | Menetapkan kebutuhan, menjawab klarifikasi, meninjau desain, melakukan UAT, dan menyetujui serah terima. |
| Project Manager (PM) | Perencanaan, penjadwalan, koordinasi tim, komunikasi progres dengan client, dan pengendalian perubahan. |
| Business Analyst (BA) | Penggalian dan finalisasi kebutuhan bisnis, aturan bisnis, user story, serta acceptance criteria. |
| System Analyst | Pemodelan sistem (use case, activity diagram), arsitektur, desain hak akses, dan spesifikasi API. |
| Data Engineer | ERD, skema PostgreSQL, migration, data awal, query laporan, serta backup dan restore. |
| UI/UX Designer | User flow, wireframe, design system, mockup, dan prototype. |
| Programmer (2 orang) | Implementasi frontend (Next.js) dan backend (FastAPI). |
| Quality Assurance (QA) | Test plan, test case, pengujian fungsional dan integrasi, regression, serta pendampingan UAT. |

BAB 2 — Ruang Lingkup

2.1 Dalam Lingkup

- Website publik: beranda, katalog, pencarian, detail buku, dan informasi perpustakaan.

- Pendaftaran anggota dengan aktivasi akun secara langsung.

- Area anggota: profil, barcode identifikasi, buku yang sedang dipinjam, riwayat, dan tagihan.

- Area admin: pengelolaan buku dan eksemplar, anggota, peminjaman, pengembalian, denda, penggantian buku hilang/rusak, dashboard, serta laporan.

- Pemindaian barcode menggunakan kamera ponsel admin dengan input manual sebagai cadangan.

- Perhitungan jatuh tempo, keterlambatan, dan denda secara otomatis.

- Pencatatan pembayaran dengan metode tunai atau transfer.

- Cetak dan ekspor laporan transaksi dan denda dalam format PDF dan Excel.

2.2 Di Luar Lingkup

- E-book atau layanan buku digital dalam bentuk apa pun.

- Payment gateway maupun verifikasi bukti transfer; sistem hanya mencatat metode pembayaran.

- Perpanjangan masa peminjaman.

- Kartu anggota fisik.

- Penetapan status hilang secara otomatis oleh sistem.

- Dokumen Software Requirements Specification (SRS), yang disusun sebagai pekerjaan terpisah.

2.3 Ringkasan Keputusan

| **No.** | **Ketentuan** | **Keputusan** |
| --- | --- | --- |
| 1 | Jenis buku | Buku fisik; tidak ada e-book. |
| 2 | Akses katalog | Umum, tanpa login. |
| 3 | Role sistem | Admin Perpustakaan dan Anggota. |
| 4 | Aktivasi akun | Langsung aktif setelah pendaftaran. |
| 5 | Struktur koleksi | Satu judul dapat memiliki beberapa eksemplar; setiap eksemplar memiliki barcode sendiri. Harga melekat pada judul. |
| 6 | Batas peminjaman | Maksimal 3 eksemplar aktif per anggota; satu transaksi boleh memuat beberapa buku. |
| 7 | Masa peminjaman | 30 hari sejak tanggal peminjaman; tanpa perpanjangan. |
| 8 | Denda | 10% dari harga buku per minggu keterlambatan, dibulatkan ke atas per minggu. |
| 9 | Plafon denda | Maksimal 10 minggu (setara 100% harga buku). |
| 10 | Buku hilang/rusak | Ganti senilai harga buku atau dengan buku identik; tanpa tambahan denda keterlambatan. |
| 11 | Pembayaran | Langsung kepada admin; metode tunai atau transfer dicatat. |
| 12 | Pemblokiran | Tagihan belum lunas atau buku terlambat yang belum dikembalikan. |
| 13 | Pemindaian | Kamera ponsel admin, dengan input manual sebagai cadangan. |
| 14 | Laporan | Cetak dan ekspor ke PDF dan Excel. |

BAB 3 — Pengguna dan Hak Akses

Sistem memiliki dua role terautentikasi, yaitu Admin Perpustakaan dan Anggota. Pengunjung umum bukan role sistem, melainkan pengguna tanpa login yang hanya memiliki akses ke halaman publik.

3.1 Pengunjung Umum (tanpa login)

- Melihat katalog dan mencari buku.

- Melihat detail buku beserta jumlah eksemplar yang tersedia.

- Mendaftar sebagai anggota.

3.2 Anggota

- Login ke sistem dan memperbarui data profil yang diizinkan.

- Menampilkan barcode identifikasi anggota pada ponsel untuk dipindai admin.

- Melihat buku yang sedang dipinjam beserta tanggal jatuh tempo.

- Melihat riwayat peminjaman dan pengembalian.

- Melihat tagihan denda maupun penggantian beserta status penyelesaiannya.

- Melaporkan buku hilang kepada admin perpustakaan.

3.3 Admin Perpustakaan

- Login sebagai admin.

- Mengelola data judul buku, eksemplar, kategori, lokasi rak, dan anggota.

- Memindai barcode anggota dan eksemplar untuk memproses peminjaman dan pengembalian.

- Mencatat buku hilang atau rusak.

- Mengonfirmasi pembayaran denda atau penggantian buku.

- Melihat dashboard serta mencetak dan mengekspor laporan.

BAB 4 — Fitur Utama

| **Fitur** | **Deskripsi** |
| --- | --- |
| Katalog Buku | Menampilkan cover, judul, penulis, penerbit, tahun, kategori, ISBN, lokasi rak, harga, dan jumlah eksemplar tersedia. |
| Pencarian Buku | Pencarian berdasarkan judul, penulis, ISBN, atau kategori. |
| Pendaftaran Anggota | Pendaftaran dengan data diri wajib; akun langsung aktif dan memperoleh ID serta barcode identifikasi. |
| Profil Anggota | Perubahan password, nomor telepon, nama, email, dan alamat. |
| Barcode Anggota | Satu barcode unik per anggota, ditampilkan pada menu anggota di ponsel. |
| Manajemen Eksemplar | Penambahan eksemplar dengan barcode yang dibuat otomatis, pencetakan label, perubahan status, dan rekap stok per judul. |
| Peminjaman | Admin memindai barcode anggota, sistem memvalidasi kelayakan, lalu admin memindai satu atau beberapa eksemplar dalam satu transaksi. |
| Pengembalian | Admin memindai eksemplar; sistem menemukan transaksi aktif, menghitung keterlambatan, dan membentuk denda bila terlambat. Pengembalian sebagian dari satu transaksi didukung. |
| Denda | Perhitungan 10% harga buku per minggu keterlambatan, dibulatkan ke atas, dengan plafon 10 minggu. |
| Buku Hilang/Rusak | Pencatatan kejadian dan pembentukan tagihan penggantian senilai harga buku. |
| Penyelesaian Tagihan | Pencatatan pembayaran (tunai/transfer) atau penerimaan buku pengganti identik, lalu status berubah menjadi Lunas. |
| Blokir Peminjaman | Penolakan peminjaman bila anggota memiliki tagihan belum lunas atau buku terlambat yang belum dikembalikan. |
| Riwayat | Riwayat peminjaman, pengembalian, denda, dan penggantian. |
| Dashboard Admin | Ringkasan judul, eksemplar, anggota, transaksi aktif, keterlambatan, dan tagihan. |
| Laporan | Laporan transaksi dan denda yang dapat dicetak serta diekspor ke PDF dan Excel. |

BAB 5 — Data Utama

5.1 Judul Buku dan Eksemplar

Koleksi dikelola dalam dua tingkat. Judul buku menyimpan informasi bibliografis dan harga, antara lain ISBN, judul, penulis, penerbit, tahun, kategori, cover, dan harga. Eksemplar mewakili setiap salinan fisik dari suatu judul, dengan barcode unik, lokasi rak, dan status masing-masing. Harga tidak dibedakan antar eksemplar sehingga denda dan nilai penggantian selalu mengacu pada harga judul.

Struktur ini memungkinkan katalog menampilkan ketersediaan per judul (misalnya 2 dari 3 eksemplar tersedia) dan memungkinkan admin melacak posisi serta kondisi setiap salinan.

5.2 Status Eksemplar

| **Status** | **Keterangan** |
| --- | --- |
| Tersedia | Berada di perpustakaan dan dapat dipinjam. |
| Dipinjam | Sedang dipinjam oleh anggota. |
| Hilang | Dilaporkan hilang oleh anggota; tidak dihitung dalam stok tersedia hingga diganti. |
| Rusak | Dinyatakan rusak; tidak dihitung dalam stok tersedia hingga diganti. |

Status Terlambat tidak melekat pada eksemplar, melainkan pada item transaksi peminjaman yang telah melewati jatuh tempo.

5.3 Data Anggota

| **Data** | **Wajib saat Daftar** | **Dapat Diubah Anggota** |
| --- | --- | --- |
| Nama lengkap | Ya | Ya |
| Alamat sesuai KTP | Ya | Ya |
| Email | Ya | Ya |
| Nomor telepon | Ya | Ya |
| NIK | Ya | Tidak |
| Foto | Opsional | Tidak |
| Password | Ya | Ya |

NIK dan email bersifat unik untuk menjamin satu orang hanya memiliki satu akun. Setiap akun memiliki tepat satu ID dan satu barcode identifikasi.

5.4 Transaksi Peminjaman

Satu transaksi peminjaman dapat memuat beberapa eksemplar sekaligus. Tanggal pinjam, jatuh tempo, tanggal kembali, status, dan denda dicatat per item eksemplar, sehingga pengembalian sebagian dari satu transaksi dapat diproses tanpa mengganggu item lainnya.

Tagihan mencatat jenis (denda keterlambatan atau penggantian hilang/rusak), nominal, status (Belum Lunas atau Lunas), cara penyelesaian (pembayaran tunai, pembayaran transfer, atau penggantian buku identik), tanggal penyelesaian, dan admin yang mengonfirmasi.

BAB 6 — Alur Proses

6.1 Pendaftaran Anggota

	1.	Pengunjung membuka website dan memilih menu pendaftaran.

	2.	Pengunjung mengisi nama lengkap, alamat sesuai KTP, email, nomor telepon, NIK, password, dan foto (opsional).

	3.	Sistem memvalidasi kelengkapan data serta keunikan NIK dan email.

	4.	Bila valid, akun dibuat dan langsung aktif.

	5.	Sistem memberikan ID anggota dan barcode identifikasi.

	6.	Anggota dapat langsung login.

6.2 Peminjaman Buku

	1.	Anggota datang ke perpustakaan dan menampilkan barcode identifikasi pada ponselnya.

	2.	Admin membuka menu peminjaman pada ponsel dan memindai barcode anggota. Bila pemindaian gagal atau anggota tidak membawa ponsel, admin mencari anggota secara manual berdasarkan ID, NIK, atau nama.

	3.	Sistem menampilkan data anggota dan memeriksa kelayakan: tidak ada tagihan Belum Lunas dan tidak ada buku terlambat yang belum dikembalikan.

	4.	Bila tidak layak, sistem menampilkan alasan penolakan dan transaksi tidak dapat dilanjutkan.

	5.	Bila layak, admin memindai satu atau beberapa eksemplar; kode eksemplar juga dapat diinput manual.

	6.	Untuk setiap eksemplar, sistem memeriksa status Tersedia dan memastikan total pinjaman aktif anggota tidak melebihi 3 eksemplar.

	7.	Admin mengonfirmasi transaksi.

	8.	Sistem mencatat tanggal pinjam dan jatuh tempo (tanggal pinjam + 30 hari) untuk setiap item.

	9.	Status eksemplar berubah menjadi Dipinjam.

6.3 Pengembalian Buku

	1.	Anggota menyerahkan buku kepada admin.

	2.	Admin membuka menu pengembalian dan memindai barcode eksemplar (atau menginput kodenya secara manual).

	3.	Sistem menemukan item transaksi aktif untuk eksemplar tersebut.

	4.	Sistem membandingkan tanggal kembali dengan jatuh tempo dan menghitung denda bila terlambat.

	5.	Bila terdapat denda, sistem membentuk tagihan berstatus Belum Lunas dan admin menyampaikan nominalnya kepada anggota.

	6.	Status item transaksi berubah menjadi Dikembalikan dan status eksemplar menjadi Tersedia.

	7.	Transaksi berstatus selesai setelah seluruh item di dalamnya dikembalikan atau diselesaikan.

Anggota yang masih membutuhkan buku setelah masa peminjaman berakhir mengembalikan buku terlebih dahulu, lalu melakukan peminjaman baru sesuai alur 6.2.

6.4 Buku Hilang atau Rusak

	1.	Anggota melaporkan buku hilang kepada admin, atau admin mencatat buku dalam kondisi rusak.

	2.	Admin mencatat kejadian pada item transaksi terkait.

	3.	Status eksemplar berubah menjadi Hilang atau Rusak.

	4.	Sistem membentuk tagihan penggantian senilai harga buku dan tidak mengenakan denda keterlambatan atas eksemplar tersebut.

	5.	Anggota menyelesaikan tagihan dengan membayar senilai harga buku atau menyerahkan buku pengganti yang identik.

Buku rusak tidak wajib dikembalikan secara fisik. Sistem tidak menetapkan status hilang secara otomatis, termasuk setelah denda mencapai plafon; status hilang hanya ditetapkan berdasarkan laporan anggota.

6.5 Penyelesaian Tagihan

	1.	Anggota menyelesaikan tagihan langsung kepada admin.

	2.	Untuk pembayaran, admin mencatat metode (tunai atau transfer), nominal, dan tanggal pembayaran.

	3.	Untuk penggantian buku identik, admin mencatat tanggal penerimaan; eksemplar kembali berstatus Tersedia dengan barcode yang sama setelah label dipasang pada buku pengganti.

	4.	Status tagihan berubah menjadi Lunas beserta identitas admin yang mengonfirmasi.

	5.	Bila tidak ada tagihan lain dan tidak ada buku terlambat, anggota dapat langsung meminjam kembali.

BAB 7 — Aturan Jatuh Tempo, Denda, dan Penggantian

7.1 Jatuh Tempo

Jatuh tempo ditetapkan 30 hari sejak tanggal peminjaman. Sebagai contoh, buku yang dipinjam pada 1 Oktober jatuh tempo pada 31 Oktober. Pengembalian pada tanggal jatuh tempo tidak dihitung terlambat; keterlambatan dimulai sehari setelahnya.

7.2 Perhitungan Denda

Denda dihitung per minggu keterlambatan sebesar 10% dari harga buku. Jumlah minggu dibulatkan ke atas, sehingga hari pertama dari minggu berikutnya sudah dihitung sebagai satu minggu penuh.

| Hari Terlambat   = Tanggal Kembali - Tanggal Jatuh Tempo Minggu Terlambat = PEMBULATAN_KE_ATAS(Hari Terlambat / 7) Minggu Dihitung  = MIN(Minggu Terlambat, 10) Denda            = Minggu Dihitung x 10% x Harga Buku |
| --- |

Contoh dengan harga buku Rp100.000:

| **Keterlambatan** | **Minggu Dihitung** | **Denda** |
| --- | --- | --- |
| 0 hari (tepat jatuh tempo) | 0 | Rp0 |
| 1–7 hari | 1 | Rp10.000 |
| 8–14 hari | 2 | Rp20.000 |
| 15–21 hari | 3 | Rp30.000 |
| 64–70 hari | 10 | Rp100.000 |
| Lebih dari 70 hari | 10 (plafon) | Rp100.000 |

7.3 Plafon Denda

Denda keterlambatan untuk satu buku dibatasi maksimal 10 minggu, setara dengan 100% harga buku. Setelah plafon tercapai, denda tidak bertambah, namun buku tetap tercatat sebagai pinjaman terlambat sampai dikembalikan atau dilaporkan hilang. Selama itu, anggota tetap terblokir dari peminjaman baru.

7.4 Penggantian Buku Hilang atau Rusak

Buku yang hilang atau rusak diganti senilai harga buku atau dengan buku identik. Kewajiban penggantian ini menggantikan denda keterlambatan atas eksemplar yang sama, sehingga anggota hanya menanggung satu kewajiban untuk buku tersebut.

7.5 Pembayaran

Pembayaran dilakukan langsung kepada admin perpustakaan tanpa payment gateway. Metode tunai atau transfer dicatat sebagai keterangan, tanpa verifikasi bukti transfer di dalam sistem. Pembayaran sebagian tidak diatur; tagihan dianggap Lunas setelah diselesaikan penuh.

BAB 8 — Aturan Bisnis

| **Kode** | **Aturan** |
| --- | --- |
| BR-01 | Katalog buku dapat dilihat masyarakat umum tanpa login. |
| BR-02 | Sistem memiliki dua role: Admin Perpustakaan dan Anggota. |
| BR-03 | Akun anggota langsung aktif setelah pendaftaran; NIK dan email harus unik. |
| BR-04 | Setiap anggota memiliki tepat satu ID dan satu barcode identifikasi. |
| BR-05 | Satu judul dapat memiliki beberapa eksemplar; setiap eksemplar memiliki barcode unik. |
| BR-06 | Harga ditetapkan per judul dan berlaku sama untuk seluruh eksemplarnya. |
| BR-07 | Peminjaman hanya untuk anggota dan diproses oleh admin. |
| BR-08 | Satu anggota maksimal memiliki 3 eksemplar dalam pinjaman aktif, baik dalam satu maupun beberapa transaksi. |
| BR-09 | Satu transaksi dapat memuat beberapa eksemplar. |
| BR-10 | Eksemplar yang tidak berstatus Tersedia tidak dapat dipinjam. |
| BR-11 | Masa peminjaman 30 hari sejak tanggal pinjam; tidak ada perpanjangan. |
| BR-12 | Denda sebesar 10% harga buku per minggu keterlambatan, dibulatkan ke atas per minggu. |
| BR-13 | Denda per buku dibatasi maksimal 10 minggu (100% harga buku). |
| BR-14 | Status hilang hanya ditetapkan berdasarkan laporan anggota, tidak secara otomatis. |
| BR-15 | Buku hilang atau rusak diganti senilai harga buku atau dengan buku identik, tanpa tambahan denda keterlambatan. |
| BR-16 | Buku rusak tidak wajib dikembalikan secara fisik. |
| BR-17 | Tagihan diselesaikan langsung kepada admin; metode tunai atau transfer dicatat. |
| BR-18 | Anggota dengan tagihan Belum Lunas atau buku terlambat yang belum dikembalikan tidak dapat meminjam. |
| BR-19 | Anggota dapat langsung meminjam setelah seluruh tagihan Lunas dan tidak ada buku terlambat. |
| BR-20 | Eksemplar yang dikembalikan atau telah diganti berstatus Tersedia. |

BAB 9 — Struktur Menu dan Konsep Tampilan

9.1 Struktur Menu

| **Website Umum** | **Menu Anggota** | **Menu Admin** |
| --- | --- | --- |
| Beranda Katalog Buku Pencarian Detail Buku Tentang Perpustakaan Login / Daftar | Dashboard Profil Barcode Anggota Buku yang Dipinjam Riwayat Peminjaman Tagihan | Dashboard Data Buku & Eksemplar Data Anggota Master Data (Kategori, Rak) Peminjaman Pengembalian Hilang / Rusak Tagihan Laporan |

9.2 Konsep Tampilan

- Tampilan sederhana dan informatif dengan navigasi yang mudah dipahami.

- Search bar mudah ditemukan pada halaman katalog.

- Label status yang konsisten dan jelas: Tersedia, Dipinjam, Terlambat, Hilang, Rusak, Belum Lunas, dan Lunas.

- Halaman sirkulasi admin (peminjaman, pengembalian, hilang/rusak) dirancang mobile-first karena dioperasikan dari ponsel.

- Halaman admin lainnya responsif dan nyaman digunakan di desktop.

- Jumlah langkah admin dalam setiap transaksi diminimalkan.

- Pesan validasi menjelaskan alasan secara spesifik bila transaksi ditolak.

- Jatuh tempo, keterlambatan, dan status tagihan ditampilkan secara jelas di area anggota.

BAB 10 — Kebutuhan Teknis

10.1 Teknologi

| **Lapisan** | **Teknologi** |
| --- | --- |
| Frontend | Next.js |
| Backend | FastAPI |
| Database | PostgreSQL |

10.2 Barcode dan Pemindaian

- Barcode anggota dibuat otomatis saat pendaftaran dan ditampilkan di aplikasi; tidak ada kartu anggota fisik.

- Barcode eksemplar dibuat otomatis saat eksemplar ditambahkan dan dicetak sebagai label untuk ditempel pada buku.

- Pemindaian menggunakan kamera ponsel admin melalui browser. Format QR code direkomendasikan karena lebih andal dibaca kamera, termasuk dari layar ponsel anggota.

- Input manual tersedia sebagai cadangan: pencarian anggota berdasarkan ID, NIK, atau nama, serta input kode eksemplar.

10.3 Kebutuhan Lingkungan

- Aplikasi wajib diakses melalui HTTPS karena browser hanya mengizinkan akses kamera pada koneksi aman.

- Akun admin awal disiapkan saat instalasi sistem.

- Laporan transaksi dan denda dapat difilter dan diekspor ke PDF dan Excel.

BAB 11 — Penutup

Sistem Informasi Perpustakaan Berbasis Web dikembangkan dengan dua role, yaitu Admin Perpustakaan dan Anggota, serta halaman publik untuk pengunjung umum. Koleksi dikelola hingga tingkat eksemplar dengan barcode masing-masing. Setiap anggota dapat meminjam maksimal 3 eksemplar selama 30 hari tanpa perpanjangan. Keterlambatan dikenakan denda 10% harga buku per minggu dengan plafon 10 minggu, sedangkan buku hilang atau rusak diganti senilai harga buku atau dengan buku identik. Anggota yang memiliki tagihan belum lunas atau buku terlambat tidak dapat melakukan peminjaman baru.

Dokumen ini menjadi dasar penyusunan WBS dan seluruh tahapan pengembangan berikutnya. Perubahan kebutuhan setelah dokumen disetujui client diproses melalui mekanisme change request yang dikelola Project Manager.
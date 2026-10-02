SRS

Sistem Informasi Perpustakaan Berbasis Web

Software Requirements Specification

Versi Dokumen: 1.0

BAB 1 — Pendahuluan

1.1 Tujuan Dokumen

Software Requirements Specification (SRS) ini menetapkan kebutuhan perangkat lunak Sistem Informasi Perpustakaan Berbasis Web secara terukur dan dapat diuji. Dokumen ini menjadi acuan bagi System Analyst, Data Engineer, UI/UX Designer, programmer, dan Quality Assurance dalam merancang, membangun, serta menguji sistem.

Setiap kebutuhan diberi kode unik, dirumuskan dengan kata "harus", dan ditautkan ke aturan bisnis (BR) pada project brief serta paket kerja pada Work Breakdown Structure (WBS).

1.2 Ruang Lingkup Produk

Sistem menyediakan katalog buku fisik yang dapat diakses publik tanpa login, serta mendukung pengelolaan keanggotaan, peminjaman, pengembalian, denda, dan penggantian buku hilang atau rusak. Sirkulasi diproses admin menggunakan pemindaian QR code melalui kamera ponsel.

Hal yang berada di luar lingkup meliputi e-book, payment gateway, verifikasi bukti transfer, perpanjangan masa pinjam, kartu anggota fisik, dan penetapan status hilang secara otomatis.

1.3 Definisi dan Istilah

| **Istilah** | **Definisi** |
| --- | --- |
| Judul buku | Data bibliografis satu buku (ISBN, judul, penulis, penerbit, tahun, kategori, cover, harga). |
| Eksemplar | Satu salinan fisik dari sebuah judul, dengan kode/QR unik, lokasi rak, dan status sendiri. |
| Transaksi peminjaman | Satu kejadian peminjaman oleh satu anggota; dapat memuat beberapa item. |
| Item transaksi | Satu eksemplar dalam satu transaksi, dengan tanggal pinjam, jatuh tempo, tanggal kembali, dan status sendiri. |
| Jatuh tempo | Tanggal pinjam ditambah 30 hari kalender. |
| Terlambat | Kondisi item yang belum dikembalikan setelah tanggal jatuh tempo terlewati. |
| Tagihan | Kewajiban anggota berupa denda keterlambatan atau penggantian buku hilang/rusak. |
| Plafon denda | Batas maksimal denda per buku: 10 minggu atau 100% harga buku. |
| Pinjaman aktif | Item transaksi berstatus Dipinjam milik seorang anggota. |
| Blokir | Kondisi anggota tidak dapat meminjam karena memiliki tagihan Belum Lunas atau item Terlambat. |

1.4 Referensi

- Project Brief Sistem Informasi Perpustakaan Berbasis Web v3.0.

- Dokumentasi Work Breakdown Structure Sistem Informasi Perpustakaan v1.0.

- Panduan Pembuatan Diagram SRS Sistem Informasi Perpustakaan.

- IEEE Std 830-1998, Recommended Practice for Software Requirements Specifications.

1.5 Konvensi Penulisan

Kode kebutuhan memakai awalan FR untuk kebutuhan fungsional, NFR untuk non-fungsional, IR untuk antarmuka eksternal, dan DR untuk data. Prioritas memakai skema MoSCoW: Must berarti wajib tersedia saat serah terima, sedangkan Should berarti penting namun dapat ditunda dengan persetujuan client.

Bagian yang membutuhkan diagram ditandai kotak bertuliskan "TEMPAT DIAGRAM". Kotak tersebut diganti dengan gambar final setelah diagram selesai disusun dan disetujui. Daftar seluruh gambar beserta penyusunnya tercantum pada Lampiran A.

BAB 2 — Deskripsi Umum

2.1 Perspektif Produk

Sistem merupakan aplikasi web mandiri yang tidak terintegrasi dengan sistem lain. Arsitekturnya terdiri atas tiga lapis, yaitu frontend Next.js, backend REST API FastAPI, dan basis data PostgreSQL. Seluruh akses dilakukan melalui browser dengan koneksi HTTPS.

| **[ TEMPAT DIAGRAM ]** Gambar 2.1 — Diagram Arsitektur Sistem Penyusun: System Analyst · Acuan: Panduan Pembuatan Diagram SRS, bagian Diagram Arsitektur *Hapus kotak ini dan sisipkan gambar pada posisi yang sama.* |
| --- |

*Gambar 2.1 Diagram Arsitektur Sistem*

2.2 Fungsi Produk

- Katalog dan pencarian buku untuk publik.

- Pendaftaran, autentikasi, dan profil anggota beserta QR identifikasi.

- Pengelolaan judul, eksemplar, kategori, rak, dan data anggota oleh admin.

- Sirkulasi peminjaman, pengembalian, serta pencatatan hilang/rusak melalui pemindaian QR.

- Perhitungan jatuh tempo dan denda secara otomatis.

- Pencatatan penyelesaian tagihan.

- Area anggota untuk melihat pinjaman aktif, riwayat, dan tagihan.

- Dashboard dan laporan dengan ekspor PDF dan Excel.

2.3 Karakteristik Pengguna

| **Pengguna** | **Akses** | **Karakteristik** | **Perangkat utama** |
| --- | --- | --- | --- |
| Pengunjung umum | Tanpa login | Masyarakat umum dengan kemampuan teknis beragam | Ponsel atau desktop |
| Anggota | Login, role Anggota | Terbiasa memakai aplikasi web di ponsel | Ponsel |
| Admin Perpustakaan | Login, role Admin | Petugas perpustakaan yang dilatih memakai sistem | Ponsel (sirkulasi), desktop (pengelolaan dan laporan) |

2.4 Batasan

- Teknologi ditetapkan: Next.js, FastAPI, dan PostgreSQL.

- Sistem wajib berjalan di HTTPS karena akses kamera browser hanya diizinkan pada koneksi aman.

- Tidak ada integrasi pembayaran; sistem hanya mencatat metode tunai atau transfer.

- Tidak ada pengiriman email atau SMS dari sistem.

- Hanya terdapat dua role terautentikasi: Admin Perpustakaan dan Anggota.

2.5 Asumsi dan Ketergantungan

- Admin memiliki ponsel berkamera dengan browser modern dan koneksi internet.

- Anggota menampilkan QR dari ponselnya; bila tidak memungkinkan, admin memakai pencarian manual.

- Admin mampu mencetak label QR eksemplar dengan printer biasa.

- Seluruh perhitungan tanggal memakai zona waktu Asia/Jakarta (WIB).

- Server dan domain HTTPS disediakan oleh tim pengembang.

BAB 3 — Keputusan atas Butir Klarifikasi

Sembilan butir klarifikasi pada WBS BAB 6 diputuskan dengan satu prinsip, yaitu tidak menambah fitur atau alur baru di luar yang telah tercantum pada project brief. Keputusan ini mengikat seluruh kebutuhan pada dokumen ini dan dikonfirmasi kepada client pada sesi review kebutuhan (WBS 2.4.1).

| **No.** | **Butir** | **Keputusan** | **Dampak pada sistem** |
| --- | --- | --- | --- |
| K-01 | Mekanisme laporan buku hilang | Anggota melapor secara lisan kepada admin; admin yang mencatat di sistem. | Tidak ada menu lapor hilang di area anggota. |
| K-02 | Buku rusak di luar transaksi | Admin mengubah status eksemplar menjadi Rusak melalui manajemen eksemplar, tanpa tagihan. | Memakai fitur ubah status eksemplar yang sudah ada. |
| K-03 | Lupa/reset password | Tidak ada fitur lupa password mandiri. Anggota menghubungi admin, lalu admin menetapkan password baru melalui ubah data anggota. | Tidak ada alur email/token reset. |
| K-04 | Akun admin tambahan | Akun admin hanya dibuat melalui seed saat instalasi. | Tidak ada menu kelola admin. |
| K-05 | Perubahan foto anggota | Foto hanya diisi saat pendaftaran dan tidak dapat diubah melalui sistem. | Tidak ada fitur unggah ulang foto. |
| K-06 | Keunikan email saat diubah | Pemeriksaan keunikan email tetap berlaku saat email diubah. | Validasi sama dengan pendaftaran. |
| K-07 | Zona waktu | Seluruh tanggal memakai Asia/Jakarta (WIB). | Tidak ada pengaturan zona waktu. |
| K-08 | Hosting dan domain HTTPS | Disediakan oleh tim pengembang. | Tidak memengaruhi fitur. |
| K-09 | Pembagian programmer | Mengikuti WBS: satu programmer frontend dan satu programmer backend. | Tidak memengaruhi fitur. |

BAB 4 — Kebutuhan Fungsional

Kebutuhan fungsional dikelompokkan ke dalam sepuluh modul. Kolom Sumber merujuk ke aturan bisnis project brief (BR), bagian project brief, atau keputusan klarifikasi (K).

4.1 Gambaran Use Case

Sistem melayani tiga aktor: Pengunjung Umum, Anggota, dan Admin Perpustakaan. Anggota merupakan spesialisasi dari Pengunjung Umum sehingga dapat memakai seluruh fungsi publik. Daftar use case utama beserta rujukan kebutuhannya tercantum pada tabel berikut.

| **[ TEMPAT DIAGRAM ]** Gambar 4.1 — Use Case Diagram Penyusun: System Analyst · Acuan: Panduan Pembuatan Diagram SRS, bagian Use Case Diagram *Hapus kotak ini dan sisipkan gambar pada posisi yang sama.* |
| --- |

*Gambar 4.1 Use Case Diagram*

| **Kode** | **Use case** | **Aktor** | **Rujukan** |
| --- | --- | --- | --- |
| UC-01 | Melihat katalog buku | Pengunjung | FR-KTL-01 |
| UC-02 | Mencari buku | Pengunjung | FR-KTL-02 |
| UC-03 | Melihat detail buku | Pengunjung | FR-KTL-03 |
| UC-04 | Melihat informasi perpustakaan | Pengunjung | FR-KTL-05 |
| UC-05 | Mendaftar sebagai anggota | Pengunjung | FR-AKN-01 s.d. 04 |
| UC-06 | Login | Anggota, Admin | FR-AKN-05 |
| UC-07 | Logout | Anggota, Admin | FR-AKN-06 |
| UC-08 | Mengelola profil | Anggota | FR-AKN-07 s.d. 09 |
| UC-09 | Menampilkan QR anggota | Anggota | FR-AGT-01 |
| UC-10 | Melihat pinjaman aktif | Anggota | FR-AGT-02 |
| UC-11 | Melihat riwayat peminjaman | Anggota | FR-AGT-03 |
| UC-12 | Melihat tagihan | Anggota | FR-AGT-04 |
| UC-13 | Mengelola kategori dan rak | Admin | FR-BKU-01 |
| UC-14 | Mengelola judul buku | Admin | FR-BKU-02, 03 |
| UC-15 | Mengelola eksemplar | Admin | FR-BKU-04, 05, 07–09 |
| UC-16 | Mencetak label QR | Admin | FR-BKU-06 |
| UC-17 | Mengelola data anggota | Admin | FR-AKN-10, 11 |
| UC-18 | Memproses peminjaman | Admin | FR-PJM |
| UC-19 | Memproses pengembalian | Admin | FR-KMB |
| UC-20 | Mencatat buku hilang/rusak | Admin | FR-HLR |
| UC-21 | Menyelesaikan tagihan | Admin | FR-TGH |
| UC-22 | Melihat dashboard | Admin | FR-LAP-01 |
| UC-23 | Melihat dan mengekspor laporan | Admin | FR-LAP-02 s.d. 04 |

4.2 Katalog dan Pencarian (KTL)

| **Kode** | **Kebutuhan** | **Sumber** | **Prioritas** |
| --- | --- | --- | --- |
| FR-KTL-01 | Sistem harus menampilkan katalog tanpa login, berisi cover, judul, penulis, penerbit, tahun, kategori, ISBN, lokasi rak, harga, dan jumlah eksemplar tersedia per judul. | BR-01 | Must |
| FR-KTL-02 | Sistem harus menyediakan pencarian berdasarkan judul, penulis, ISBN, atau kategori, tidak peka huruf besar/kecil, dan mendukung kecocokan sebagian kata. | Brief BAB 4 | Must |
| FR-KTL-03 | Sistem harus menampilkan halaman detail buku dengan ketersediaan berformat "X dari Y eksemplar tersedia"; Y tidak menghitung eksemplar berstatus Hilang atau Rusak. | Brief 5.1, 5.2 | Must |
| FR-KTL-04 | Sistem harus menampilkan hasil katalog dan pencarian secara berhalaman (pagination). | NFR usability | Should |
| FR-KTL-05 | Sistem harus menyediakan halaman beranda dan Tentang Perpustakaan yang dapat diakses tanpa login. | Brief 9.1 | Must |

4.3 Akun dan Keanggotaan (AKN)

| **Kode** | **Kebutuhan** | **Sumber** | **Prioritas** |
| --- | --- | --- | --- |
| FR-AKN-01 | Sistem harus menyediakan formulir pendaftaran dengan isian wajib nama lengkap, alamat sesuai KTP, email, nomor telepon, NIK, dan password, serta foto opsional. | Brief 5.3 | Must |
| FR-AKN-02 | Sistem harus menolak pendaftaran bila NIK atau email sudah terdaftar, dengan pesan yang menyebut isian yang duplikat. | BR-03 | Must |
| FR-AKN-03 | Sistem harus memvalidasi NIK berupa tepat 16 digit angka dan email berformat valid. | BR-03 | Must |
| FR-AKN-04 | Bila data valid, sistem harus membuat akun berstatus aktif, memberikan satu ID anggota unik, dan membuat satu QR identifikasi yang memuat ID tersebut. | BR-03, BR-04 | Must |
| FR-AKN-05 | Sistem harus menyediakan login dengan email dan password untuk Anggota dan Admin, lalu mengarahkan pengguna ke dashboard sesuai role. | BR-02 | Must |
| FR-AKN-06 | Sistem harus menyediakan logout yang mengakhiri sesi. | NFR keamanan | Must |
| FR-AKN-07 | Anggota harus dapat mengubah nama, alamat, email, nomor telepon, dan password. NIK dan foto tidak dapat diubah. | Brief 5.3, K-05 | Must |
| FR-AKN-08 | Perubahan email harus melewati pemeriksaan keunikan yang sama dengan pendaftaran. | K-06 | Must |
| FR-AKN-09 | Perubahan password oleh anggota harus mensyaratkan password lama. | NFR keamanan | Must |
| FR-AKN-10 | Admin harus dapat melihat daftar anggota dan mencarinya berdasarkan ID, NIK, atau nama. | Brief 6.2 | Must |
| FR-AKN-11 | Admin harus dapat mengubah data anggota selain NIK dan foto, termasuk menetapkan password baru bagi anggota yang lupa password. | K-03, K-05 | Must |
| FR-AKN-12 | Sistem tidak menyediakan fitur lupa password mandiri maupun pengelolaan akun admin; akun admin dibuat melalui seed saat instalasi. | K-03, K-04 | Must |

Alur Pendaftaran Anggota

| **[ TEMPAT DIAGRAM ]** Gambar 4.2 — Activity Diagram Pendaftaran Anggota Penyusun: System Analyst · Acuan: Panduan Pembuatan Diagram SRS, bagian Activity Diagram AD-01 *Hapus kotak ini dan sisipkan gambar pada posisi yang sama.* |
| --- |

*Gambar 4.2 Activity Diagram Pendaftaran Anggota*

4.4 Buku, Eksemplar, dan Master Data (BKU)

| **Kode** | **Kebutuhan** | **Sumber** | **Prioritas** |
| --- | --- | --- | --- |
| FR-BKU-01 | Admin harus dapat menambah, mengubah, dan menghapus kategori serta lokasi rak. Data yang masih dipakai tidak dapat dihapus. | Brief 3.3 | Must |
| FR-BKU-02 | Admin harus dapat menambah, mengubah, dan menghapus judul buku beserta ISBN, judul, penulis, penerbit, tahun, kategori, cover, dan harga. Judul yang pernah dipinjam tidak dapat dihapus. | BR-06 | Must |
| FR-BKU-03 | Harga disimpan pada judul dan berlaku untuk seluruh eksemplarnya. | BR-06 | Must |
| FR-BKU-04 | Admin harus dapat menambah satu atau beberapa eksemplar sekaligus untuk sebuah judul. Sistem membuat kode eksemplar unik beserta QR-nya secara otomatis, dengan status awal Tersedia. | BR-05 | Must |
| FR-BKU-05 | Admin harus dapat menetapkan dan mengubah lokasi rak setiap eksemplar. | Brief 5.1 | Must |
| FR-BKU-06 | Sistem harus menyediakan cetak label QR untuk satu atau beberapa eksemplar, memuat QR, kode eksemplar, dan judul singkat. | Brief BAB 4 | Must |
| FR-BKU-07 | Admin harus dapat mengubah status eksemplar Tersedia menjadi Rusak tanpa membentuk tagihan, untuk kerusakan di luar transaksi. | K-02 | Must |
| FR-BKU-08 | Sistem harus menolak perubahan status manual pada eksemplar berstatus Dipinjam; perubahannya hanya melalui alur sirkulasi. | Brief 6.3, 6.4 | Must |
| FR-BKU-09 | Sistem harus menampilkan rekap stok per judul: total, Tersedia, Dipinjam, Hilang, dan Rusak. | Brief BAB 4 | Must |

4.5 Peminjaman (PJM)

| **Kode** | **Kebutuhan** | **Sumber** | **Prioritas** |
| --- | --- | --- | --- |
| FR-PJM-01 | Admin harus dapat mengidentifikasi anggota dengan memindai QR anggota, atau melalui pencarian manual berdasarkan ID, NIK, atau nama. | Brief 6.2 | Must |
| FR-PJM-02 | Setelah anggota teridentifikasi, sistem harus menampilkan nama, ID, jumlah pinjaman aktif, dan status kelayakan. | Brief 6.2 | Must |
| FR-PJM-03 | Sistem harus menolak peminjaman bila anggota memiliki tagihan Belum Lunas, dengan pesan berisi jumlah dan total tagihan. | BR-18 | Must |
| FR-PJM-04 | Sistem harus menolak peminjaman bila anggota memiliki item Terlambat, dengan pesan berisi judul dan jumlah hari terlambat. | BR-18 | Must |
| FR-PJM-05 | Admin harus dapat menambahkan eksemplar ke transaksi dengan memindai QR atau mengetik kode eksemplar. | Brief 6.2 | Must |
| FR-PJM-06 | Sistem harus menolak eksemplar yang tidak berstatus Tersedia, dengan pesan yang menyebut statusnya saat ini. | BR-10 | Must |
| FR-PJM-07 | Sistem harus menolak eksemplar yang sama dipindai dua kali dalam satu transaksi. | BR-09 | Must |
| FR-PJM-08 | Sistem harus menolak penambahan item bila pinjaman aktif anggota ditambah item dalam transaksi berjalan melebihi 3. | BR-08 | Must |
| FR-PJM-09 | Admin harus dapat menghapus item dari transaksi sebelum konfirmasi. | Brief 9.2 | Should |
| FR-PJM-10 | Saat admin mengonfirmasi, sistem harus memeriksa ulang kelayakan dan status setiap eksemplar, lalu menyimpan transaksi beserta admin pemroses. | BR-07 | Must |
| FR-PJM-11 | Untuk setiap item, sistem harus mencatat tanggal pinjam (hari ini) dan jatuh tempo (tanggal pinjam + 30 hari). | BR-11 | Must |
| FR-PJM-12 | Setelah konfirmasi, status item dan status eksemplar berubah menjadi Dipinjam. | Brief 6.2 | Must |
| FR-PJM-13 | Sistem tidak menyediakan perpanjangan masa pinjam. | BR-11 | Must |

Alur Peminjaman Buku

| **[ TEMPAT DIAGRAM ]** Gambar 4.3 — Activity Diagram Peminjaman Buku Penyusun: System Analyst · Acuan: Panduan Pembuatan Diagram SRS, bagian Activity Diagram AD-02 *Hapus kotak ini dan sisipkan gambar pada posisi yang sama.* |
| --- |

*Gambar 4.3 Activity Diagram Peminjaman Buku*

4.6 Pengembalian (KMB)

| **Kode** | **Kebutuhan** | **Sumber** | **Prioritas** |
| --- | --- | --- | --- |
| FR-KMB-01 | Admin harus dapat memproses pengembalian dengan memindai QR eksemplar atau mengetik kodenya. | Brief 6.3 | Must |
| FR-KMB-02 | Sistem harus menemukan item transaksi aktif untuk eksemplar tersebut dan menampilkan peminjam, tanggal pinjam, jatuh tempo, serta jumlah hari terlambat. | Brief 6.3 | Must |
| FR-KMB-03 | Bila eksemplar tidak memiliki item aktif, sistem harus menolak dengan pesan bahwa eksemplar tidak sedang dipinjam. | Brief 9.2 | Must |
| FR-KMB-04 | Bila terlambat, sistem harus menghitung denda sesuai FR-DND dan menampilkan nominalnya sebelum admin mengonfirmasi. | BR-12 | Must |
| FR-KMB-05 | Saat dikonfirmasi, sistem harus mencatat tanggal kembali, mengubah status item menjadi Dikembalikan, dan mengubah status eksemplar menjadi Tersedia. | BR-20 | Must |
| FR-KMB-06 | Bila denda lebih dari 0, sistem harus membentuk tagihan denda keterlambatan berstatus Belum Lunas yang terhubung ke item tersebut. | Brief 6.3 | Must |
| FR-KMB-07 | Sistem harus mendukung pengembalian sebagian; item lain dalam transaksi yang sama tidak terpengaruh. | Brief 5.4 | Must |
| FR-KMB-08 | Transaksi harus berstatus Selesai bila seluruh itemnya berstatus Dikembalikan, Hilang, atau Rusak. | Brief 6.3 | Must |

Alur Pengembalian Buku

| **[ TEMPAT DIAGRAM ]** Gambar 4.4 — Activity Diagram Pengembalian Buku Penyusun: System Analyst · Acuan: Panduan Pembuatan Diagram SRS, bagian Activity Diagram AD-03 *Hapus kotak ini dan sisipkan gambar pada posisi yang sama.* |
| --- |

*Gambar 4.4 Activity Diagram Pengembalian Buku*

4.7 Perhitungan Jatuh Tempo dan Denda (DND)

| **Kode** | **Kebutuhan** | **Sumber** | **Prioritas** |
| --- | --- | --- | --- |
| FR-DND-01 | Hari terlambat = tanggal kembali − tanggal jatuh tempo, dalam hari kalender WIB; nilai ≤ 0 berarti tidak terlambat. | Brief 7.1, K-07 | Must |
| FR-DND-02 | Minggu terlambat = pembulatan ke atas (hari terlambat ÷ 7). | BR-12 | Must |
| FR-DND-03 | Minggu dihitung = minimum (minggu terlambat, 10). | BR-13 | Must |
| FR-DND-04 | Denda = minggu dihitung × 10% × harga judul, dalam Rupiah bulat. | BR-12 | Must |
| FR-DND-05 | Sebuah item dianggap Terlambat bila berstatus Dipinjam dan tanggal hari ini melewati jatuh tempo. Kondisi ini dihitung saat dibutuhkan, tidak melalui proses terjadwal. | Brief 5.2 | Must |
| FR-DND-06 | Setelah plafon tercapai, item tetap Terlambat dan anggota tetap terblokir sampai item dikembalikan atau dicatat hilang. | Brief 7.3, BR-14 | Must |

Contoh uji dengan harga buku Rp100.000:

| **Keterlambatan** | **Minggu dihitung** | **Denda** |
| --- | --- | --- |
| 0 hari (tepat jatuh tempo) | 0 | Rp0 |
| 1 hari | 1 | Rp10.000 |
| 7 hari | 1 | Rp10.000 |
| 8 hari | 2 | Rp20.000 |
| 70 hari | 10 | Rp100.000 |
| 71 hari | 10 (plafon) | Rp100.000 |

4.8 Buku Hilang dan Rusak (HLR)

| **Kode** | **Kebutuhan** | **Sumber** | **Prioritas** |
| --- | --- | --- | --- |
| FR-HLR-01 | Admin harus dapat mencatat item berstatus Dipinjam sebagai Hilang berdasarkan laporan lisan anggota, dengan memindai QR anggota atau mencari anggota lalu memilih item. | BR-14, K-01 | Must |
| FR-HLR-02 | Admin harus dapat mencatat item sebagai Rusak, baik saat buku diserahkan maupun berdasarkan laporan anggota; buku tidak wajib diserahkan. | BR-16 | Must |
| FR-HLR-03 | Saat dicatat, status item dan eksemplar berubah menjadi Hilang atau Rusak, dan sistem menyimpan tanggal kejadian, keterangan, serta admin pencatat. | Brief 6.4 | Must |
| FR-HLR-04 | Sistem harus membentuk tagihan penggantian senilai harga judul berstatus Belum Lunas, tanpa denda keterlambatan untuk item tersebut meskipun item telah terlambat. | BR-15 | Must |
| FR-HLR-05 | Sistem tidak boleh mengubah status menjadi Hilang secara otomatis dalam kondisi apa pun. | BR-14 | Must |

Alur Pencatatan Buku Hilang/Rusak

| **[ TEMPAT DIAGRAM ]** Gambar 4.5 — Activity Diagram Pencatatan Buku Hilang/Rusak Penyusun: System Analyst · Acuan: Panduan Pembuatan Diagram SRS, bagian Activity Diagram AD-04 *Hapus kotak ini dan sisipkan gambar pada posisi yang sama.* |
| --- |

*Gambar 4.5 Activity Diagram Pencatatan Buku Hilang/Rusak*

4.9 Penyelesaian Tagihan (TGH)

| **Kode** | **Kebutuhan** | **Sumber** | **Prioritas** |
| --- | --- | --- | --- |
| FR-TGH-01 | Admin harus dapat melihat daftar tagihan dengan filter status, jenis, dan anggota. | Brief 3.3 | Must |
| FR-TGH-02 | Admin harus dapat menyelesaikan tagihan dengan pembayaran tunai atau transfer, mencatat metode, nominal, dan tanggal. Nominal harus sama dengan nilai tagihan; pembayaran sebagian ditolak. | BR-17, Brief 7.5 | Must |
| FR-TGH-03 | Untuk tagihan penggantian, admin harus dapat memilih penyelesaian dengan buku pengganti identik dan mencatat tanggal penerimaan. | BR-15 | Must |
| FR-TGH-04 | Bila diselesaikan dengan buku pengganti, eksemplar kembali Tersedia dengan kode yang sama. Bila diselesaikan dengan uang, eksemplar tetap berstatus Hilang atau Rusak. | BR-20, Brief 5.2 | Must |
| FR-TGH-05 | Setelah diselesaikan, status tagihan menjadi Lunas dan sistem menyimpan cara penyelesaian, tanggal, serta admin yang mengonfirmasi. | Brief 5.4 | Must |
| FR-TGH-06 | Tagihan Lunas tidak dapat diubah atau dihapus. | Integritas data | Must |
| FR-TGH-07 | Anggota dapat langsung meminjam setelah seluruh tagihan Lunas dan tidak ada item Terlambat, tanpa tindakan tambahan admin. | BR-19 | Must |

Alur Penyelesaian Tagihan

| **[ TEMPAT DIAGRAM ]** Gambar 4.6 — Activity Diagram Penyelesaian Tagihan Penyusun: System Analyst · Acuan: Panduan Pembuatan Diagram SRS, bagian Activity Diagram AD-05 *Hapus kotak ini dan sisipkan gambar pada posisi yang sama.* |
| --- |

*Gambar 4.6 Activity Diagram Penyelesaian Tagihan*

4.10 Area Anggota (AGT)

| **Kode** | **Kebutuhan** | **Sumber** | **Prioritas** |
| --- | --- | --- | --- |
| FR-AGT-01 | Sistem harus menampilkan QR identifikasi anggota beserta ID dan nama, dalam ukuran yang mudah dipindai dari layar ponsel. | BR-04 | Must |
| FR-AGT-02 | Sistem harus menampilkan pinjaman aktif beserta jatuh tempo, sisa hari, dan penanda Terlambat. | Brief 9.2 | Must |
| FR-AGT-03 | Sistem harus menampilkan riwayat peminjaman dan pengembalian, termasuk item Hilang atau Rusak. | Brief 3.2 | Must |
| FR-AGT-04 | Sistem harus menampilkan tagihan beserta jenis, nominal, status, dan cara penyelesaian. | Brief 3.2 | Must |
| FR-AGT-05 | Dashboard anggota harus menampilkan status kelayakan meminjam beserta alasannya bila terblokir. | Brief 9.2 | Should |

4.11 Dashboard dan Laporan (LAP)

| **Kode** | **Kebutuhan** | **Sumber** | **Prioritas** |
| --- | --- | --- | --- |
| FR-LAP-01 | Dashboard admin harus menampilkan jumlah judul, eksemplar per status, anggota, item dipinjam, item terlambat, serta jumlah dan total tagihan Belum Lunas. | Brief BAB 4 | Must |
| FR-LAP-02 | Sistem harus menyediakan laporan transaksi peminjaman dan pengembalian dengan filter rentang tanggal dan status. | Brief BAB 4 | Must |
| FR-LAP-03 | Sistem harus menyediakan laporan denda dan penggantian dengan filter rentang tanggal, jenis, status, dan metode penyelesaian, beserta total nominal. | Brief BAB 4 | Must |
| FR-LAP-04 | Setiap laporan harus dapat dicetak dan diekspor ke PDF dan Excel (.xlsx) sesuai filter yang aktif. | Brief 10.3 | Must |

BAB 5 — Kebutuhan Antarmuka Eksternal

| **Kode** | **Jenis** | **Kebutuhan** |
| --- | --- | --- |
| IR-UI-01 | Pengguna | Halaman sirkulasi admin (peminjaman, pengembalian, hilang/rusak) harus dirancang mobile-first dan dapat dioperasikan satu tangan pada layar selebar 360 px. |
| IR-UI-02 | Pengguna | Halaman admin lainnya harus responsif dan nyaman digunakan di desktop mulai lebar 1280 px. |
| IR-UI-03 | Pengguna | Label status harus konsisten di seluruh halaman: Tersedia, Dipinjam, Terlambat, Hilang, Rusak, Belum Lunas, Lunas. |
| IR-UI-04 | Pengguna | Setiap penolakan harus menampilkan pesan yang menyebut alasan spesifik, bukan pesan umum. |
| IR-UI-05 | Pengguna | Kolom pencarian harus tampil di bagian atas halaman katalog. |
| IR-HW-01 | Perangkat keras | Pemindaian memakai kamera belakang ponsel admin melalui browser; bila izin kamera ditolak atau gagal, input manual harus tetap tersedia. |
| IR-HW-02 | Perangkat keras | Label QR eksemplar harus dapat dicetak dengan printer biasa pada kertas A4 dalam tata letak beberapa label per halaman. |
| IR-SW-01 | Perangkat lunak | Frontend Next.js, backend FastAPI, dan basis data PostgreSQL. |
| IR-SW-02 | Perangkat lunak | Kode identitas anggota dan eksemplar dikodekan sebagai QR code. |
| IR-COM-01 | Komunikasi | Frontend dan backend berkomunikasi melalui REST API berformat JSON yang terdokumentasi dalam OpenAPI. |
| IR-COM-02 | Komunikasi | Seluruh lalu lintas harus melalui HTTPS; akses HTTP dialihkan ke HTTPS. |

BAB 6 — Kebutuhan Non-Fungsional

Project brief belum menetapkan angka kualitas, sehingga target pada bab ini merupakan usulan tim pengembang yang disetujui client pada review kebutuhan. Angka dipilih agar realistis untuk skala satu perpustakaan dan dapat diuji oleh Quality Assurance.

| **Kode** | **Kategori** | **Kebutuhan** | **Cara uji** |
| --- | --- | --- | --- |
| NFR-SEC-01 | Keamanan | Password harus disimpan sebagai hash (bcrypt atau argon2), tidak pernah dalam teks asli. | Inspeksi tabel basis data |
| NFR-SEC-02 | Keamanan | Password minimal 8 karakter. | Uji pendaftaran dan ubah password |
| NFR-SEC-03 | Keamanan | Setiap endpoint non-publik harus memeriksa autentikasi dan role; anggota hanya dapat mengakses datanya sendiri. | Uji hak akses (WBS 6.2.3) |
| NFR-SEC-04 | Keamanan | Sesi berakhir otomatis setelah 8 jam tanpa aktivitas. | Uji sesi |
| NFR-SEC-05 | Keamanan | Sistem harus mencegah SQL injection dan XSS melalui query terparameter dan escaping keluaran. | Uji keamanan dasar |
| NFR-SEC-06 | Keamanan | Unggahan cover dan foto dibatasi JPG/PNG, maksimal 2 MB. | Uji unggah |
| NFR-PRF-01 | Performa | Hasil pencarian katalog tampil ≤ 2 detik untuk 10.000 eksemplar. | Uji dengan data seed |
| NFR-PRF-02 | Performa | Hasil validasi setelah QR terbaca tampil ≤ 1 detik. | Uji pada ponsel nyata |
| NFR-PRF-03 | Performa | Ekspor laporan 1.000 baris selesai ≤ 10 detik. | Uji ekspor |
| NFR-REL-01 | Keandalan | Peminjaman, pengembalian, pencatatan hilang/rusak, dan penyelesaian tagihan dijalankan dalam satu transaksi basis data; bila gagal, tidak ada perubahan tersimpan. | Uji kegagalan di tengah proses |
| NFR-REL-02 | Keandalan | Dua admin yang memproses eksemplar yang sama secara bersamaan tidak boleh menghasilkan dua pinjaman aktif untuk eksemplar tersebut. | Uji konkurensi |
| NFR-REL-03 | Keandalan | Basis data dicadangkan otomatis setiap hari dan prosedur restore teruji. | Uji backup/restore (WBS 5.2.4) |
| NFR-USA-01 | Usability | Peminjaman satu buku oleh anggota yang layak dapat diselesaikan admin dalam ≤ 4 langkah: pindai anggota, pindai buku, konfirmasi, selesai. | Uji skenario UAT |
| NFR-USA-02 | Usability | Antarmuka berbahasa Indonesia; tanggal berformat DD/MM/YYYY dan uang berformat Rupiah. | Review UI |
| NFR-CMP-01 | Kompatibilitas | Mendukung versi terbaru Chrome dan Safari di Android dan iOS, serta Chrome, Edge, dan Firefox di desktop. | Uji perangkat (WBS 6.2.4) |
| NFR-MNT-01 | Maintainability | Perubahan skema basis data hanya dilakukan melalui file migration. | Review kode |
| NFR-MNT-02 | Maintainability | Modul perhitungan denda memiliki unit test yang mencakup seluruh contoh uji pada BAB 4.7. | Laporan unit test |

BAB 7 — Kebutuhan Data

7.1 Entitas Logis

Sembilan entitas berikut menjadi dasar ERD (WBS 3.4.1). Atribut yang dicantumkan hanya atribut yang mengikat secara aturan; rincian lengkapnya disusun pada kamus data (WBS 3.4.2).

| **[ TEMPAT DIAGRAM ]** Gambar 7.1 — Entity Relationship Diagram (ERD) Penyusun: Data Engineer · Acuan: Panduan Pembuatan Diagram SRS, bagian ERD *Hapus kotak ini dan sisipkan gambar pada posisi yang sama.* |
| --- |

*Gambar 7.1 Entity Relationship Diagram (ERD)*

| **Kode** | **Entitas** | **Atribut kunci dan aturan** |
| --- | --- | --- |
| DR-01 | Admin | Email unik, hash password. Dibuat melalui seed. |
| DR-02 | Anggota | ID anggota unik, NIK unik (16 digit), email unik, nama, alamat, telepon, foto opsional, hash password, tanggal daftar. |
| DR-03 | Kategori | Nama unik. |
| DR-04 | Rak | Kode atau nama lokasi unik. |
| DR-05 | Judul Buku | ISBN, judul, penulis, penerbit, tahun, kategori, cover, harga (> 0). |
| DR-06 | Eksemplar | Kode eksemplar unik, judul, rak, status. |
| DR-07 | Transaksi Peminjaman | Anggota, admin pemroses, tanggal transaksi, status (Aktif/Selesai). |
| DR-08 | Item Transaksi | Transaksi, eksemplar, tanggal pinjam, jatuh tempo, tanggal kembali, status, keterangan hilang/rusak. |
| DR-09 | Tagihan | Item transaksi, jenis (Denda/Penggantian), nominal, status, cara penyelesaian, tanggal penyelesaian, admin pengonfirmasi. |

Nominal tagihan disimpan saat tagihan dibentuk dan tidak dihitung ulang bila harga judul berubah kemudian. Satu item transaksi paling banyak memiliki satu tagihan.

7.2 Status dan Transisi

Empat objek memiliki siklus status: eksemplar, item transaksi, transaksi peminjaman, dan tagihan. Terlambat bukan status tersimpan, melainkan kondisi turunan dari item berstatus Dipinjam yang melewati jatuh tempo (FR-DND-05).

| **Objek** | **Dari** | **Ke** | **Pemicu** |
| --- | --- | --- | --- |
| Eksemplar | (baru) | Tersedia | Eksemplar ditambahkan (FR-BKU-04) |
| Eksemplar | Tersedia | Dipinjam | Peminjaman dikonfirmasi (FR-PJM-12) |
| Eksemplar | Dipinjam | Tersedia | Pengembalian (FR-KMB-05) |
| Eksemplar | Dipinjam | Hilang / Rusak | Pencatatan hilang/rusak (FR-HLR-03) |
| Eksemplar | Tersedia | Rusak | Kerusakan di luar transaksi (FR-BKU-07) |
| Eksemplar | Hilang / Rusak | Tersedia | Buku pengganti identik diterima (FR-TGH-04) |
| Item transaksi | Dipinjam | Dikembalikan | Pengembalian (FR-KMB-05) |
| Item transaksi | Dipinjam | Hilang / Rusak | Pencatatan hilang/rusak (FR-HLR-03) |
| Transaksi | Aktif | Selesai | Seluruh item selesai (FR-KMB-08) |
| Tagihan | Belum Lunas | Lunas | Penyelesaian dikonfirmasi admin (FR-TGH-05) |

Eksemplar Rusak yang berasal dari luar transaksi tidak memiliki tagihan, sehingga pemulihannya ke status Tersedia berada di luar cakupan sistem; bila buku diganti, admin menambahkan eksemplar baru.

Diagram Status

| **[ TEMPAT DIAGRAM ]** Gambar 7.2 — State Diagram Eksemplar Penyusun: System Analyst · Acuan: Panduan Pembuatan Diagram SRS, bagian State Diagram SD-01 *Hapus kotak ini dan sisipkan gambar pada posisi yang sama.* |
| --- |

*Gambar 7.2 State Diagram Eksemplar*

| **[ TEMPAT DIAGRAM ]** Gambar 7.3 — State Diagram Item Transaksi Penyusun: System Analyst · Acuan: Panduan Pembuatan Diagram SRS, bagian State Diagram SD-02 *Hapus kotak ini dan sisipkan gambar pada posisi yang sama.* |
| --- |

*Gambar 7.3 State Diagram Item Transaksi*

| **[ TEMPAT DIAGRAM ]** Gambar 7.4 — State Diagram Transaksi Peminjaman Penyusun: System Analyst · Acuan: Panduan Pembuatan Diagram SRS, bagian State Diagram SD-03 *Hapus kotak ini dan sisipkan gambar pada posisi yang sama.* |
| --- |

*Gambar 7.4 State Diagram Transaksi Peminjaman*

| **[ TEMPAT DIAGRAM ]** Gambar 7.5 — State Diagram Tagihan Penyusun: System Analyst · Acuan: Panduan Pembuatan Diagram SRS, bagian State Diagram SD-04 *Hapus kotak ini dan sisipkan gambar pada posisi yang sama.* |
| --- |

*Gambar 7.5 State Diagram Tagihan*

BAB 8 — Matriks Keterlacakan

Seluruh 20 aturan bisnis tercakup oleh minimal satu kebutuhan fungsional dan satu paket kerja implementasi pada WBS.

| **Aturan** | **Kebutuhan SRS** | **Paket kerja WBS** |
| --- | --- | --- |
| BR-01 | FR-KTL-01, FR-KTL-05 | 5.3.2, 5.4.2 |
| BR-02 | FR-AKN-05, NFR-SEC-03 | 3.2.3, 5.3.1 |
| BR-03 | FR-AKN-02, FR-AKN-03, FR-AKN-04 | 5.3.3, 3.4.3 |
| BR-04 | FR-AKN-04, FR-AGT-01 | 5.3.3, 3.5.1 |
| BR-05 | FR-BKU-04 | 5.3.6, 3.4.3 |
| BR-06 | FR-BKU-02, FR-BKU-03 | 3.4.1, 5.3.5 |
| BR-07 | FR-PJM-10 | 5.3.8, 3.2.3 |
| BR-08 | FR-PJM-08 | 5.3.8 |
| BR-09 | FR-PJM-05, FR-PJM-07 | 5.3.8 |
| BR-10 | FR-PJM-06 | 5.3.8 |
| BR-11 | FR-PJM-11, FR-PJM-13 | 5.3.7, 5.3.8 |
| BR-12 | FR-DND-01, FR-DND-02, FR-DND-04, FR-KMB-04 | 5.3.7 |
| BR-13 | FR-DND-03 | 5.3.7 |
| BR-14 | FR-HLR-01, FR-HLR-05, FR-DND-06 | 5.3.10 |
| BR-15 | FR-HLR-04, FR-TGH-03 | 5.3.10, 5.3.11 |
| BR-16 | FR-HLR-02 | 5.3.10 |
| BR-17 | FR-TGH-02 | 5.3.11 |
| BR-18 | FR-PJM-03, FR-PJM-04 | 5.3.8 |
| BR-19 | FR-TGH-07 | 5.3.8, 5.3.11 |
| BR-20 | FR-KMB-05, FR-TGH-04 | 5.3.9, 5.3.11 |

Keputusan K-02 menambah cakupan pada paket kerja 5.3.6 dan 5.4.7 (ubah status eksemplar menjadi Rusak). Keputusan K-01, K-03, K-04, dan K-05 justru menghapus kebutuhan potensial, sehingga tidak ada paket kerja baru.

Lampiran A — Daftar Gambar

Tabel berikut mencatat seluruh diagram yang disisipkan ke dokumen ini. Kolom status diperbarui saat gambar final telah menggantikan kotak tempat diagram.

| **Gambar** | **Judul** | **Bagian** | **Penyusun** | **Status** |
| --- | --- | --- | --- | --- |
| 2.1 | Diagram Arsitektur Sistem | 2.1 | System Analyst | Menunggu |
| 4.1 | Use Case Diagram | 4.1 | System Analyst | Menunggu |
| 4.2 | Activity Diagram Pendaftaran Anggota | 4.3 | System Analyst | Menunggu |
| 4.3 | Activity Diagram Peminjaman Buku | 4.5 | System Analyst | Menunggu |
| 4.4 | Activity Diagram Pengembalian Buku | 4.6 | System Analyst | Menunggu |
| 4.5 | Activity Diagram Pencatatan Buku Hilang/Rusak | 4.8 | System Analyst | Menunggu |
| 4.6 | Activity Diagram Penyelesaian Tagihan | 4.9 | System Analyst | Menunggu |
| 7.1 | Entity Relationship Diagram | 7.1 | Data Engineer | Menunggu |
| 7.2 | State Diagram Eksemplar | 7.2 | System Analyst | Menunggu |
| 7.3 | State Diagram Item Transaksi | 7.2 | System Analyst | Menunggu |
| 7.4 | State Diagram Transaksi Peminjaman | 7.2 | System Analyst | Menunggu |
| 7.5 | State Diagram Tagihan | 7.2 | System Analyst | Menunggu |
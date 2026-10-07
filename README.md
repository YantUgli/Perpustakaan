# Sistem Informasi Perpustakaan Berbasis Web

Aplikasi web perpustakaan **buku fisik**: katalog publik tanpa login, keanggotaan, sirkulasi
(peminjaman/pengembalian via pemindaian QR dari kamera ponsel admin), denda otomatis,
penggantian buku hilang/rusak, dashboard, dan laporan PDF/Excel.

Stack: **Next.js (frontend) · FastAPI (backend REST/JSON) · PostgreSQL 16**. Wajib HTTPS.

## Dokumen

| Dokumen | Isi |
|---|---|
| `docs/source/02-srs.md` | SRS v1.0 — **acuan utama**; setiap kebutuhan berkode FR-/NFR-/IR-/DR- |
| `docs/source/03-wbs.md` | WBS v1.0 — paket kerja (WP) dan ketergantungan |
| `docs/source/01-project-brief.md` | Project Brief v3.0 — latar belakang dan aturan bisnis BR-01..BR-20 |
| `docs/proyek/decisions.md` | Keputusan teknis (§B) dan pertanyaan terbuka OQ-xx beserta default sementara |
| `docs/proyek/progress.md` | Status setiap WP dan log sesi |
| `docs/proyek/branching.md` | Aturan cabang dan pesan commit |

## Struktur

```
backend/     FastAPI: app/api (router) → app/services (aturan bisnis) → app/models; tests/; alembic/
frontend/    Next.js App Router + TypeScript + Tailwind
docs/        Dokumen sumber dan dokumen proyek
infra/       Skrip inisialisasi PostgreSQL untuk docker-compose
```

## Menjalankan

Prasyarat: Docker, [`uv`](https://docs.astral.sh/uv/), Node ≥ 24.

```bash
# basis data — PostgreSQL 16 di 127.0.0.1:5434, DB dev `perpustakaan` + `perpustakaan_test`
docker compose up -d

# backend
cd backend && cp .env.example .env          # sekali saja; isi ADMIN_AWAL_*
uv sync                                      # install
uv run alembic upgrade head                  # jalankan migration ke DB dev
uv run python -m app.seed admin              # admin awal dari env ADMIN_AWAL_* (password tak pernah dicetak)
uv run python -m app.seed data-uji           # kategori, rak, ±60 judul (dev/staging saja; idempoten)
uv run python -m app.seed performa           # 10.000 eksemplar untuk uji NFR-PRF-01 (dev/staging; idempoten)
uv run python -m app.seed skenario            # 10 akun QA bertanggal mundur (dev/staging; butuh SKENARIO_PASSWORD & admin)
uv run python -m app.seed reset --ya <nama_db> # kosongkan semua kecuali admin, lalu data-uji + skenario (dev/staging)
uv run uvicorn app.main:app --reload         # server dev → http://localhost:8000/api/v1/docs

# frontend
cd frontend && cp .env.example .env.local   # sekali saja
npm install
npm run dev                                  # http://localhost:3000
```

Frontend dan API **satu origin** (`docs/proyek/decisions.md` §B): browser selalu memanggil path relatif `/api/v1`.
Saat `npm run dev`, Next.js meneruskannya ke backend (`API_INTERNAL_URL` di `frontend/.env.local`, kosong =
`http://127.0.0.1:8000`). Rewrite ini **hanya aktif di development**. `next build && next start` di lokal butuh
reverse proxy yang meneruskan `/api/v1` ke FastAPI pada origin yang sama (seperti staging/produksi), dan
`API_INTERNAL_URL` wajib diisi.

> ⚠ Server produksi **wajib** `APP_ENV=production` (nilai sah: `dev` | `staging` | `production`).
> Produksi hanya di-seed akun admin (OQ-15). Admin lupa password → jalankan seed admin dengan email lain (OQ-14).

## Data uji skenario (QA)

`seed skenario` membuat 10 akun `<skenario>@skenario.example` (terlambat 0/1/7/8/70/71 hari, tiga pinjaman aktif,
tagihan Denda dan Penggantian Belum Lunas, tanpa pinjaman) dengan tanggal relatif terhadap hari ini (WIB).
Rincian: `docs/proyek/decisions.md` §B "Seed skenario & reset".

- **Prasyarat:** admin sudah di-seed dan `SKENARIO_PASSWORD` (≥ 8 karakter) diisi di env server; password itu
  dipakai semua akun skenario.
- **Reset sebelum setiap sesi uji:** `uv run python -m app.seed reset --ya <nama_db>`. `<nama_db>` wajib sama
  dengan DB yang dituju; host dan nama DB dicetak lebih dulu.
- **Data bergeser harian:** skenario "terlambat 7 hari" menjadi 8 hari keesokan harinya.
- **Ikut terhapus:** semua sesi (termasuk admin; semua orang login ulang) dan data performa. Jalankan ulang
  `seed performa` sebelum uji NFR-PRF.
- **Staging:** reset hanya **sebelum** sesi UAT, tidak saat sesi berlangsung (data yang dimasukkan client ikut terhapus).
- Tabel email, kode anggota, dan kode eksemplar tiap skenario dicetak di akhir perintah.

## Alamat (dev)

| Layanan                        | URL                                 |
| ------------------------------ | ----------------------------------- |
| Frontend                       | http://localhost:3000               |
| API via frontend (rewrite dev) | http://localhost:3000/api/v1/health |
| Backend                        | http://localhost:8000               |
| API Docs                       | http://localhost:8000/api/v1/docs   |
| Health                         | http://localhost:8000/api/v1/health |
| PostgreSQL                     | 127.0.0.1:5434                      |

## Pemeriksaan sebelum merge

```bash
# backend
uv run pytest                                          # PostgreSQL sungguhan, DB *_test
uv run ruff check . && uv run ruff format --check .
uv run alembic check                                   # model dan migration harus sinkron

# frontend
npm test && npm run lint && npm run format:check && npm run build
```

Perubahan skema selalu lewat migration **baru** (`uv run alembic revision --autogenerate -m "<pesan>"`,
lalu periksa isinya); migration yang sudah di-commit tidak diedit.

## Menghentikan

```bash
# backend / frontend: Ctrl+C di terminal masing-masing
docker compose down        # hentikan DB (data tetap tersimpan)
docker compose down -v     # hentikan DB + hapus seluruh data
```

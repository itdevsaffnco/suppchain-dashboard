# Supply Chain Dashboard

Dashboard SCM (forecast & realization, stock health, aging stock) berbasis
**Next.js 16 + React 19 + Chart.js** dengan backend **Laravel 13 + MySQL**,
disusun sebagai **monorepo**.

```
apps/web   Frontend Next.js (UI + route handler yang mem-proxy ke backend)
apps/api   Backend Laravel 13 (sumber data & autentikasi, MySQL)
```

## Menjalankan

```bash
npm install                  # sekali di awal (root — npm workspaces)
composer install -d apps/api # sekali di awal (dependency PHP)

npm run dev        # jalankan web + api sekaligus
                   #   web → http://localhost:3000
                   #   api → http://127.0.0.1:8000
```

Script lain:

| Perintah | Fungsi |
|---|---|
| `npm run dev:web` / `npm run dev:api` | Jalankan salah satu saja |
| `npm run build` | Production build frontend |
| `npm run api:migrate` | Jalankan migration |
| `npm run api:seed` | Isi data awal |
| `npm run api:fresh` | Drop semua tabel → migrate ulang → seed |
| `npm run api:route` | Daftar endpoint backend |
| `npm run seed:sync` | Regenerate `seed.json` dari `apps/web/lib/dashboard.ts` |

### Setup pertama kali

```bash
cp apps/api/.env.example apps/api/.env   # isi DB_* dan APP_API_KEY
cp apps/web/.env.example apps/web/.env.local
php apps/api/artisan key:generate
npm run api:fresh                        # migrate + seed
```

`APP_API_KEY` di `apps/api/.env` dan `apps/web/.env.local` **harus sama** —
itu kunci yang dipakai Next.js untuk memanggil Laravel.

### Akun awal

| Username   | Email                  | Role  | Password default |
|------------|------------------------|-------|------------------|
| `admin_sc` | admin@saffnco.com      | Admin | `saffnco123`     |
| `staff_wh` | staff.wh@saffnco.com   | User  | `saffnco123`     |

Login bisa pakai **username atau email**. Password tersimpan ter-hash (bcrypt)
di MySQL — **ganti password default setelah login pertama**. Default-nya bisa
diatur lewat `SEED_USER_PASSWORD` di `apps/api/.env` sebelum seeding.

## Alur request

Browser tidak pernah memanggil Laravel langsung. Cookie sesi (httpOnly, JWT)
tetap dipegang Next.js dan menyimpan token Sanctum di dalamnya:

```
Browser ──cookie scm_session──> Next.js /api/*  ──Bearer + X-App-Key──> Laravel /api/*  ──> MySQL
```

Artinya token backend tidak pernah sampai ke JavaScript di browser, dan seluruh
endpoint Laravel tertutup untuk akses langsung dari luar (butuh `X-App-Key`).

## Peta direktori — mau ubah apa, ke mana?

| Mau ubah…                                    | Edit file                                   |
|----------------------------------------------|---------------------------------------------|
| **Teks / label / terjemahan** (semua tulisan di UI) | `apps/web/lib/i18n/en.ts` + `id.ts`  |
| Judul tab browser & font                     | `apps/web/app/layout.tsx`                   |
| **Warna, tema, transisi, style UI** (CSS)    | `apps/web/app/globals.css`                  |
| Warna & palet **chart** per tema             | `apps/web/lib/chartThemes.ts`               |
| Komponen chart (bar/line/doughnut)           | `apps/web/components/charts.tsx`            |
| **Halaman utama / semua tab UI** (login, dashboard, tabel, modal, settings) | `apps/web/components/Dashboard.tsx` |
| Halaman reset password (dari link email)     | `apps/web/app/reset-password/` + `components/ResetPasswordForm.tsx` |
| Animasi background (logistics network)       | `apps/web/components/LiveWallpaper.tsx`     |
| Perhitungan KPI / status stok / aging        | `apps/web/lib/dashboard.ts` (enrichSku/computeKpis) |
| Import/export CSV                            | `apps/web/lib/csv.ts`                       |
| Pengiriman email reset (SMTP)                | `apps/web/lib/mailer.ts`                    |
| Pemanggilan ke backend (server-only)         | `apps/web/lib/api.ts`                       |
| Session cookie & JWT                         | `apps/web/lib/auth.ts`, `lib/session.ts`    |
| **Struktur tabel database**                  | `apps/api/database/migrations/`             |
| **Data awal** (SKU, kategori, user)          | `apps/web/lib/dashboard.ts` → `npm run seed:sync` |
| Endpoint backend                             | `apps/api/routes/api.php`                   |
| Logika login/user/dashboard (server)         | `apps/api/app/Http/Controllers/`            |
| Model & relasi data                          | `apps/api/app/Models/`                      |

## Struktur singkat

```
apps/web/
  app/            Routes Next.js (App Router)
    api/            Route handler — proxy tipis ke Laravel
    reset-password/ Halaman "buat password baru" dari link email
  components/     Komponen React (Dashboard.tsx = hampir seluruh UI)
  lib/            i18n, seed data, auth/session, api client, chart themes, CSV
apps/api/
  app/Models/                 Sku, Batch, Category, User, dll.
  app/Http/Controllers/       Auth, Dashboard, User
  app/Http/Middleware/        EnsureAppKey, EnsureAdmin
  routes/api.php              Definisi endpoint
  database/migrations/        Skema tabel
  database/seeders/           Seeder + data/seed.json (hasil generate)
scripts/          generate-seed.mjs (sinkron seed TS → JSON)
apps-script/      Code.gs backend Google Apps Script (LEGACY, tidak dipakai)
legacy/           File lama yang TIDAK dipakai app (index.html standalone)
```

> ⚠️ Mengubah `legacy/index.html` atau `apps-script/Code.gs` **tidak mengubah
> tampilan di localhost** — semua UI berasal dari `apps/web/components/` +
> `apps/web/lib/i18n/`.

## Endpoint backend

Semua butuh header `X-App-Key`; yang bertanda 🔒 juga butuh Bearer token.

| Method | Path | Fungsi |
|---|---|---|
| POST | `/api/auth/login` | Login (username **atau** email) → token |
| GET | `/api/auth/me` 🔒 | User yang sedang login |
| POST | `/api/auth/logout` 🔒 | Cabut token |
| POST | `/api/auth/change-password` 🔒 | Ganti password sendiri |
| POST | `/api/auth/forgot-password` | Terbitkan token reset |
| GET | `/api/auth/reset-password` | Validasi token reset |
| POST | `/api/auth/reset-password` | Set password baru (token sekali pakai, 30 menit) |
| GET | `/api/dashboard` 🔒 | Dataset dashboard (skus, categories, users) |
| GET/POST | `/api/users` 🔒 Admin | List / tambah user |
| DELETE | `/api/users/{id}` 🔒 Admin | Hapus user |

## Konfigurasi (env)

**`apps/web/.env.local`**

| Variabel | Fungsi |
|---|---|
| `API_BASE_URL` | Base URL Laravel (default `http://127.0.0.1:8000/api`) |
| `APP_API_KEY` | Kunci bersama — harus sama dengan yang di `apps/api/.env` |
| `SESSION_SECRET` | Wajib di production — secret JWT session cookie |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email reset password. Tanpa ini, link reset ditampilkan di UI/console (mode dev) |

**`apps/api/.env`**

| Variabel | Fungsi |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | Koneksi MySQL |
| `APP_API_KEY` | Kunci bersama yang diverifikasi middleware `app-key` |
| `SEED_USER_PASSWORD` | Password default user hasil seeding |

## Catatan

- `npm run api:test` butuh ekstensi PHP `sqlite3` (phpunit memakai SQLite
  in-memory). Di mesin ini ekstensi tersebut belum terpasang:
  `sudo apt install php8.3-sqlite3`.
- Data awal bersumber dari `apps/web/lib/dashboard.ts`. Setelah mengubahnya,
  jalankan `npm run seed:sync` lalu `npm run api:fresh`.

# Supply Chain Dashboard

Dashboard SCM (forecast & realization, stock health, aging stock) berbasis
**Next.js 16 + React 19 + Chart.js**. Saat ini berjalan dengan **seed data**
(in-memory); backend Google Apps Script/Sheets menyusul.

## Menjalankan

```bash
npm run dev     # development → http://localhost:3000
npm run build   # production build
```

### Akun demo

| Username   | Email                  | Role  |
|------------|------------------------|-------|
| `admin_sc` | admin@saffnco.com      | Admin |
| `staff_wh` | staff.wh@saffnco.com   | User  |

Login bisa pakai **username atau email**. Mode demo: password bebas sampai user
melakukan reset/ubah password (setelah itu password tersimpan di memori server
sampai restart).

## Peta direktori — mau ubah apa, ke mana?

| Mau ubah…                                    | Edit file                                   |
|----------------------------------------------|---------------------------------------------|
| **Teks / label / terjemahan** (semua tulisan di UI) | `lib/i18n/en.ts` + `lib/i18n/id.ts`  |
| Judul tab browser & font                     | `app/layout.tsx`                            |
| **Warna, tema, transisi, style UI** (CSS)    | `app/globals.css`                           |
| Warna & palet **chart** per tema             | `lib/chartThemes.ts`                        |
| Komponen chart (bar/line/doughnut)           | `components/charts.tsx`                     |
| **Halaman utama / semua tab UI** (login, dashboard, tabel, modal, settings) | `components/Dashboard.tsx` |
| Halaman reset password (dari link email)     | `app/reset-password/` + `components/ResetPasswordForm.tsx` |
| Animasi background (logistics network)       | `components/LiveWallpaper.tsx`              |
| **Seed data** (SKU, kategori, user awal)     | `lib/dashboard.ts`                          |
| Login / logout / session (server)            | `app/api/login/`, `app/api/logout/`, `lib/auth.ts`, `lib/session.ts` |
| Forgot/reset password (server)               | `app/api/forgot-password/`, `app/api/reset-password/` |
| User management (server, simpan user & password) | `app/api/users/`, `lib/userStore.ts`    |
| Pengiriman email reset (SMTP)                | `lib/mailer.ts`                             |
| Perhitungan KPI / status stok / aging        | `lib/dashboard.ts` (fungsi enrich/recalc), `lib/recalc.ts` |
| Import/export CSV                            | `lib/csv.ts`                                |

## Struktur singkat

```
app/            Routes Next.js (App Router)
  page.tsx        Halaman utama → render components/Dashboard.tsx
  layout.tsx      Root layout: font, judul tab, ikon
  globals.css     SELURUH styling & tema (design tokens di bagian atas)
  reset-password/ Halaman "buat password baru" dari link email
  api/            Route handler server (login, users, forgot-password, dll.)
components/     Komponen React (Dashboard.tsx = hampir seluruh UI)
lib/            Logika & data (i18n, seed data, auth, user store, chart themes)
apps-script/    Code.gs untuk backend Google Apps Script (BELUM dipakai —
                di-deploy ke Google nanti; set APPS_SCRIPT_URL untuk mengaktifkan)
legacy/         File lama yang TIDAK dipakai app (index.html standalone)
public/         Aset statis
```

> ⚠️ Mengubah `legacy/index.html` atau `apps-script/Code.gs` **tidak mengubah
> tampilan di localhost** — semua UI berasal dari `components/` + `lib/i18n/`.

## Konfigurasi (env)

| Variabel | Fungsi |
|---|---|
| `SESSION_SECRET` | Wajib di production — secret JWT session |
| `APPS_SCRIPT_URL` | Jika diset, login & data diambil dari backend Apps Script |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Pengiriman email reset password. Tanpa ini, link reset ditampilkan di UI/console (mode demo) |

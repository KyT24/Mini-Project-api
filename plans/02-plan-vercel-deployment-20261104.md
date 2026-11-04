# Plan 02: Deployment Backend Express ke Vercel Serverless

> **File:** `/plans/02-plan-vercel-deployment-20261104.md`  
> **Tanggal:** 2026-11-04  
> **Status:** IN PROGRESS (Fixes Applied & Ready for Deployment)  
> **Target Aplikasi:** `/Users/oktaviardi/Okta/api-clinic-appointment`  
> **Target Platform:** Vercel (Serverless Node.js Runtime)  

---

## ⚠️ Diagnosa & Solusi Akar Masalah Error 500 di Vercel

Jika deployment Express ke Vercel mengalami **HTTP 500 Internal Server Error**, berikut adalah 5 penyebab utama yang telah diidentifikasi dan diperbaiki:

| No | Gejala / Akar Masalah Error 500 | Dampak di Vercel | Solusi yang Diterapkan |
| :--- | :--- | :--- | :--- |
| **1** | **`src/generated/prisma` tidak ada saat runtime** | Folder `src/generated/prisma` ada di `.gitignore`. Saat Vercel clone repo, folder ini kosong. Karena sebelumnya tidak ada `"postinstall": "prisma generate"`, Prisma Client tidak terbuat, menyebabkan crash saat start: `Cannot find module '../generated/prisma/client'` | Ditambahkan `"postinstall": "prisma generate"` dan `"build": "prisma generate && tsc"` di `package.json`. |
| **2** | **CORS melempar Error 500 pada request tanpa origin** | Kode CORS lama melempar `new Error('Origin not allowed by CORS')` jika `!ALLOWED_ORIGINS.includes(origin)`. Ketika curl, Postman, browser direct GET, atau SSR fetch Next.js memanggil API tanpa header `Origin` (`origin === undefined`), Express langsung mengembalikan HTTP 500. | Diperbarui di `src/configs/cors.config.ts`: mengizinkan request tanpa origin (`!origin`) dan otomatis mengizinkan seluruh domain `*.vercel.app` (production & preview). |
| **3** | **Export Express tidak kompatibel dengan CommonJS runner Vercel** | `export default app` di TypeScript CommonJS terkompilasi menjadi `exports.default = app`. Runner Vercel yang mengeksekusi `module.exports(req, res)` gagal dengan `TypeError: handler is not a function` (Error 500). | Diperbarui di `api/index.ts` dan `src/application/app.ts`: menyertakan `module.exports = app` dan `module.exports.default = app`. |
| **4** | **`API_PREFIX` undefined dan `PORT = NaN`** | Di `src/server.ts`, `parseInt(process.env.PORT!)` dan `process.env.API_PREFIX!` tanpa nilai default menyebabkan rute terdaftar di `undefined/auth`, dan `app.listen(NaN)` melempar uncaught exception jika `NODE_ENV=DEVELOPMENT` aktif di Vercel. | Diberikan fallback default `PORT = 8000` dan `API_PREFIX = '/api/v1'`, serta listener lokal hanya jalan jika `!process.env.VERCEL`. Ditambahkan pula healthcheck di `/` dan `/health`. |
| **5** | **Konfigurasi `vercel.json` menggunakan `builds` deprecated** | `@vercel/node` di blok `builds` lama sering gagal resolve path. | Diganti menggunakan modern zero-config serverless rewrites: meneruskan `/(.*)` ke handler `/api`. |  

---

## 1. Ringkasan Eksekutif & Tujuan

Aplikasi backend `api-clinic-appointment` saat ini dirancang sebagai server Express.js tradisional yang berjalan secara *long-running* (`app.listen(PORT)`). Tujuan rencana ini adalah menyiapkan dan mengadaptasi seluruh konfigurasi proyek agar dapat di-*deploy* dan berjalan mulus di **Vercel Serverless Functions** tanpa mengganggu kemampuan berjalan secara lokal (`npm run dev` / `npm start`).

---

## 2. Analisis Arsitektur: Tradisional vs Vercel Serverless

| Aspek | Local / Traditional Server | Vercel Serverless | Penyesuaian yang Dibutuhkan |
| :--- | :--- | :--- | :--- |
| **Entry Point** | `src/server.ts` memanggil `app.listen(PORT)` | File handler di `api/index.ts` mengekspor `app` Express | Buat `api/index.ts` sebagai bridge handler serverless dan pastikan `app.listen()` hanya jalan di `NODE_ENV === 'DEVELOPMENT'`. |
| **Routing / Rewrites** | Semua rute ditangani oleh listener Express | `vercel.json` meneruskan seluruh request `/(.*)` ke handler `/api` | Gunakan konfigurasi modern `rewrites` di `vercel.json` (bukan skema legacy `builds` yang deprecated). |
| **Prisma Client** | Di-generate sekali saat `npm run build` | Perlu di-generate otomatis saat `npm install` di Vercel build container | Tambahkan script `"postinstall": "prisma generate"` di `package.json`. |
| **Database Connection** | Koneksi persisten (connection pool standar) | Fungsi serverless bisa membuat banyak koneksi baru secara bersamaan (ephemeral) | Pastikan `DATABASE_URL` menggunakan Supabase Transaction Pooler (port 6543) dengan flag `?connection_limit=1` atau Supabase PostgREST client. |
| **CORS & Origin** | `ALLOWED_ORIGINS=http://localhost:3000` | Frontend Next.js memiliki domain production dan preview Vercel (`*.vercel.app`) | Perbarui `cors.config.ts` agar mengizinkan request tanpa origin (mobile/curl/SSR server action) serta preview domain. |
| **Limit Ukuran Payload** | Dibatasi oleh Express `limit: 10mb` | Vercel Serverless memiliki batas payload request body 4.5 MB di free tier | Bukti bayar terkompresi frontend (~100 KB) aman; upload file dokter dibatasi di bawah 4 MB. |

---

## 3. Rencana Tahapan Eksekusi (Action Items)

```
                       ┌──────────────────────────────────────────┐
                       │          Incoming HTTP Request           │
                       │    https://your-api.vercel.app/api/v1/...│
                       └────────────────────┬─────────────────────┘
                                            │
                                            ▼
                       ┌──────────────────────────────────────────┐
                       │   Vercel Edge Gateway (vercel.json)      │
                       │       Rewrite: /(.*) ──> /api            │
                       └────────────────────┬─────────────────────┘
                                            │
                                            ▼
                       ┌──────────────────────────────────────────┐
                       │     Serverless Function (api/index.ts)   │
                       │             Exports Express App          │
                       └────────────────────┬─────────────────────┘
                                            │
                                            ▼
                       ┌──────────────────────────────────────────┐
                       │     Express 5 Routing & Middlewares      │
                       │   CORS, Auth, Doctors, Queue, Dashboard  │
                       └────────────────────┬─────────────────────┘
                                            │
                                            ▼
                       ┌──────────────────────────────────────────┐
                       │   Supabase PostgreSQL & Cloud Storage    │
                       └──────────────────────────────────────────┘
```

---

### Tahap 1: Serverless Entry Point & Vercel Configuration
- [x] Buat file entry point Vercel di `api/index.ts` yang mengimpor `app` dari `../src/server` (dengan dukungan ES Module dan CommonJS `module.exports`).
- [x] Perbarui `vercel.json` menggunakan format modern Vercel Serverless (menghapus blok `builds` lama yang deprecated dan menggantinya dengan rewrite bersih):
  ```json
  {
    "version": 2,
    "rewrites": [
      {
        "source": "/(.*)",
        "destination": "/api"
      }
    ]
  }
  ```

---

### Tahap 2: Penguatan Server Express untuk Lingkungan Serverless
- [x] **Default Environment Fallback** di `src/server.ts`:
  - Hindari `parseInt(process.env.PORT!)` bernilai `NaN` bila `PORT` tidak diisi di Vercel (default: `8000`).
  - Berikan default `API_PREFIX = '/api/v1'` bila `process.env.API_PREFIX` tidak terdefinisi.
  - Tambahkan healthcheck route `/` dan `/health`.
  - Nonaktifkan `app.listen()` pada environment Vercel (`!process.env.VERCEL`).
- [x] **Penyesuaian CORS** di `src/configs/cors.config.ts`:
  - Izinkan request tanpa `origin` (misal Postman, curl, atau server-to-server fetch dari Next.js Server Actions / SSR).
  - Izinkan domain Vercel preview (`*.vercel.app`) secara otomatis di samping `ALLOWED_ORIGINS`.

---

### Tahap 3: Build Scripts & Otomasi Prisma di `package.json`
- [x] Tambahkan script `"postinstall": "prisma generate"` di `package.json` agar Vercel otomatis meng-generate Prisma Client setelah instalasi dependency.
- [x] Perbarui script `"build"` di `package.json` menjadi `"prisma generate && tsc"`.
- [x] Perbaiki script `"start"` di `package.json` menjadi `"node dist/src/server.js"` (sesuai output build `tsc`).
- [x] Pastikan `npm run build` sukses mengompilasi seluruh kode TypeScript tanpa type error.

---

### Tahap 4: Daftar Environment Variables untuk Vercel Dashboard

Saat membuat project baru di Vercel Dashboard (**Settings -> Environment Variables**), isi variabel berikut:

| Nama Variabel | Contoh Nilai | Keterangan |
| :--- | :--- | :--- |
| `NODE_ENV` | `PRODUCTION` | Mengaktifkan mode produksi |
| `API_PREFIX` | `/api/v1` | Prefix endpoint REST API |
| `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app,http://localhost:3000` | Domain frontend yang diizinkan CORS |
| `JWT_SECRET_KEY` | `94c502da5df3890f666f358ad7d9ba66723b7b4a20b0ddf5170d47aa28f747eb` | Secret key signing token JWT |
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@db.wewieruvgvxupjndagnb.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1` | Supabase Transaction Pooler URL |
| `DIRECT_URL` | `postgresql://postgres:[PASSWORD]@db.wewieruvgvxupjndagnb.supabase.co:5432/postgres` | Supabase direct connection |
| `SUPABASE_URL` | `https://wewieruvgvxupjndagnb.supabase.co` | URL Supabase Project |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_publishable_zdn0kiwPWaQXJciMAhVjFg_VbsdN6Eg` | Key akses Supabase |
| `SUPABASE_BUCKET` | `payment-proofs` | Nama storage bucket publik |

---

### Tahap 5: Panduan Deploy ke Vercel (CLI & GitHub)

#### Opsi 1: Lewat Vercel CLI (Direkomendasikan untuk Cek Cepat)
```bash
# 1. Install vercel CLI secara global bila belum ada
npm install -g vercel

# 2. Login ke akun Vercel
vercel login

# 3. Deploy preview
vercel

# 4. Deploy production
vercel --prod
```

#### Opsi 2: Lewat Git Integration (GitHub / GitLab)
1. Push branch `main` atau `dev` ke repository GitHub Anda.
2. Buka [vercel.com/new](https://vercel.com/new) dan klik **Import**.
3. Pilih repository `api-clinic-appointment`.
4. Masukkan seluruh **Environment Variables** dari tabel di atas.
5. Klik **Deploy**.

---

### Tahap 6: Verifikasi Pasca-Deploy
- [ ] Cek endpoint publik di domain Vercel:
  ```bash
  curl -s https://your-api-project.vercel.app/api/v1/doctors
  ```
- [ ] Cek endpoint antrean live TV:
  ```bash
  curl -s https://your-api-project.vercel.app/api/v1/queue/live
  ```
- [ ] Uji login via Postman menggunakan `base_url` domain Vercel:
  ```bash
  curl -s -X POST https://your-api-project.vercel.app/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@klinik.test","password":"Admin123!"}'
  ```

---

## 4. Antisipasi Kendala & Solusi (Troubleshooting)

1. **Masalah Exhaustion Koneksi PostgreSQL di Serverless**:
   - *Penyebab*: Tiap instance serverless yang menyala (*cold start*) dapat membuka koneksi baru ke database.
   - *Solusi*: Selalu gunakan Supabase Transaction Pooler (port `6543`) dengan parameter `?connection_limit=1`, atau andalkan PostgREST Supabase client yang sudah terpasang di modul service.
2. **Cold Start Latency**:
   - *Solusi*: Ukuran bundle tetap ramping (hanya file yang diperlukan), dan Prisma Client di-cache di luar lifecycle handler request.
3. **Ukuran File Upload di Serverless**:
   - *Penyebab*: Batas maksimum body payload Vercel Serverless adalah 4.5 MB.
   - *Solusi*: Kompresi bukti bayar dari frontend sudah di bawah 100 KB, dan upload foto profil dokter dibatasi maksimal 3 MB.
4. **Error 500 pada `syncStatuses()` di Endpoint `GET /appointments/me`**:
   - *Penyebab*: Fungsi `syncStatuses()` di `appointment.helpers.ts` memanggil `db.appointments.updateMany()` lewat Prisma tanpa `try/catch`. Bila pooler/koneksi Prisma terputus, ia melempar `ECONNREFUSED` yang berujung HTTP 500. Selain itu, `getOwnList()` masih mencoba query relasi `patient_profiles` yang tidak ada di Supabase.
   - *Solusi*: `syncStatuses()` dibungkus dalam `try/catch` resilient, dan `getOwnList()` serta `getOwnById()` dialihkan menggunakan Supabase PostgREST client (`patient_id = userId`) dengan fallback aman. Ditambahkan pula route alias `/appointments/my`.


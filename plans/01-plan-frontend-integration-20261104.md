# Plan 01: Integrasi API Backend dengan Frontend Baru & Harmonisasi Database Tunggal

> **File:** `/plans/01-plan-frontend-integration-20261104.md`  
> **Tanggal:** 2026-11-04  
> **Status:** COMPLETED (Verified with Live Database & Tested Endpoints)  
> **Target Aplikasi Backend:** `/Users/oktaviardi/Okta/api-clinic-appointment`  
> **Target Aplikasi Frontend:** `/Users/oktaviardi/Okta/clinic-appointment-platform`  

---

## 1. Ringkasan Eksekutif & Latar Belakang

Aplikasi frontend baru yang berlokasi di `/Users/oktaviardi/Okta/clinic-appointment-platform` dibangun menggunakan **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS 4**, dan **TanStack Query v5**. Frontend ini memiliki arsitektur client yang sudah siap mengonsumsi REST API (`axiosInstance` dengan base URL `http://localhost:8000/api/v1` dan `withCredentials: true`), namun saat ini fallback ke Supabase RPC/SDK langsung.

**Tujuan Rencana Ini:**
1. Mengadaptasi dan menyelaraskan backend Express API (`api-clinic-appointment`) agar **menggunakan skema basis data PostgreSQL (Supabase) yang sama** dengan frontend.
2. Melengkapi seluruh endpoint backend yang dibutuhkan oleh fitur frontend (termasuk scanner QR check-in di hari H, sistem antrean TV ruang tunggu live, panggilan antrean *call next*, penanda *no-show*, dan dashboard statistik).
3. Mengeliminasi inkonsistensi skema antara Prisma ORM di backend dan skema PostgreSQL di frontend sehingga kedua aplikasi dapat berjalan berdampingan tanpa saling merusak integritas data.

---

## 2. Analisis Kesenjangan (Gap Analysis)

Berdasarkan pembacaan mendalam terhadap `BRIEF.md`, `TECH.md`, skema SQL migrasi frontend (`supabase/migrations/`), dan file types/hooks di kedua proyek, berikut adalah kesenjangan yang ditemukan:

### A. Kesenjangan Skema Basis Data

| Komponen | Backend Saat Ini (`api-clinic-appointment`) | Frontend & Skema SQL (`clinic-appointment-platform`) | Resolusi Harmonisasi |
|---|---|---|---|
| **Tabel Pengguna** | Tabel `users` terpisah, relasi ke `patient_profiles` & `staff_profiles`. | Tabel `public.profiles` yang terikat 1:1 ke `auth.users` Supabase via kolom `id`. Kolom role: `patient` / `admin`. | Sesuaikan model Prisma untuk membaca/menulis ke tabel `profiles` (atau sinkronisasi dengan `auth.users`), serta mendukung relasi profil pasien langsung. |
| **Tabel Dokter** | `doctors` mewajibkan `user_id` (karena dokter dianggap akun user login). Kolom foto: `photo`. | `doctors` tidak memiliki `user_id` (dokter adalah profil master yang dikelola admin, bukan akun login). Kolom foto: `photo_url`. | Jadikan `user_id` opsional (`String?`) atau lepaskan relasi wajib `user_id`, serta tambahkan mapping/alias kolom `photo_url` / `photo`. |
| **Sesi & Antrean** | Sesi di `practice_sessions`, nomor antrean dipisah ke tabel `session_queues`. | `practice_sessions` memiliki kolom `current_queue_number`, `starts_at`, `ends_at`, `schedule_id` langsung di dalam tabel. | Gabungkan tracking antrean langsung ke kolom `practice_sessions.current_queue_number` agar kompatibel dengan display antrean live TV (`/queue`). |
| **Janji Temu (`appointments`)** | Mewajibkan `treatment_id`, fee dipecah (`consultation_fee`, `treatment_fee`, `discount_amount`), bukti bayar di tabel relasi `payment_proofs`. Queue number di-assign saat `approve`. | Menyimpan `code`, `consultation_fee`, `payment_deadline`, `payment_proof_path`, `payment_uploaded_at`, `rejection_reason`, `confirmed_at`, `booking_number`, `qr_token`, `checked_in_at`, `queue_number`, `is_no_show`. Queue number di-assign saat **check-in** di klinik pada hari H. | Sesuaikan kolom tabel `appointments` di Prisma agar mencakup seluruh field yang dibutuhkan frontend (termasuk `payment_proof_path`, `is_no_show`, `confirmed_at`, `checked_in_at`). Buat `treatment_id` opsional. |
| **Bukti Bayar** | File upload murni lewat multipart formData ke Supabase Storage. | Mendukung multipart formData **dan** Base64 string terkompresi dari sisi browser (~50–100 KB). | Backend harus menerima bukti transfer baik berupa multipart image maupun string Base64 Data URL. |

---

### B. Kesenjangan Fitur & Endpoint API

| Fitur yang Dibutuhkan Frontend | Status Backend Saat Ini | Kebutuhan Implementasi di Backend |
|---|---|---|
| **Scan QR Check-In di Hari H** | ❌ Belum ada endpoint check-in. Queue number terbit saat approval. | Buat endpoint `POST /api/v1/admin/queue/check-in` atau `POST /api/v1/appointments/check-in`: validasi sesi hari ini, set `checked_in_at = now()`, dan assign nomor antrean fisik kedatangan (`queue_number = MAX + 1`). |
| **Layar Antrean TV Publik (`/queue`)** | ❌ Belum ada endpoint live queue. | Buat endpoint publik `GET /api/v1/queue/live`: mengembalikan sesi aktif hari ini, nomor antrean yang sedang dilayani, dan 3 antrean berikutnya. |
| **Panggil Antrean Berikutnya (*Call Next*)** | ❌ Belum ada. | Buat endpoint `PATCH /api/v1/admin/queue/call-next`: memajukan `current_queue_number` sesi ke pasien check-in berikutnya. |
| **Tandai Pasien Tidak Hadir (*No-Show*)** | ❌ Belum ada. | Buat endpoint `PATCH /api/v1/admin/appointments/:id/no-show`: set `is_no_show = true`. |
| **Dashboard Metrik Ringkasan Admin** | ❌ Belum ada. | Buat endpoint `GET /api/v1/admin/dashboard/metrics`: janji hari ini, antrean menunggu, verifikasi tertunda, total pendapatan. |
| **Laporan Statistik Grafik Interaktif** | ❌ Belum ada. | Buat endpoint `GET /api/v1/admin/dashboard/stats`: agregasi statistik berdasarkan periode (`day`, `month`, `year`) dan filter `doctor_id` untuk komponen Recharts di `/admin/statistic`. |
| **Unggah Bukti Bayar Base64** | ❌ Hanya menerima `multipart/form-data`. | Dukung payload JSON `{ image_base64: "data:image/jpeg;base64,..." }` di samping upload file standar. |

---

## 3. Strategi Harmonisasi Skema Database Tunggal (Unified Database Strategy)

Agar frontend Next.js dan backend Express API dapat bekerja pada **satu database PostgreSQL Supabase yang sama**:

### 1. Prinsip Utama: Prisma Mengikuti Skema PostgreSQL Supabase
Skema Prisma di `prisma/schema.prisma` akan diselaraskan dengan struktur tabel Supabase yang telah dimigrasi oleh frontend (`supabase/migrations/20261103000000_init_schema.sql` dkk).

```
                      ┌────────────────────────────────────────┐
                      │    PostgreSQL Database (Supabase)      │
                      │   - profiles                           │
                      │   - specialists                        │
                      │   - doctors                            │
                      │   - doctor_schedules                   │
                      │   - practice_sessions                  │
                      │   - appointments                       │
                      │   - ratings                            │
                      │   - treatments (opsional/katalog)      │
                      └───────────┬────────────────┬───────────┘
                                  │                │
            Prisma Client Adapter │                │ Supabase SDK / Auth
                                  ▼                ▼
                     ┌────────────────┐       ┌────────────────┐
                     │ Express API    │       │ Next.js App    │
                     │ (Backend App)  │       │ (Frontend App) │
                     └────────────────┘       └────────────────┘
```

### 2. Rincian Penyesuaian Model Prisma (`prisma/schema.prisma`)
1. **Model `profiles`**:
   - Memetakan ke `profiles` dengan id UUID (terikat ke `auth.users`).
   - Field: `id`, `role` (`patient`, `admin`), `full_name`, `phone_number`, `avatar_url`, `date_of_birth`, `gender`, `address`.
2. **Model `doctors`**:
   - Field: `id`, `specialist_id`, `full_name`, `bio`, `experience_years`, `consultation_fee`, `photo_url`, `is_active`.
   - Menghapus kewajiban `user_id`.
3. **Model `practice_sessions`**:
   - Menambahkan `current_queue_number`, `starts_at`, `ends_at`, `schedule_id`.
4. **Model `appointments`**:
   - Menambahkan `code` (string), `payment_proof_path` (string?), `payment_uploaded_at` (datetime?), `rejection_reason` (string?), `confirmed_at` (datetime?), `booking_number` (int?), `is_no_show` (boolean default false).
   - `treatment_id` dijadikan nullable agar reservasi konsultasi murni tanpa treatment tetap valid.
5. **Model `ratings`**:
   - `patient_id` mereferensikan `profiles.id`.

---

## 4. Rencana Tahapan Eksekusi (Phased Roadmap)

### Tahap 1: Sinkronisasi & Penyesuaian Skema Database (Prisma)
- [x] Perbarui `prisma/schema.prisma` agar merefleksikan skema tabel Supabase yang sebenarnya (kolom `code`, `payment_proof_path`, `payment_uploaded_at`, `confirmed_at`, `is_no_show`, `photo_url`, `starts_at`, `ends_at`, `current_queue_number`, `schedule_id`).
- [x] Jalankan Prisma Generate (`./node_modules/.bin/prisma generate`) -> Berhasil generate ke `src/generated/prisma`.
- [x] Verifikasi bahwa Prisma Client ter-generate dengan sempurna tanpa type errors.

### Tahap 2: Penyelarasan Autentikasi & Akun Profil
- [x] Sinkronkan controller auth backend (`auth.controller.ts` & `auth.service.ts`) agar bekerja dengan format token & profil.
- [x] Pastikan endpoint `/api/v1/auth/me` mengembalikan struktur `TAuthUser` yang identik dengan yang diharapkan frontend.

### Tahap 3: Update Modul Dokter, Spesialis, dan Jadwal
- [x] Update `DoctorService`: mendukung filter `day_of_week`, `min_fee`, `max_fee` pada `GET /api/v1/doctors`.
- [x] Update `ScheduleService` & `AppointmentService` agar saat sesi pertama dibuat, field `starts_at`, `ends_at`, `schedule_id`, dan `current_queue_number` otomatis terisi di `practice_sessions`.

### Tahap 4: Update Modul Janji Temu (Booking, Payment Proof & Approval)
- [x] Update `AppointmentService.createAppointment`: simpan `code` berformat `APT-YYMMDD-XXXXXX`.
- [x] Update `AppointmentService.uploadPaymentProof`: dukung upload multipart file **dan** Base64 Data URL (`Storage.uploadBase64`), simpan `payment_proof_path` dan `payment_uploaded_at`.
- [x] Update `AppointmentAdminService.approve`: set status `done`, terbitkan `qr_token`, dan simpan `confirmed_at`.
- [x] Update `AppointmentAdminService.reject`: set status `rejected` dan simpan `rejection_reason`.

### Tahap 5: Implementasi Fitur Baru Antrean, Check-In & TV Display
- [x] Buat validator `src/validators/queue.validator.ts`: `checkInSchema`, `callNextSchema`, `noShowSchema`.
- [x] Buat service & controller `src/features/queue/queue.service.ts` & `queue.controller.ts`:
  - `POST /api/v1/admin/queue/check-in`:
    - Validasi token QR (`qr_token`), kode janji, atau format `KODE:TOKEN`.
    - Validasi bahwa sesi adalah **hari ini** (WIB).
    - Beri nomor antrean urut kedatangan: `queue_number = MAX(queue_number) + 1`.
    - Set `checked_in_at = now()`.
    - Penanganan anti-duplikasi ramah (idempotent feedback).
  - `GET /api/v1/queue/live`:
    - Ambil sesi aktif hari ini.
    - Ambil `current_serving` dan daftar 3 nomor antrean berikutnya yang sudah check-in.
  - `PATCH /api/v1/admin/queue/call-next`:
    - Majukan `current_queue_number` ke antrean terdaftar berikutnya.
  - `PATCH /api/v1/admin/queue/no-show/:id`:
    - Tandai appointment dengan `is_no_show = true`.
- [x] Daftarkan route di `src/server.ts` pada `/api/v1/queue` dan `/api/v1/admin/queue`.

### Tahap 6: Implementasi Dashboard & Laporan Statistik
- [x] Buat validator `src/validators/dashboard.validator.ts`: `getDashboardStatsSchema`.
- [x] Buat service & controller `src/features/dashboard/dashboard.service.ts` & `dashboard.controller.ts`:
  - `GET /api/v1/admin/dashboard/metrics`:
    - Total janji hari ini, antrean menunggu, verifikasi tertunda, total pendapatan hari ini.
  - `GET /api/v1/admin/dashboard/stats`:
    - Agregasi data per periode (`day`, `month`, `year`) dan per dokter untuk visualisasi grafik Recharts di frontend.
- [x] Daftarkan route di `src/server.ts` pada `/api/v1/admin/dashboard`.

### Tahap 7: Pengujian Integrasi End-to-End (E2E) & Verifikasi Live Data
- [x] Verifikasi typecheck TypeScript (`tsc --noEmit` & `npm run build`) -> Build sukses 100% tanpa error.
- [x] Sinkronisasi Supabase URL dan Key dari frontend `.env` (`NEXT_PUBLIC_SUPABASE_URL` dan publishable key) ke backend `.env`.
- [x] Pembuatan dokumentasi API lengkap `API.md` yang memuat seluruh endpoint beserta contoh perintah `curl`.
- [x] Pengujian koneksi live dan verifikasi data terhadap database Supabase:
  - `POST /api/v1/auth/login` (Admin & Pasien) -> Berhasil mengembalikan JWT token dan objek profil.
  - `GET /api/v1/auth/me` -> Berhasil dengan Bearer token dan Cookie.
  - `GET /api/v1/doctors` -> Berhasil mengambil data 6 dokter estetika live dari Supabase.
  - `GET /api/v1/specialists` -> Berhasil mengambil data 5 spesialis live dari Supabase.
  - `GET /api/v1/appointments/availability` -> Berhasil memeriksa ketersediaan kuota jadwal praktik.
  - `GET /api/v1/queue/live` -> Berhasil mengembalikan sesi praktik aktif dan antrean ruang tunggu live.
  - `GET /api/v1/admin/dashboard/metrics` -> Berhasil mengembalikan metrik ringkasan klinik (200 OK).
  - `GET /api/v1/admin/dashboard/stats` -> Berhasil mengembalikan agregasi analitik per periode (200 OK).

---

## 5. Ringkasan Hasil Integrasi & Dokumentasi

1. **Database Bersama (Shared Database)**:
   Backend Express.js (`api-clinic-appointment`) kini terhubung langsung ke project Supabase yang sama dengan frontend Next.js (`https://wewieruvgvxupjndagnb.supabase.co`).
2. **Dokumentasi Lengkap `API.md`**:
   Seluruh contoh perintah `curl`, payload request, format header autentikasi (Bearer & Cookie), dan skema response telah didokumentasikan di [`API.md`](file:///Users/oktaviardi/Okta/api-clinic-appointment/API.md).
3. **Kompatibilitas Penuh Frontend**:
   Seluruh kebutuhan operasional hari H (check-in QR, antrean TV display, panggil nomor, no-show, dan statistik) telah terpasang dan siap dikonsumsi langsung oleh frontend.

## 5. Rencana Pembaruan Dokumentasi Aplikasi

Dokumen-dokumen di dalam aplikasi backend `api-clinic-appointment` akan diperbarui:
1. **`README.md`**: Menambahkan daftar endpoint baru (Check-in, Live Queue, Call Next, No-Show, Dashboard Metrics, Statistic Charts) dan panduan integrasi frontend.
2. **`AGENT.md`**: Menambahkan petunjuk operasional khusus untuk penanganan antrean fisik hari H vs approval, serta aturan skema basis data bersama.
3. **`TECH.md`**: Memperbarui ERD arsitektur gabungan dan mendokumentasikan algoritma check-in serta kalkulasi statistik dashboard.


# ARHE Clinic Appointment API

A robust, enterprise-grade RESTful API backend for managing clinic operations, medical specialist directories, doctor schedules, patient appointments, payment proof verification, and queue management.

Built with **Node.js**, **Express 5**, **TypeScript**, **Prisma ORM 7 (PostgreSQL)**, and **Supabase Storage**.

---

## 📑 Table of Contents

- [Overview & Architecture](#overview--architecture)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema & Models](#database-schema--models)
- [Appointment Lifecycle & Business Logic](#appointment-lifecycle--business-logic)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Environment Configuration](#1-environment-configuration)
  - [2. Installation](#2-installation)
  - [3. Database Setup (Initialization & Seeding)](#3-database-setup-initialization--seeding)
  - [4. Database Reset & Clear Workflow](#4-database-reset--clear-workflow)
  - [5. Running the Application](#5-running-the-application)
  - [6. Verification & Testing](#6-verification--testing)
  - [Demo Accounts](#demo-accounts)
- [API Reference](#api-reference)
  - [Authentication (`/api/v1/auth`)](#authentication-apiv1auth)
  - [Specialists (`/api/v1/specialists`)](#specialists-apiv1specialists)
  - [Doctors (`/api/v1/doctors`)](#doctors-apiv1doctors)
  - [Schedules (`/api/v1/schedules`)](#schedules-apiv1schedules)
  - [Patient Profile (`/api/v1/patients`)](#patient-profile-apiv1patients)
  - [Appointments - Patient (`/api/v1/appointments`)](#appointments---patient-apiv1appointments)
  - [Appointments - Admin (`/api/v1/admin/appointments`)](#appointments---admin-apiv1adminappointments)
  - [Live Queue & TV Display (`/api/v1/queue`)](#live-queue--tv-display-apiv1queue)
  - [Queue Operations - Admin (`/api/v1/admin/queue`)](#queue-operations---admin-apiv1adminqueue)
  - [Dashboard & Analytics - Admin (`/api/v1/admin/dashboard`)](#dashboard--analytics---admin-apiv1admindashboard)
- [Frontend Integration & Unified Database](#frontend-integration--unified-database)
- [Deployment](#deployment)
- [License](#license)

---

## 🏥 Overview & Architecture

ARHE Clinic Appointment API serves as the backend engine for a healthcare/aesthetic clinic platform. It coordinates multi-role access control (Patient, Admin, Staff, Doctor), automated daily practice sessions generated dynamically from weekly templates, quota reservation locks, transaction status synchronizations, and proof-of-payment verifications.

### Architectural Highlights
- **Layered Architecture**: Organized cleanly into `features/` (Controllers, Services, Routes, Helpers), `validators/` (Zod schemas), `middlewares/`, `configs/`, and `lib/` utilities.
- **Prisma ORM 7 with PostgreSQL Driver Adapter**: Utilizes `@prisma/adapter-pg` with native transactions (`$transaction`) and row locking (`pg_locks` / session locks) to guarantee atomic quota reservations and prevent race conditions.
- **Stateless & Serverless Ready**: Designed to seamlessly run on traditional server environments (`npm run dev` / `npm start`) as well as Vercel Serverless functions (`vercel.json` configured for `@vercel/node`).
- **Media Handling via Supabase Storage**: Uses Multer in-memory streaming with direct upload to Supabase bucket for doctor avatars and payment slips.

---

## ✨ Key Features

1. **Role-Based Access Control (RBAC)**
   - Roles: `PATIENT`, `ADMIN`, `STAFF`, `DOCTOR`.
   - Secure authentication with bcrypt password hashing and HTTP-Only JWT cookies.
2. **Specialists & Doctors Directory**
   - CRUD management for medical specialties.
   - Comprehensive doctor profiles with experience, consultation fee, biography, associated treatments, and photo uploads.
3. **Weekly Schedule Engine**
   - Weekly practice templates per doctor (`day_of_week`, `start_time`, `end_time`, `patient_quota`).
   - Built-in validation to prevent overlapping schedules for the same doctor.
4. **Dynamic Appointment Booking & Quota Locking**
   - Book appointments up to 14 days in advance.
   - Automatically provisions `practice_sessions` for the specific calendar date based on weekly schedules.
   - Holds patient quota during the payment window (default 30 minutes).
   - Automatic expiry synchronization for unfulfilled bookings.
5. **Payment Proof & Admin Verification Pipeline**
   - Patients upload payment receipts (JPG, PNG, WEBP max 2MB).
   - Status updates from `waiting_payment` to `waiting_confirmation`.
   - Admin review dashboard:
     - **Approve**: Assigns queue number (`queue_number`) and unique QR code token (`qr_token`), moving status to `done`.
     - **Reject**: Rejects payment proof with reason and immediately releases quota back to the pool.
6. **Patient Reviews & Ratings**
   - Completed consultations can be rated (1-5 stars) and reviewed by patients.
   - Aggregated ratings and latest reviews displayed on doctor profiles.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Runtime & Language** | [Node.js](https://nodejs.org/), [TypeScript 5](https://www.typescriptlang.org/) |
| **Framework** | [Express 5](https://expressjs.com/) |
| **Database & ORM** | [PostgreSQL](https://www.postgresql.org/), [Prisma ORM 7](https://www.prisma.io/) (`@prisma/client`, `@prisma/adapter-pg`) |
| **Cloud Storage** | [Supabase Storage](https://supabase.com/storage) (`@supabase/supabase-js`) |
| **Validation** | [Zod 4](https://zod.dev/) |
| **Authentication & Security** | `jsonwebtoken`, `bcrypt` / `bcryptjs`, `cookie-parser`, `cors` |
| **File Handling** | [Multer](https://github.com/expressjs/multer) (Memory Storage) |
| **Date & Time Utilities** | `date-fns` |
| **Deployment** | Vercel Serverless (`@vercel/node`) / Node.js Engine |

---

## 📁 Project Structure

```text
api-clinic-appointment/
├── prisma/
│   ├── migrations/              # Database migration history
│   └── schema.prisma            # Prisma schema models & enums
├── src/
│   ├── application/
│   │   └── app.ts               # Vercel entrypoint / app export
│   ├── configs/
│   │   ├── cors.config.ts       # CORS origin configurations
│   │   └── prisma-client.config.ts # Prisma client initialization with pg adapter
│   ├── errors/
│   │   └── app.error.ts         # Custom operational AppError
│   ├── features/
│   │   ├── appointment/         # Booking, availability, payments, queueing
│   │   │   ├── appointment.controller.ts
│   │   │   ├── appointment.service.ts
│   │   │   ├── appointment-admin.controller.ts
│   │   │   ├── appointment-admin.service.ts
│   │   │   ├── appointment.route.ts
│   │   │   ├── appointment-admin.route.ts
│   │   │   ├── appointment.constants.ts
│   │   │   └── appointment.helpers.ts
│   │   ├── auths/               # Registration, login, profile, logout
│   │   ├── doctor/              # Doctor profiles, avatars, directory
│   │   ├── patient/             # Patient profiles & update logic
│   │   ├── schedule/            # Doctor recurring schedule definitions
│   │   └── specialist/          # Specialty categories
│   ├── lib/
│   │   ├── bcrypt.lib.ts        # Password hashing & comparison
│   │   ├── jwt.lib.ts           # Token sign & verification
│   │   ├── supabase.lib.ts      # Supabase file storage upload helper
│   │   └── time.lib.ts          # Date/time formatting & WIB offset helpers
│   ├── middlewares/
│   │   ├── auth.middleware.ts   # JWT & role verification
│   │   ├── error.middleware.ts  # Central error handler
│   │   └── upload.middleware.ts # Multer memory upload middleware
│   ├── scripts/
│   │   ├── seed-admin.ts        # Initial admin seeding script
│   │   └── seed-treatments.ts   # Clinic treatments catalog seeder
│   ├── validators/              # Zod validation schemas
│   └── server.ts                # Express app configuration & local listener
├── example.env                  # Environment variables template
├── package.json                 # Dependencies & scripts
├── prisma7.config.ts            # Prisma 7 config definition
├── tsconfig.json                # TypeScript compiler config
└── vercel.json                  # Vercel serverless routing configuration
```

---

## 🗄 Database Schema & Models

The PostgreSQL database managed by Prisma and Supabase contains the following core tables, custom types, and Row-Level Security (RLS) policies:

## Table `profiles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `role` | `user_role` |  |
| `full_name` | `text` |  |
| `phone_number` | `text` | Nullable |
| `avatar_url` | `text` | Nullable |
| `date_of_birth` | `date` | Nullable |
| `gender` | `gender` | Nullable |
| `address` | `text` | Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `specialists`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `name` | `text` | Unique |
| `description` | `text` | Nullable |
| `is_active` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `doctors`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `specialist_id` | `uuid` | Nullable |
| `full_name` | `text` |  |
| `bio` | `text` | Nullable |
| `experience_years` | `int4` |  |
| `consultation_fee` | `numeric` |  |
| `photo_url` | `text` | Nullable |
| `is_active` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `doctor_schedules`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `doctor_id` | `uuid` |  |
| `day_of_week` | `int2` |  |
| `start_time` | `time` |  |
| `end_time` | `time` |  |
| `patient_quota` | `int4` |  |
| `is_active` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `practice_sessions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `doctor_id` | `uuid` |  |
| `schedule_id` | `uuid` | Nullable |
| `session_date` | `date` |  |
| `start_time` | `time` |  |
| `end_time` | `time` |  |
| `starts_at` | `timestamptz` |  |
| `ends_at` | `timestamptz` |  |
| `patient_quota` | `int4` |  |
| `current_queue_number` | `int4` |  |
| `created_at` | `timestamptz` |  |

## Table `appointments`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `code` | `text` | Unique |
| `patient_id` | `uuid` |  |
| `doctor_id` | `uuid` |  |
| `session_id` | `uuid` |  |
| `status` | `transaction_status` |  |
| `consultation_fee` | `numeric` |  |
| `payment_deadline` | `timestamptz` |  |
| `payment_proof_path` | `text` | Nullable |
| `payment_uploaded_at` | `timestamptz` | Nullable |
| `rejection_reason` | `text` | Nullable |
| `confirmed_at` | `timestamptz` | Nullable |
| `booking_number` | `int4` | Nullable |
| `qr_token` | `uuid` | Nullable Unique |
| `checked_in_at` | `timestamptz` | Nullable |
| `queue_number` | `int4` | Nullable |
| `is_no_show` | `bool` |  |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |

## Table `ratings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `appointment_id` | `uuid` | Unique |
| `patient_id` | `uuid` |  |
| `doctor_id` | `uuid` |  |
| `rating` | `int2` |  |
| `review` | `text` | Nullable |
| `created_at` | `timestamptz` |  |

## Custom Types / Enums

### `user_role`
`patient` | `admin`

### `gender`
`male` | `female` | `other`

### `transaction_status`
`waiting_payment` | `waiting_confirmation` | `done` | `rejected` | `expired` | `canceled`

## RLS Policies

### `profiles`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `profiles: baca milik sendiri atau admin` | SELECT | authenticated | PERMISSIVE | `((id = auth.uid()) OR is_admin())` | — |
| `profiles: ubah milik sendiri atau admin` | UPDATE | authenticated | PERMISSIVE | `((id = auth.uid()) OR is_admin())` | `((id = auth.uid()) OR is_admin())` |

### `specialists`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `specialists: publik baca` | SELECT | anon, authenticated | PERMISSIVE | `true` | — |
| `specialists: admin kelola` | ALL | authenticated | PERMISSIVE | `is_admin()` | `is_admin()` |

### `doctors`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `doctors: publik baca` | SELECT | anon, authenticated | PERMISSIVE | `true` | — |
| `doctors: admin kelola` | ALL | authenticated | PERMISSIVE | `is_admin()` | `is_admin()` |

### `doctor_schedules`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `schedules: publik baca` | SELECT | anon, authenticated | PERMISSIVE | `true` | — |
| `schedules: admin kelola` | ALL | authenticated | PERMISSIVE | `is_admin()` | `is_admin()` |

### `practice_sessions`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `sessions: publik baca` | SELECT | anon, authenticated | PERMISSIVE | `true` | — |

### `appointments`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `appointments: baca milik sendiri atau admin` | SELECT | authenticated | PERMISSIVE | `((patient_id = auth.uid()) OR is_admin())` | — |

### `ratings`

| Policy | Command | Roles | Action | USING | WITH CHECK |
|--------|---------|-------|--------|-------|------------|
| `ratings: publik baca` | SELECT | anon, authenticated | PERMISSIVE | `true` | — |

### Transaction Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> waiting_payment: Patient Books Appointment (Quota Held 30m)
    waiting_payment --> expired: > 30 mins elapsed without payment
    waiting_payment --> canceled: Canceled by Patient
    waiting_payment --> waiting_confirmation: Patient Uploads Payment Proof
    waiting_confirmation --> done: Admin Approves (Queue & QR Assigned)
    waiting_confirmation --> rejected: Admin Rejects (Reason Provided)
    waiting_confirmation --> canceled: Canceled by Patient (Before Session)
    done --> canceled: Canceled by Patient (Before Session)
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory by copying `example.env`:

```bash
cp example.env .env
```

| Variable | Description | Example / Default |
|---|---|---|
| `NODE_ENV` | Application environment (`DEVELOPMENT` or `PRODUCTION`) | `DEVELOPMENT` |
| `PORT` | HTTP server port | `8000` |
| `API_PREFIX` | Prefix for all API endpoints | `/api/v1` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins or `*` | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL connection string (Prisma pooled URL) | `postgresql://user:pass@host:5432/postgres` |
| `DIRECT_URL` | Direct connection string for DDL migrations & scripts | `postgresql://user:pass@host:5432/postgres` |
| `JWT_SECRET_KEY` | Secret string for signing JWT tokens | `openssl rand -hex 32` |
| `SUPABASE_URL` | Supabase project URL | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only) | `eyJhbGciOi...` |
| `SUPABASE_ANON_KEY` | Supabase anon/publishable key | `eyJhbGciOi...` |
| `SUPABASE_BUCKET_DOCTOR_PHOTOS` | Public storage bucket for doctor avatars | `doctor-photos` |
| `SUPABASE_BUCKET_PAYMENT_PROOFS` | Storage bucket for payment receipts | `payment-proofs` |
| `ADMIN_EMAIL` | Default admin email for seeding | `admin@klinik.test` |
| `ADMIN_PASSWORD` | Default admin password (min 8 chars) | `Admin123!` |
| `ADMIN_FULL_NAME` | Default admin display name | `Admin Utama Klinik Estetika` |
| `ADMIN_PHONE` | Default admin phone number | `081234567890` |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18 or higher (v20+ recommended)
- **PostgreSQL** database (Local instance via Docker/Postgres or Supabase Cloud)
- **Supabase Project** (Storage bucket & shared authentication database)

---

### 1. Environment Configuration
Duplicate `example.env` into `.env`:

```bash
cp example.env .env
```

Ensure the values in `.env` match your Supabase project (selaras dengan yang digunakan oleh frontend `clinic-appointment-platform`):

```env
# ---------- Application ----------
NODE_ENV=DEVELOPMENT
PORT=8000
API_PREFIX=/api/v1
ALLOWED_ORIGINS=http://localhost:3000

# ---------- Database (PostgreSQL / Supabase) ----------
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/postgres"

# ---------- Auth ----------
JWT_SECRET_KEY=94c502da5df3890f666f358ad7d9ba66723b7b4a20b0ddf5170d47aa28f747eb

# ---------- Supabase Project & Storage ----------
SUPABASE_URL=https://wewieruvgvxupjndagnb.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_publishable_zdn0kiwPWaQXJciMAhVjFg_VbsdN6Eg
SUPABASE_ANON_KEY=sb_publishable_zdn0kiwPWaQXJciMAhVjFg_VbsdN6Eg
SUPABASE_BUCKET_DOCTOR_PHOTOS=doctor-photos
SUPABASE_BUCKET_PAYMENT_PROOFS=payment-proofs
```

---

### 2. Installation
Install all required Node.js package dependencies:

```bash
npm install
```

---

### 3. Database Setup (Initialization & Seeding)

Jika Anda menghubungkan database baru atau memulai dari awal (*fresh install*), Anda dapat memilih salah satu dari **2 metode** berikut:

---

#### 🟢 Cara 1: Manual Copy-Paste via SQL Editor (Supabase Cloud / DBeaver / pgAdmin)
> **Paling direkomendasikan** jika Anda menggunakan Supabase Cloud atau tidak menyalakan Docker/PostgreSQL lokal di laptop Anda:

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) → Pilih project Anda → Buka menu **SQL Editor** (ikon `>_` di panel kiri) → Klik **New Query**.
2. **Inisialisasi Skema & Data Awal**:
   - Buka file [`prisma/init-database.sql`](prisma/init-database.sql) di VS Code.
   - Salin seluruh isinya (`Cmd+A` / `Ctrl+A` lalu `Cmd+C` / `Ctrl+C`).
   - Tempel (*paste*) ke Supabase SQL Editor dan klik **Run** (atau `Cmd+Enter`).
3. **Kompilasi Prisma Client** di terminal backend:
   ```bash
   npx prisma generate
   ```

---

#### 🔵 Cara 2: Otomatis via Terminal (NPM Scripts)
> Digunakan jika database lokal Docker atau connection string di `.env` sudah terhubung aktif:

1. **Inisialisasi Skema Database (`db:init`)**:
   ```bash
   npm run db:init
   ```
   *Script ini mengeksekusi [`prisma/init-database.sql`](prisma/init-database.sql) secara otomatis via Node.js.*

2. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

3. **Inisialisasi Data Awal & Dummy (`db:seed`)**:
   ```bash
   npm run db:seed
   # atau: npm run seed
   ```

---

### 4. Database Reset & Clear Workflow

Jika Anda ingin mengosongkan database atau me-reset siklus pengujian dari awal:

#### 4.1 Mengosongkan Database (`db:clear` / `clear.sql`)

Pilih salah satu cara berikut untuk mengosongkan seluruh tabel relasional:

- **Cara Manual (Copy-Paste SQL Editor)**:
  Buka file [`prisma/clear.sql`](prisma/clear.sql), salin seluruh isinya, lalu *paste* & *Run* di Supabase SQL Editor.
- **Cara Terminal (NPM Scripts)**:
  ```bash
  npm run db:clear
  # atau: npm run clear
  ```

> Script pembersih ini menjalankan perintah `TRUNCATE TABLE ... CASCADE` yang mengosongkan tabel janji temu, antrean, sesi praktik, dokter, dan user demo secara aman tanpa merusak struktur skema tabel.

---

#### 4.2 Apa yang Harus Dilakukan Setelah Menjalankan Clear?

Setelah database dibersihkan, pilih salah satu alur sesuai kebutuhan Anda:

- **Alur A: Isi Kembali dengan Full Dummy Dataset (Recommended untuk Dev & Testing)**  
  Jika Anda ingin langsung melanjutkan pengujian antrean, verifikasi pembayaran admin, dan riwayat pasien:
  - **Manual via SQL Editor**: Buka file [`prisma/seed.sql`](prisma/seed.sql), salin seluruh isinya, lalu *paste* & *Run* di Supabase SQL Editor.
  - **Atau via Terminal**:
    ```bash
    npm run db:seed
    # atau: npm run seed
    ```
  *Ini akan mengisi ulang seluruh data master dan akun demo (`admin@klinik.test` & `pasien@klinik.test`).*

- **Alur B: Database Bersih / Clean Operational Setup (Tanpa Transaksi Dummy)**  
  Jika Anda ingin mulai dari kondisi bersih (hanya akun admin dan master katalog treatments, tanpa dokter dan tanpa janji temu dummy):
  ```bash
  # 1. Buat akun Admin pertama berdasarkan variabel .env
  npm run seed:admin

  # 2. Isi data master katalog layanan perawatan (14 treatments resmi)
  npm run seed:treatments
  ```
  *Setelah itu, login sebagai admin untuk mendaftarkan dokter, spesialis, dan jadwal praktik secara manual via antarmuka dashboard admin.*

---

### 5. Running the Application

Anda dapat menjalankan backend ini dalam dua mode:

#### Option A: Development Mode (Hot-Reload)
Menggunakan `nodemon` dan `ts-node` untuk restart otomatis saat file kode berubah:

```bash
npm run dev
```

#### Option B: Production Mode (Compiled JS)
Mengkompilasi TypeScript ke folder `dist/` dan menjalankannya dengan Node runtime murni:

```bash
# 1. Compile TypeScript ke JavaScript
npm run build

# 2. Jalankan server production
npm start
```

Setelah server aktif, Anda akan melihat log:
```text
Application Running on PORT: 8000
```
Base API siap diakses pada: `http://localhost:8000/api/v1`.

---

### 6. Verification & Testing

Untuk memastikan server berjalan dan dapat berkomunikasi dengan database:

```bash
# 1. Cek direktori dokter (publik)
curl -s http://localhost:8000/api/v1/doctors

# 2. Cek monitor antrean live TV (publik)
curl -s http://localhost:8000/api/v1/queue/live

# 3. Test login admin
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@klinik.test","password":"Admin123!"}'
```

---

### 👥 Demo Accounts

Database bersama telah dilengkapi dengan akun demo siap pakai:

| Role | Email | Password | Akses & Wewenang |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@klinik.test` | `Admin123!` | Akses admin klinik, verifikasi bukti bayar, QR check-in hari H, panggil antrean (*call next*), dashboard statistik |
| **PATIENT** | `pasien@klinik.test` | `Pasien123!` | Akses pasien, booking jadwal konsultasi, upload struk pembayaran, melihat antrean aktif & ulasan |

> 📖 **Koleksi cURL Lengkap**:  
> Seluruh endpoint REST API Express telah didokumentasikan secara rinci beserta contoh cURL di file [`API.md`](API.md).

---

## 📡 API Reference

All successful responses follow the standard JSON format:
```json
{
  "success": true,
  "message": "Human readable message",
  "data": {}
}
```

Standard error response:
```json
{
  "success": false,
  "message": "Error details",
  "data": {}
}
```

---

### Authentication (`/api/v1/auth`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/register` | Public | Register a new `PATIENT` account |
| `POST` | `/admins` | Admin Only | Register a new `ADMIN` account |
| `POST` | `/login` | Public | Login with email & password (sets HTTP-Only cookie) |
| `GET` | `/me` | Authenticated | Retrieve authenticated user profile |
| `POST` | `/logout` | Authenticated | Clear session cookie |

#### `POST /api/v1/auth/register` Request Body:
```json
{
  "email": "patient@example.com",
  "password": "Password123!",
  "full_name": "Jane Doe",
  "phone_number": "081298765432"
}
```

---

### Specialists (`/api/v1/specialists`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | Public | List specialists (supports `?page=1&limit=10&search=&is_active=true`) |
| `GET` | `/:id` | Public | Get specialist details |
| `POST` | `/` | Admin | Create a new specialist |
| `PATCH` | `/:id` | Admin | Update specialist name, description, active status |
| `DELETE`| `/:id` | Admin | Delete specialist |

---

### Doctors (`/api/v1/doctors`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | Public | List doctors (filters: `specialist_id`, `search`, `order_by`, `page`, `limit`) |
| `GET` | `/:id` | Public | Get doctor detail with active schedules, treatments, ratings |
| `POST` | `/` | Admin | Create a new doctor (creates user + doctor profile) |
| `POST` | `/photo` | Admin | Upload doctor avatar (`multipart/form-data`, key: `photo`) |
| `PATCH` | `/:id` | Admin | Update doctor profile |
| `DELETE`| `/:id` | Admin | Soft-deactivate/delete doctor |

#### Sort Options for `GET /api/v1/doctors?order_by=`:
- `newest`: Recently joined doctors (default)
- `fee_asc`: Lowest consultation fee first
- `fee_desc`: Highest consultation fee first
- `experience_desc`: Most experienced doctors first

---

### Schedules (`/api/v1/schedules`)

Manages weekly recurring practice hours for doctors.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | Public | List schedules (`?doctor_id=...&day_of_week=...`) |
| `POST` | `/` | Admin | Create weekly schedule slot (with overlap collision prevention) |
| `PATCH` | `/:id` | Admin | Update schedule slot hours/quota |
| `DELETE`| `/:id` | Admin | Delete schedule slot |

#### Schedule Body Example:
```json
{
  "doctor_id": "uuid-doctor-id",
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "12:00",
  "patient_quota": 10,
  "is_active": true
}
```
*Note: `day_of_week` follows: `0` = Sunday, `1` = Monday, ..., `6` = Saturday.*

---

### Patient Profile (`/api/v1/patients`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/me` | Patient | Get patient personal profile & medical details |
| `PATCH` | `/me` | Patient | Update personal details (`full_name`, `email`, `phone_number`, `date_of_birth`, `gender`, `address`) |

---

### Appointments - Patient (`/api/v1/appointments`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/availability` | Public | Check doctor schedule & remaining quota (`?doctor_id=...&date=YYYY-MM-DD`) |
| `POST` | `/` | Patient | Book appointment (holds quota for 30 min) |
| `GET` | `/me` | Patient | List patient's appointments (`?status=...&page=1&limit=10`) |
| `GET` | `/:id` | Patient | Get appointment details |
| `POST` | `/:id/payment-proof` | Patient | Upload payment slip (`multipart/form-data`, key: `image`) |
| `PATCH` | `/:id/cancel` | Patient | Cancel appointment (releases quota) |
| `POST` | `/:id/rating` | Patient | Rate doctor after appointment is `done` |

#### `POST /api/v1/appointments` Request Body:
```json
{
  "doctor_id": "uuid-doctor-id",
  "schedule_date": "2026-11-10",
  "start_time": "09:00",
  "treatment_id": "uuid-treatment-id",
  "patient_membership_id": null
}
```

---

### Appointments - Admin (`/api/v1/admin/appointments`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | Admin | List all clinic appointments (`?status=...&page=1&limit=10`) |
| `GET` | `/:id` | Admin | Detailed view of appointment, patient profile, and payment slip |
| `PATCH` | `/:id/approve` | Admin | Approve payment proof: allocates queue number & QR code token |
| `PATCH` | `/:id/reject` | Admin | Reject payment proof with reason; immediately frees up quota |

#### `PATCH /api/v1/admin/appointments/:id/reject` Request Body:
```json
{
  "reason": "Proof of payment unreadable / incorrect transfer amount."
}
```

---

### Live Queue & TV Display (`/api/v1/queue`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/live` | Public | Live stream/poll for waiting room TV display with current serving and next 3 patients |

---

### Queue Operations - Admin (`/api/v1/admin/queue`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/check-in` | Admin | Safe idempotent on-site check-in with QR scan or appointment code (issues sequential arrival queue number) |
| `PATCH` | `/call-next` | Admin | Advance current serving queue number to next waiting patient |
| `PATCH` | `/no-show/:id` | Admin | Mark unarrived patient appointment as no-show |

---

### Dashboard & Analytics - Admin (`/api/v1/admin/dashboard`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/metrics` | Admin | Real-time overview metrics: today's appointments, waiting queue, pending verification, and estimated revenue |
| `GET` | `/stats` | Admin | Time-series charting data (`?period=day|month|year&from=...&to=...&doctor_id=...`) for Recharts visualizer |

---

## 🔗 Frontend Integration & Unified Database

Backend Express API ini terintegrasi penuh dan berbagi basis data PostgreSQL yang sama dengan frontend Next.js 16 (`clinic-appointment-platform`).

- **Unified PostgreSQL Schema**: Mengakses tabel `profiles`, `doctors`, `practice_sessions`, `appointments`, dan `ratings`.
- **Media Upload Multi-Channel**: Mendukung upload bukti transfer via file multipart maupun payload Base64 Data URL.
- **Full cURL Documentation**: Lihat [`API.md`](API.md) untuk panduan pengujian dan integrasi endpoint.
- **Rencana Teknis**: Lihat [`plans/01-plan-frontend-integration-20261104.md`](plans/01-plan-frontend-integration-20261104.md) untuk ringkasan migrasi dan harmonisasi.

---

## 🚢 Deployment

### Deploying to Vercel
The repository includes a preconfigured `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/application/app.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/application/app.ts"
    }
  ]
}
```

1. Push your repository to GitHub / GitLab.
2. Import project on [Vercel](https://vercel.com).
3. Set the Environment Variables in the Vercel Project Settings (ensure `NODE_ENV=PRODUCTION`).
4. Set build command to `npm run build` or leave default.
5. Deploy.

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).


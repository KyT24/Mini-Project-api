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
  - [Installation](#installation)
  - [Database Setup & Migrations](#database-setup--migrations)
  - [Data Seeding](#data-seeding)
  - [Running the App](#running-the-app)
- [API Reference](#api-reference)
  - [Authentication (`/api/v1/auth`)](#authentication-apiv1auth)
  - [Specialists (`/api/v1/specialists`)](#specialists-apiv1specialists)
  - [Doctors (`/api/v1/doctors`)](#doctors-apiv1doctors)
  - [Schedules (`/api/v1/schedules`)](#schedules-apiv1schedules)
  - [Patient Profile (`/api/v1/patients`)](#patient-profile-apiv1patients)
  - [Appointments - Patient (`/api/v1/appointments`)](#appointments---patient-apiv1appointments)
  - [Appointments - Admin (`/api/v1/admin/appointments`)](#appointments---admin-apiv1adminappointments)
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

The PostgreSQL database managed by Prisma contains the following core entities:

- **`user`**: Base account credentials, role (`PATIENT`, `ADMIN`, `STAFF`, `DOCTOR`), status, and profile picture.
- **`patient_profiles`**: Additional metadata (date of birth, gender, address) linked to a `user`.
- **`doctors`**: Doctor biographical data, experience, consultation fee, avatar, and relation to `specialists`.
- **`specialists`**: Medical branches (e.g., Dermatologist, General Practitioner).
- **`doctor_schedules`**: Weekly recurring slots per doctor with quota per session.
- **`practice_sessions`**: Concrete date instances generated when a booking occurs for a scheduled date.
- **`treatments`**: Procedures/services offered (e.g., Acne Dermapeel, Laser CO2, Glow Peeling).
- **`appointments`**: Central booking records tracking fees, discounts, queue number, QR token, and status.
- **`payment_proofs`**: Payment slip image URLs, verification status (`pending`, `approved`, `rejected`), rejection reasons, and reviewer tracking.
- **`ratings`**: Star ratings (1-5) and written feedback for doctors.
- **`membership_plans` & `patient_memberships`**: Membership discounting engine.

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
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL connection string (Prisma pooled URL) | `postgresql://user:pass@host:5432/postgres` |
| `DIRECT_URL` | Direct connection string for Prisma migrations | `postgresql://user:pass@host:5432/postgres` |
| `JWT_SECRET_KEY` | Secret string for signing JWT tokens | `openssl rand -hex 32` |
| `SUPABASE_URL` | Supabase project URL | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only) | `eyJhbGciOi...` |
| `SUPABASE_BUCKET` | Public storage bucket name | `payment-proofs` |
| `ADMIN_EMAIL` | Default admin email for seeding | `admin@klinik.com` |
| `ADMIN_PASSWORD` | Default admin password (min 8 chars) | `SuperSecretPassword123` |
| `ADMIN_FULL_NAME` | Default admin display name | `Admin Klinik` |
| `ADMIN_PHONE` | Default admin phone number | `081234567890` |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18 or higher (v20+ recommended)
- **PostgreSQL** database (Local or Supabase)
- **Supabase Account** (for Storage bucket access)

### Installation
Clone the repository and install dependencies:

```bash
npm install
```

### Database Setup & Migrations
Ensure `DATABASE_URL` in your `.env` points to your PostgreSQL instance, then run:

```bash
# Generate Prisma Client
npx prisma generate

# Apply migrations
npx prisma migrate deploy
# Or for local development:
# npx prisma migrate dev
```

### Data Seeding
Populate the database with initial clinic data:

```bash
# 1. Seed initial administrator
npm run seed:admin

# 2. Seed treatments catalog
npm run seed:treatments
```

### Running the App

```bash
# Development mode (nodemon + ts-node)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production build
npm start
```

The server will be accessible at `http://localhost:8000/api/v1`.

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


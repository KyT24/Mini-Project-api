# Rencana Audit Cakupan API Frontend: Dashboard, Patient & Admin

> **File:** `/plans/04-plan-audit-frontend-api-coverage-20261104.md`  
> **Tanggal:** 2026-11-04  
> **Aplikasi Frontend Di-audit:** `/Users/oktaviardi/Okta/clinic-appointment-platform`  
> **Aplikasi Backend Target:** `/Users/oktaviardi/Okta/api-clinic-appointment`  
> **Status:** Siap Direview  

---

## 1. Ringkasan Eksekutif (Executive Summary)

Audit mendalam telah dilakukan terhadap seluruh file frontend di `/Users/oktaviardi/Okta/clinic-appointment-platform`, khususnya:
- Hook API TanStack Query: `src/hooks/api/use-admin-appointments.ts`, `use-appointments.ts`, `use-patient.ts`, `use-doctors.ts`, `use-schedules.ts`, `use-specialists.ts`, `use-auth.ts`.
- Komponen Antarmuka Pengguna:
  - **Dashboard**: `src/components/admin/dashboard/admin-dashboard.tsx`, `src/components/admin/statistic/admin-statistic.tsx`.
  - **Patient / User**: `src/components/user/booking/*`, `history/*`, `profile/*`, `doctor/*`, `landing-page/*`.
  - **Admin**: `src/components/admin/appointment/*`, `payment/*`, `queue/*`, `doctor/*`, `specialist/*`, `patient/*`.

**Hasil Audit:**
Secara arsitektur, **98% endpoint telah tercover dengan sempurna** dan terhubung ke Supabase. Namun audit berhasil menemukan **3 celah fungsional kecil (*functional gaps*)** yang perlu disempurnakan agar interaksi admin dan pasien berjalan 100% tanpa hambatan.

---

## 2. Matriks Audit Ketercakupan API (Coverage Matrix)

### A. Domain Dashboard Admin & Statistik

| Fitur Frontend | Komponen & Hook Frontend | Endpoint API Backend | Method | Status Cakupan |
|---|---|---|---|---|
| **Metrik Ringkasan Hari Ini** | `admin-dashboard.tsx`<br>`useGetAdminDashboardMetrics()` | `/api/v1/admin/dashboard/metrics` | `GET` | ✅ **TERCOVER** (Supabase Live) |
| **Layar Antrean Live TV** | `queue/page.tsx` & `admin-dashboard.tsx`<br>`useGetLiveQueue()` | `/api/v1/queue/live` | `GET` | ✅ **TERCOVER** (Supabase RPC `get_live_queue`) |
| **Grafik Statistik Recharts** | `admin-statistic.tsx`<br>`useGetAppointmentStats(period, from, to, doctor_id)` | `/api/v1/admin/dashboard/stats` | `GET` | ✅ **TERCOVER** (Supabase Filter & Agregasi) |
| **Daftar Dokter Filter Statistik** | `admin-statistic.tsx`<br>`useGetDoctors()` | `/api/v1/doctors` | `GET` | ✅ **TERCOVER** (Supabase Live) |

---

### B. Domain Pasien (Patient / User)

| Fitur Frontend | Komponen & Hook Frontend | Endpoint API Backend | Method | Status Cakupan |
|---|---|---|---|---|
| **Profil Pasien** | `profile-view.tsx`<br>`useGetPatientMe()` | `/api/v1/patients/me` | `GET` | ✅ **TERCOVER** (Supabase `profiles`) |
| **Ubah Profil Pasien** | `profile-section.tsx`<br>`useUpdatePatientMe()` | `/api/v1/patients/me` | `PATCH` | ✅ **TERCOVER** (Supabase `profiles`) |
| **Cek Ketersediaan Jadwal** | `booking-form.tsx`<br>`useGetAvailability(doctor_id, date)` | `/api/v1/appointments/availability` | `GET` | ✅ **TERCOVER** (Supabase RPC `get_availability`) |
| **Buat Reservasi Baru** | `booking-form.tsx`<br>`useCreateAppointment()` | `/api/v1/appointments` | `POST` | ✅ **TERCOVER** (Supabase `appointments`) |
| **Riwayat Janji Temu Pasien** | `appointment-list.tsx`<br>`useGetMyAppointments({ page, limit })` | `/api/v1/appointments/me` | `GET` | ✅ **TERCOVER** (Supabase `appointments`) |
| **Detail Janji Temu & Sisa Bayar** | `payment-summary.tsx`<br>`useGetAppointmentById(id)` | `/api/v1/appointments/:id` | `GET` | ✅ **TERCOVER** (Supabase `appointments`) |
| **Upload Bukti Bayar (File/Base64)** | `payment-proof-form.tsx`<br>`useUploadPaymentProof(id)` | `/api/v1/appointments/:id/payment-proof` | `POST` | ✅ **TERCOVER** (Supabase Storage & Path) |
| **Batalkan Reservasi** | `cancel-appointment-modal.tsx`<br>`useCancelAppointment(id)` | `/api/v1/appointments/:id/cancel` | `PATCH` | ✅ **TERCOVER** (Supabase status `canceled`) |
| **Rating & Ulasan Sesi** | `rating-form.tsx`<br>`useRateAppointment(id)` | `/api/v1/appointments/:id/rating` | `POST` | ✅ **TERCOVER** (Supabase `ratings`) |

---

### C. Domain Admin (Manajemen Operasional Klinik)

| Fitur Frontend | Komponen & Hook Frontend | Endpoint API Backend | Method | Status Cakupan |
|---|---|---|---|---|
| **Daftar Janji Temu & Filter** | `appointment-management.tsx`<br>`useGetAdminAppointments({ doctor_id, status, date, page, limit })` | `/api/v1/admin/appointments` | `GET` | ⚠️ **PERLU ENHANCEMENT** (Query validator belum mendukung `doctor_id` & `date`) |
| **Detail Janji Temu Admin** | `payment-review-modal.tsx`<br>`useGetAdminAppointmentById(id)` | `/api/v1/admin/appointments/:id` | `GET` | ✅ **TERCOVER** (Supabase `appointments`) |
| **Approve Pembayaran** | `payment-review-modal.tsx`<br>`useApproveAppointment(id)` | `/api/v1/admin/appointments/:id/approve` | `PATCH` | ✅ **TERCOVER** (Nomor antrean & QR UUID) |
| **Reject Pembayaran** | `payment-review-modal.tsx`<br>`useRejectAppointment(id)` | `/api/v1/admin/appointments/:id/reject` | `PATCH` | ✅ **TERCOVER** (Status `rejected` & Reason) |
| **Reschedule / Koreksi Admin** | `edit-appointment-modal.tsx`<br>`useAdminUpdateAppointment(payload)` | `/api/v1/admin/appointments/:id` | `PATCH` | ❌ **GAP DITEMUKAN** (Route `PATCH /:id` belum terpasang di router) |
| **Scan QR Check-In Hari H** | `queue-management.tsx`<br>`useCheckIn(qr_token)` | `/api/v1/admin/queue/check-in` | `POST` | ✅ **TERCOVER** (Supabase RPC `check_in`) |
| **Panggil Antrean Berikutnya** | `queue-management.tsx`<br>`useCallNext(session_id)` | `/api/v1/admin/queue/call-next` | `PATCH` | ✅ **TERCOVER** (Supabase RPC `call_next`) |
| **Tandai Pasien No-Show** | `queue-management.tsx`<br>`useMarkNoShow(appointment_id)` | `/api/v1/admin/queue/no-show/:id` | `PATCH` | ✅ **TERCOVER** (Supabase RPC `mark_no_show`) |
| **CRUD Spesialis Dokter** | `specialist-management.tsx`<br>`useGetSpecialists`, `useCreateSpecialist`, dst. | `/api/v1/specialists` | `CRUD` | ✅ **TERCOVER 100%** |
| **CRUD Profil & Jadwal Dokter** | `doctor-management.tsx`<br>`useGetDoctors`, `useCreateDoctor`, dst. | `/api/v1/doctors` | `CRUD` | ✅ **TERCOVER 100%** |
| **CRUD Template Jadwal Praktik** | `schedule-modal.tsx`<br>`useGetSchedules`, `useCreateSchedule`, dst. | `/api/v1/schedules` | `CRUD` | ✅ **TERCOVER 100%** |
| **Daftar Pasien Admin** | `patient-management.tsx`<br>Query `profiles` dengan relasi `appointments` | `/api/v1/admin/patients` | `GET` | 💡 **OPSIONAL** (Frontend saat ini langsung ke SDK Supabase) |

---

## 3. Rincian 3 Temuan Celah & Solusi Implementasi

### Celah 1: Route `PATCH /api/v1/admin/appointments/:id` (Koreksi / Reschedule Admin)
- **Masalah:** Di `use-admin-appointments.ts` (baris 378) dan `edit-appointment-modal.tsx`, jika admin mengubah jadwal atau dokter pasien, frontend memanggil `PATCH /admin/appointments/:id` dengan body `{ doctor_id, session_date, start_time, status, notes }`. Backend Express saat ini hanya memiliki `PATCH /:id/approve` dan `PATCH /:id/reject`, sehingga request edit akan mengembalikan `404 Not Found`.
- **Solusi:**
  1. Pasang route `adminAppointmentRouter.patch('/:id', ...adminOnly, AppointmentAdminController.updateAppointment)` di [`src/features/appointment/appointment-admin.route.ts`](file:///Users/oktaviardi/Okta/api-clinic-appointment/src/features/appointment/appointment-admin.route.ts).
  2. Implementasikan method `updateAppointment` yang memanfaatkan RPC Supabase `admin_update_appointment` (atau update langsung ke tabel Supabase `appointments` & `practice_sessions`).

---

### Celah 2: Filter `doctor_id` dan `date` pada `GET /api/v1/admin/appointments`
- **Masalah:** Di `appointment-management.tsx`, admin dapat memfilter janji temu berdasarkan dropdown Dokter (`doctor_id`) dan Tanggal Sesi (`date`). Namun skema validasi `getAdminAppointmentsSchema` di [`src/validators/appointment.validator.ts`](file:///Users/oktaviardi/Okta/api-clinic-appointment/src/validators/appointment.validator.ts) hanya menerima `status`, `page`, dan `limit`, sehingga parameter `doctor_id` dan `date` diabaikan/di-strip.
- **Solusi:**
  1. Tambahkan `doctor_id: z.string().uuid().optional()` dan `date: z.string().optional()` ke `getAdminAppointmentsSchema`.
  2. Terapkan filter `doctor_id` dan `date` pada query Supabase PostgREST dan Prisma fallback di `AppointmentAdminService.getAll`.

---

### Celah 3: Alias Route `/patients` vs `/patient`
- **Masalah:** Frontend menggunakan hook `use-patient.ts` dengan endpoint `/patients/me` (plural), sementara beberapa pemanggilan menggunakan singular `/patient/me`.
- **Solusi:**
  Di [`src/server.ts`](file:///Users/oktaviardi/Okta/api-clinic-appointment/src/server.ts), pasang kedua prefix:
  ```ts
  app.use(`${API_PREFIX}/patients`, patientRouter);
  app.use(`${API_PREFIX}/patient`, patientRouter);
  ```

---

## 4. Rencana Verifikasi & Uji Penutupan Gap

1. **Uji Kompilasi TypeScript**:
   `npm run build` (`prisma generate && tsc`) harus menghasilkan 0 error.
2. **Uji Fungsional Endpoint Admin Edit**:
   Uji simulasi panggilan `PATCH /api/v1/admin/appointments/:id` dan filter `GET /api/v1/admin/appointments?doctor_id=...&date=...`.
3. **Uji Live Supabase Data**:
   Memastikan data yang diperbarui oleh admin langsung terefleksi di database Supabase dan terbaca oleh frontend Next.js.


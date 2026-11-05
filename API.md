# Dokumentasi REST API - Aesthetic Clinic Appointment Platform

Dokumentasi resmi REST API Express.js untuk sistem janji temu klinik estetika, terintegrasi langsung dengan database PostgreSQL / Supabase yang digunakan bersama oleh aplikasi web Next.js dan backend API.

- **Base URL**: `http://localhost:8000/api/v1`
- **Default Port**: `8000`
- **Prefix API**: `/api/v1`
- **Format Payload**:
  - `application/json` (Default untuk hampir semua request)
  - `multipart/form-data` (Khusus upload file gambar / foto)
- **Autentikasi**:
  - **Bearer Token**: Header `Authorization: Bearer <TOKEN>`
  - **HTTP-Only Cookie**: `token=<TOKEN>` (Otomatis disertakan oleh browser / frontend)
- **Format Response Standar**:
  ```json
  {
    "success": true,
    "message": "Deskripsi pesan status",
    "data": {},
    "meta": {} // Opsional, ada pada endpoint yang memiliki pagination
  }
  ```

---

## 🔑 Akun Demo Pengujian

Gunakan akun berikut yang sudah disediakan di skema dan seed data:

| Role | Email | Password | Keterangan & Hak Akses |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@klinik.test` | `Admin123!` | Akses penuh: manajemen dokter/jadwal/spesialis, persetujuan pembayaran, check-in pasien di klinik, panggil antrean, dashboard analitik |
| **PATIENT 1** | `pasien1@klinik.test`<br>*(alias: `pasien@klinik.test`)* | `Pasien123!` | Akun Pasien 1 (Budi Demo): Buat janji temu dokter, upload bukti transfer, riwayat transaksi antrean |
| **PATIENT 2** | `pasien2@klinik.test`<br>*(alias: `siti@klinik.test`)* | `Pasien123!` | Akun Pasien 2 (Siti Rahayu): Buat janji temu dokter, upload bukti transfer, pengujian antrean multi-user |
| **PATIENT 3** | `pasien3@klinik.test`<br>*(alias: `ahmad@klinik.test`)* | `Pasien123!` | Akun Pasien 3 (Ahmad Fauzi): Buat janji temu dokter, upload bukti transfer, pengujian antrean multi-user |

---

## 📌 Nilai Konvensi & ENUM Sistem

1. **Hari Praktik (`day_of_week`)**:
   Mengikuti standar JavaScript `Date.getDay()` dan database PostgreSQL:
   - `0`: Minggu (Sunday)
   - `1`: Senin (Monday)
   - `2`: Selasa (Tuesday)
   - `3`: Rabu (Wednesday)
   - `4`: Kamis (Thursday)
   - `5`: Jumat (Friday)
   - `6`: Sabtu (Saturday)

2. **Status Janji Temu (`status`)**:
   - `waiting_payment`: Janji dibuat, menunggu pasien mengunggah bukti bayar.
   - `waiting_confirmation`: Bukti bayar telah diunggah pasien, menunggu konfirmasi admin.
   - `done`: Pembayaran diverifikasi oleh admin (siap check-in / konsultasi selesai).
   - `rejected`: Pembayaran ditolak oleh admin (misal nominal tidak sesuai).
   - `expired`: Janji kedaluwarsa karena tidak dibayar dalam batas waktu.
   - `canceled`: Dibatalkan oleh pasien.

3. **Status Check-in (`checkin_status`)**:
   - `waiting`: Menunggu pasien datang ke klinik untuk check-in.
   - `checked_in`: Pasien sudah check-in dan mengantongi nomor urut fisik.
   - `in_consultation`: Pasien sedang dipanggil / berkonsultasi di ruangan dokter.
   - `completed`: Sesi konsultasi selesai.
   - `no_show`: Pasien dipanggil berulang kali namun tidak hadir di klinik.

---

## 1. Autentikasi (`/auth`)

### 1.1 Login Pengguna
- **Method / Endpoint**: `POST /auth/login`
- **Akses**: Publik
- **Format Header**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "admin@klinik.test",
    "password": "Admin123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User logged in successfully",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa",
        "email": "admin@klinik.test",
        "full_name": "Admin Utama Klinik Estetika",
        "role": "ADMIN",
        "is_active": true
      }
    }
  }
  ```

### 1.2 Registrasi Pasien Baru
- **Method / Endpoint**: `POST /auth/register`
- **Akses**: Publik
- **Format Header**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "pasien.baru@example.com",
    "password": "Password123!",
    "full_name": "Dewi Sartika",
    "phone_number": "081298765432"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "99999999-9999-9999-9999-999999999999",
        "email": "pasien.baru@example.com",
        "full_name": "Dewi Sartika",
        "role": "PATIENT"
      }
    }
  }
  ```

### 1.3 Cek Profil Sesi Pengguna (`/auth/me`)
- **Method / Endpoint**: `GET /auth/me`
- **Akses**: Terautentikasi (Bearer Token atau Cookie)
- **Format Header**: `Authorization: Bearer <TOKEN>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User retrieved successfully",
    "data": {
      "id": "aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa",
      "email": "admin@klinik.test",
      "full_name": "Admin Utama Klinik Estetika",
      "role": "ADMIN",
      "is_active": true
    }
  }
  ```

### 1.4 Daftarkan Staf Admin Baru
- **Method / Endpoint**: `POST /auth/admins`
- **Akses**: Khusus ADMIN
- **Format Header**:
  - `Authorization: Bearer <ADMIN_TOKEN>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "staf.baru@klinik.test",
    "password": "StafPassword123!",
    "full_name": "Staf Operasional Klinik",
    "phone_number": "081211112222"
  }
  ```

### 1.5 Ubah Password Akun
Mengganti password akun pengguna (pasien maupun admin) dengan memvalidasi password saat ini.
- **Method / Endpoint**: `PATCH /auth/password` (alias: `PATCH /patients/me/password`)
- **Akses**: Terautentikasi (Bearer Token atau Cookie)
- **Format Header**:
  - `Authorization: Bearer <TOKEN>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "current_password": "PasswordLama123!",
    "new_password": "PasswordBaru123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Password berhasil diperbarui",
    "data": {}
  }
  ```

### 1.6 Logout
- **Method / Endpoint**: `POST /auth/logout`
- **Akses**: Terautentikasi
- **Keterangan**: Menghapus cookie `token` pada browser/klien.

---

## 2. Profil Pasien (`/patients` atau `/patient`)

Endpoint untuk membaca dan memperbarui data profil akun pasien yang sedang login.

### 2.1 Ambil Profil Pasien
- **Method / Endpoint**: `GET /patients/me` (alias: `GET /patient/me`)
- **Akses**: Terautentikasi
- **Format Header**: `Authorization: Bearer <TOKEN>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "patient profile retrieved successfully",
    "data": {
      "id": "bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb",
      "full_name": "Budi Pasien Demo",
      "email": "pasien@klinik.test",
      "phone_number": "081234567890",
      "date_of_birth": "1995-08-17",
      "gender": "male",
      "address": "Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan",
      "role": "PATIENT"
    }
  }
  ```

### 2.2 Update Profil Pasien
- **Method / Endpoint**: `PATCH /patients/me` (alias: `PATCH /patient/me`)
- **Akses**: Terautentikasi
- **Format Header**:
  - `Authorization: Bearer <TOKEN>`
  - `Content-Type: application/json`
- **Request Body** (Minimal 1 field dikirim; format `date_of_birth` adalah `YYYY-MM-DD` dan tidak boleh di masa depan; `gender`: `"male"`, `"female"`, `"other"`):
  ```json
  {
    "full_name": "Budi Pasien Demo, S.T.",
    "phone_number": "081234567899",
    "date_of_birth": "1995-08-17",
    "gender": "male",
    "address": "Jl. Senopati No. 45, Jakarta Selatan"
  }
  ```

---

## 3. Spesialisasi Dokter (`/specialists`)

### 3.1 Daftar Spesialis
- **Method / Endpoint**: `GET /specialists`
- **Akses**: Publik
- **Query Parameters**:
  - `page`: Nomor halaman (integer, default: `1`)
  - `limit`: Jumlah data per halaman (integer, max `100`, default: `10`)
  - `search`: Pencarian nama spesialisasi (string)
  - `is_active`: Filter status aktif (`true` atau `false`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "specialists retrieved successfully",
    "data": [
      {
        "id": "11111111-0000-0000-0000-000000000001",
        "name": "Dermatologi, Venereologi & Estetika (Sp.D.V.E)",
        "description": "Perawatan kulit klinis, jerawat, pigmentasi, penuaan dini, dan penyakit kulit.",
        "is_active": true
      }
    ],
    "meta": { "page": 1, "limit": 10, "total": 5, "total_pages": 1 }
  }
  ```

### 3.2 Detail Spesialis
- **Method / Endpoint**: `GET /specialists/:id`
- **Akses**: Publik

### 3.3 Tambah Spesialis Baru
- **Method / Endpoint**: `POST /specialists`
- **Akses**: Khusus ADMIN
- **Format Header**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "name": "Bedah Plastik & Rekonstruksi Estetika (Sp.B.P.R.E)",
    "description": "Tindakan bedah estetika kontur wajah, rhinoplasty, dan rekonstruksi.",
    "is_active": true
  }
  ```

### 3.4 Update Spesialis
- **Method / Endpoint**: `PATCH /specialists/:id`
- **Akses**: Khusus ADMIN
- **Request Body**:
  ```json
  {
    "name": "Dermatologi & Estetika Klinis",
    "description": "Spesialisasi kesehatan kulit wajah dan tubuh terpadu.",
    "is_active": true
  }
  ```

### 3.5 Hapus Spesialis
- **Method / Endpoint**: `DELETE /specialists/:id`
- **Akses**: Khusus ADMIN

---

## 4. Dokter Estetika (`/doctors`)

### 4.1 Daftar Dokter dengan Filter & Pencarian
- **Method / Endpoint**: `GET /doctors`
- **Akses**: Publik
- **Query Parameters**:
  - `search`: Pencarian nama dokter (string)
  - `specialist_id`: UUID spesialisasi
  - `day_of_week`: Filter hari praktik (`0` s/d `6`, dimana `0` = Minggu, `1` = Senin, ..., `6` = Sabtu)
  - `min_fee`: Biaya konsultasi minimum (number)
  - `max_fee`: Biaya konsultasi maksimum (number)
  - `is_active`: Filter status aktif (`true` atau `false`)
  - `sort`: Opsi pengurutan (`newest`, `fee_asc`, `fee_desc`, `experience_desc`, default: `newest`)
  - `page`: Nomor halaman (default: `1`)
  - `limit`: Jumlah per halaman (default: `10`, max `100`)

- **Contoh Request**:
  ```bash
  curl -X GET "http://localhost:8000/api/v1/doctors?page=1&limit=5&sort=experience_desc"
  ```

### 4.2 Detail Dokter
- **Method / Endpoint**: `GET /doctors/:id`
- **Akses**: Publik
- **Response (200 OK)**:
  Mengembalikan data dokter, profil spesialis, jadwal mingguan aktif, rating rata-rata, serta ulasan ulasan dari pasien.

### 4.3 Tambah Dokter Baru
- **Method / Endpoint**: `POST /doctors`
- **Akses**: Khusus ADMIN
- **Format Header**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "dr.nadia@klinik.test",
    "password": "DokterPassword123!",
    "full_name": "dr. Nadia Saphira, Sp.D.V.E",
    "phone_number": "081299887766",
    "specialist_id": "11111111-0000-0000-0000-000000000001",
    "consultation_fee": "350000.00",
    "experience_years": 8,
    "bio": "Fokus pada perawatan laser acne scars, anti-aging, dan peremajaan kulit modern.",
    "photo": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&auto=format&fit=crop&q=80",
    "is_active": true
  }
  ```

### 4.4 Upload Foto Profil Dokter
Mendukung 2 format request:

1. **Multipart Form-Data (File Gambar Asli)**:
   - **Header**: `Content-Type: multipart/form-data`
   - **Field name**: `photo` (Maksimal 2 MB; format: JPG, PNG, WEBP)
   ```bash
   curl -X POST http://localhost:8000/api/v1/doctors/photo \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -F "photo=@/path/ke/foto-dokter.jpg"
   ```

2. **JSON Base64 Payload**:
   - **Header**: `Content-Type: application/json`
   ```bash
   curl -X POST http://localhost:8000/api/v1/doctors/photo \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "photo_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
     }'
   ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "photo uploaded successfully",
    "data": {
      "photo_url": "https://...supabase.co/storage/v1/object/public/doctor-photos/doctor_1730000000.jpg"
    }
  }
  ```

### 4.5 Update Data Dokter
- **Method / Endpoint**: `PATCH /doctors/:id`
- **Akses**: Khusus ADMIN
- **Format Header**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "full_name": "dr. Nadia Saphira, Sp.D.V.E, M.Biomed",
    "consultation_fee": "375000.00",
    "experience_years": 9,
    "bio": "Spesialis estetika wajah dan laser rejuvenasi bersertifikasi.",
    "is_active": true
  }
  ```

### 4.6 Hapus Dokter
- **Method / Endpoint**: `DELETE /doctors/:id`
- **Akses**: Khusus ADMIN

---

## 5. Jadwal Praktik Dokter (`/schedules`)

### 5.1 Daftar Jadwal Dokter
- **Method / Endpoint**: `GET /schedules`
- **Akses**: Publik
- **Query Parameters**:
  - `doctor_id` (Wajib, UUID): ID dokter
  - `is_active` (Opsional, boolean): `true` atau `false`
- **Contoh Request**:
  ```bash
  curl -X GET "http://localhost:8000/api/v1/schedules?doctor_id=22222222-0000-0000-0000-000000000001&is_active=true"
  ```

### 5.2 Tambah Jadwal Praktik Baru
- **Method / Endpoint**: `POST /schedules`
- **Akses**: Khusus ADMIN
- **Format Header**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "doctor_id": "22222222-0000-0000-0000-000000000001",
    "day_of_week": 1,
    "start_time": "09:00",
    "end_time": "14:00",
    "patient_quota": 15,
    "is_active": true
  }
  ```
  *(Catatan: `day_of_week` `0` = Minggu, `1` = Senin, dst. Format waktu `HH:mm` atau `HH:mm:ss`).*

### 5.3 Update Jadwal Praktik
- **Method / Endpoint**: `PATCH /schedules/:id`
- **Akses**: Khusus ADMIN
- **Request Body**:
  ```json
  {
    "patient_quota": 20,
    "start_time": "09:00",
    "end_time": "15:00",
    "is_active": true
  }
  ```

### 5.4 Hapus Jadwal Praktik
- **Method / Endpoint**: `DELETE /schedules/:id`
- **Akses**: Khusus ADMIN

---

## 6. Janji Temu & Pemesanan (`/appointments`)

### 6.1 Cek Ketersediaan Kuota Slot Praktik
- **Method / Endpoint**: `GET /appointments/availability`
- **Akses**: Publik
- **Query Parameters**:
  - `doctor_id` (UUID): ID Dokter
  - `date` (`YYYY-MM-DD`): Tanggal rencana konsultasi
- **Contoh Request**:
  ```bash
  curl -X GET "http://localhost:8000/api/v1/appointments/availability?doctor_id=22222222-0000-0000-0000-000000000001&date=2026-11-06"
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "availability retrieved successfully",
    "data": [
      {
        "schedule_id": "33333333-0000-0000-0000-000000000001",
        "doctor_id": "22222222-0000-0000-0000-000000000001",
        "date": "2026-11-06",
        "day_of_week": 5,
        "start_time": "08:00",
        "end_time": "12:00",
        "quota": 15,
        "booked": 1,
        "remaining": 14,
        "is_available": true
      }
    ]
  }
  ```

### 6.2 Buat Janji Temu Baru (Booking)
- **Method / Endpoint**: `POST /appointments`
- **Akses**: Khusus PATIENT
- **Format Header**:
  - `Authorization: Bearer <PATIENT_TOKEN>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "doctor_id": "22222222-0000-0000-0000-000000000001",
    "session_date": "2026-11-06",
    "start_time": "08:00",
    "treatment_slug": "acne-dermapeel"
  }
  ```
  *(Catatan: `treatment_slug` bersifat opsional, default `acne-dermapeel`).*
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "appointment created successfully",
    "data": {
      "id": "55555555-5555-5555-5555-555555555555",
      "code": "APT-20261106-001",
      "status": "waiting_payment",
      "doctor_id": "22222222-0000-0000-0000-000000000001",
      "doctor_name": "dr. Maya Lestari, Sp.D.V.E, FINSDV",
      "specialist_name": "Dermatologi, Venereologi & Estetika (Sp.D.V.E)",
      "session_date": "2026-11-06",
      "start_time": "08:00",
      "consultation_fee": 300000,
      "treatment_name": "Acne Dermapeel Therapy"
    }
  }
  ```

### 6.3 Upload Bukti Pembayaran Konsultasi
- **Method / Endpoint**: `POST /appointments/:id/payment-proof`
- **Akses**: Khusus PATIENT (pemilik janji temu)
- **Metode 1: Multipart Form-Data (File Gambar Asli)**:
  - **Field name**: `image` (Maksimal 2 MB, JPG/PNG/WEBP)
  ```bash
  curl -X POST http://localhost:8000/api/v1/appointments/55555555-5555-5555-5555-555555555555/payment-proof \
    -H "Authorization: Bearer <PATIENT_TOKEN>" \
    -F "image=@/path/ke/struk-transfer.jpg"
  ```
- **Metode 2: JSON Payload (Base64 Data URI)**:
  - Mendukung properti `image_base64` atau `image`:
  ```bash
  curl -X POST http://localhost:8000/api/v1/appointments/55555555-5555-5555-5555-555555555555/payment-proof \
    -H "Authorization: Bearer <PATIENT_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{
      "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    }'
  ```
- **Response (200 OK)**:
  Status otomatis berpindah menjadi `waiting_confirmation` untuk diverifikasi oleh admin.

### 6.4 Riwayat Janji Temu Saya (Pasien)
- **Method / Endpoint**: `GET /appointments/my` (alias: `GET /appointments/me`)
- **Akses**: Khusus PATIENT
- **Query Parameters**:
  - `page`: Nomor halaman (default: `1`)
  - `limit`: Jumlah data (default: `10`, max: `50`)
- **Contoh Request**:
  ```bash
  curl -X GET "http://localhost:8000/api/v1/appointments/my?page=1&limit=10" \
    -H "Authorization: Bearer <PATIENT_TOKEN>"
  ```

### 6.5 Detail Janji Temu Pasien
- **Method / Endpoint**: `GET /appointments/:id`
- **Akses**: Khusus PATIENT (pemilik janji temu)

### 6.6 Batalkan Janji Temu
- **Method / Endpoint**: `PATCH /appointments/:id/cancel`
- **Akses**: Khusus PATIENT
- **Format Header**: `Authorization: Bearer <PATIENT_TOKEN>`
- **Contoh Request**:
  ```bash
  curl -X PATCH http://localhost:8000/api/v1/appointments/55555555-5555-5555-5555-555555555555/cancel \
    -H "Authorization: Bearer <PATIENT_TOKEN>"
  ```

### 6.7 Berikan Rating & Ulasan Dokter
- **Method / Endpoint**: `POST /appointments/:id/rating`
- **Akses**: Khusus PATIENT (Hanya dapat diulas jika janji temu berstatus `done`)
- **Format Header**:
  - `Authorization: Bearer <PATIENT_TOKEN>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "rating": 5,
    "review": "Penjelasan dr. Maya sangat jelas dan ramah, tindakan peeling tidak sakit dan kulit langsung glowing!"
  }
  ```

---

## 7. Display TV & Antrean Fisik Hari H (`/queue` & `/admin/queue`)

### 7.1 Monitor TV Antrean Live (Publik)
Endpoint publik yang dipanggil secara periodik (polling) oleh layar TV monitor ruang tunggu klinik.
- **Method / Endpoint**: `GET /queue/live`
- **Akses**: Publik
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Antrean langsung berhasil dimuat",
    "data": [
      {
        "session_id": "44444444-0000-0000-0000-000000000001",
        "doctor_id": "22222222-0000-0000-0000-000000000001",
        "doctor_name": "dr. Maya Lestari, Sp.D.V.E, FINSDV",
        "specialist_name": "Dermatologi, Venereologi & Estetika (Sp.D.V.E)",
        "start_time": "08:00",
        "end_time": "23:00",
        "current_queue_number": 2,
        "next_numbers": [3, 4]
      }
    ]
  }
  ```

### 7.2 Check-in Pasien di Meja Resepsionis / QR Scan
Menerima scan barcode atau QR code kartu janji temu saat pasien tiba di klinik hari H. Menghasilkan nomor urut antrean fisik harian secara aman dan idempotensial.
- **Method / Endpoint**: `POST /admin/queue/check-in`
- **Akses**: ADMIN atau STAFF
- **Format Header**:
  - `Authorization: Bearer <ADMIN_TOKEN>`
  - `Content-Type: application/json`
- **Request Body**:
  - Format yang diterima untuk `qr_token`:
    1. Kode booking janji temu: `"APT-20261105-001"`
    2. UUID appointment: `"55555555-5555-5555-5555-555555555555"`
    3. Format gabungan: `"APT-20261105-001:55555555-5555-5555-5555-555555555555"`
  ```json
  {
    "qr_token": "APT-20261105-001"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Check-in berhasil",
    "data": {
      "appointment_id": "55555555-5555-5555-5555-555555555555",
      "queue_number": 3,
      "doctor_name": "dr. Maya Lestari, Sp.D.V.E, FINSDV",
      "session_time": "08:00 - 23:00"
    }
  }
  ```

### 7.3 Panggil Antrean Berikutnya (Call Next)
Memanggil nomor urut pasien berikutnya pada sesi praktik dokter yang aktif. Mengupdate `current_queue_number` dan memicu audio chime suara pada monitor TV.
- **Method / Endpoint**: `PATCH /admin/queue/call-next`
- **Akses**: ADMIN atau STAFF
- **Request Body**:
  ```json
  {
    "session_id": "44444444-0000-0000-0000-000000000001"
  }
  ```

### 7.4 Tandai Pasien Tidak Hadir (No-Show)
- **Method / Endpoint**: `PATCH /admin/queue/no-show/:id`
- **Akses**: ADMIN atau STAFF
- **Keterangan**: `:id` adalah UUID appointment pasien yang tidak hadir di ruang tunggu saat dipanggil.

---

## 8. Dashboard & Analitik Admin (`/admin/dashboard`)

### 8.1 Ringkasan 4 Kartu Metrik KPI
- **Method / Endpoint**: `GET /admin/dashboard/metrics`
- **Akses**: ADMIN atau STAFF
- **Format Header**: `Authorization: Bearer <ADMIN_TOKEN>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Ringkasan metrik dashboard berhasil dimuat",
    "data": {
      "today_appointments": 12,
      "waiting_queue": 3,
      "pending_verification": 1,
      "today_revenue": 4200000
    }
  }
  ```

### 8.2 Statistik & Data Grafik
- **Method / Endpoint**: `GET /admin/dashboard/stats`
- **Akses**: ADMIN atau STAFF
- **Query Parameters**:
  - `period`: Periode agregasi (`day`, `month`, `year`, default: `month`)
  - `from` (`YYYY-MM-DD`): Tanggal awal filter
  - `to` (`YYYY-MM-DD`): Tanggal akhir filter
  - `doctor_id` (UUID, opsional): Filter khusus dokter tertentu
- **Contoh Request**:
  ```bash
  curl -X GET "http://localhost:8000/api/v1/admin/dashboard/stats?period=day&from=2026-11-01&to=2026-11-07" \
    -H "Authorization: Bearer <ADMIN_TOKEN>"
  ```

---

## 9. Manajemen Janji Temu Admin (`/admin/appointments`)

### 9.1 Daftar Janji Temu Klinik
- **Method / Endpoint**: `GET /admin/appointments`
- **Akses**: Khusus ADMIN
- **Query Parameters**:
  - `status`: Filter status (`waiting_payment`, `waiting_confirmation`, `done`, `rejected`, `expired`, `canceled`)
  - `doctor_id`: UUID dokter
  - `session_id`: UUID sesi praktik
  - `date`: Tanggal sesi praktik (`YYYY-MM-DD`)
  - `page`: Nomor halaman (default `1`)
  - `limit`: Jumlah data per halaman (default `10`, max `50`)
- **Contoh Request (5 Pembayaran Menunggu Konfirmasi)**:
  ```bash
  curl -X GET "http://localhost:8000/api/v1/admin/appointments?status=waiting_confirmation&limit=5" \
    -H "Authorization: Bearer <ADMIN_TOKEN>"
  ```

### 9.2 Detail Janji Temu
- **Method / Endpoint**: `GET /admin/appointments/:id`
- **Akses**: Khusus ADMIN

### 9.3 Konfirmasi & Setujui Pembayaran Pasien (Approve)
- **Method / Endpoint**: `PATCH /admin/appointments/:id/approve`
- **Akses**: Khusus ADMIN
- **Format Header**: `Authorization: Bearer <ADMIN_TOKEN>`
- **Keterangan**: Mengubah status janji menjadi `done`, mencatat `confirmed_at`, dan menghasilkan QR code token check-in untuk pasien.
- **Contoh Request**:
  ```bash
  curl -X PATCH http://localhost:8000/api/v1/admin/appointments/55555555-5555-5555-5555-555555555555/approve \
    -H "Authorization: Bearer <ADMIN_TOKEN>"
  ```

### 9.4 Tolak Pembayaran Pasien (Reject)
- **Method / Endpoint**: `PATCH /admin/appointments/:id/reject`
- **Akses**: Khusus ADMIN
- **Format Header**:
  - `Authorization: Bearer <ADMIN_TOKEN>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "reason": "Nominal transfer pada struk bukti pembayaran tidak sesuai dengan tarif konsultasi."
  }
  ```

### 9.5 Perbarui Data Janji Temu Admin (Update)
- **Method / Endpoint**: `PATCH /admin/appointments/:id`
- **Akses**: Khusus ADMIN
- **Request Body** (Opsional):
  ```json
  {
    "status": "done",
    "notes": "Pasien meminta konsultasi tambahan terkait treatment laser.",
    "is_no_show": false
  }
  ```

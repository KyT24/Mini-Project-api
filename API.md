# Dokumentasi API - Aesthetic Clinic Appointment Platform

Dokumentasi lengkap REST API Express.js untuk sistem janji temu klinik estetika, terintegrasi langsung dengan database Supabase (PostgreSQL) yang dipakai bersama dengan frontend Next.js.

- **Base URL**: `http://localhost:8000/api/v1`
- **Default Port**: `8000`
- **Format Payload**: JSON (`application/json`) atau Multipart Form Data (`multipart/form-data`)
- **Autentikasi**: Bearer Token (`Authorization: Bearer <TOKEN>`) atau Cookie HTTP-Only (`Cookie: token=<TOKEN>`)

---

## Akun Demo Pengujian

| Role | Email | Password | Keterangan |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@klinik.test` | `Admin123!` | Akses admin klinik, verifikasi bukti bayar, check-in QR, panggil antrean, dashboard analitik |
| **PATIENT** | `pasien@klinik.test` | `Pasien123!` | Pasien klinik, buat janji, upload bukti bayar, lihat riwayat & antrean saya |

---

## 1. Autentikasi (`/auth`)

### 1.1 Login Pengguna
Masuk ke sistem dan mendapatkan JWT token.

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@klinik.test",
    "password": "Admin123!"
  }'
```

**Response (200 OK):**
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
Mendaftar akun pasien baru.

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "pasien.baru@example.com",
    "password": "Password123!",
    "full_name": "Siti Nurhaliza",
    "phone_number": "081298765432"
  }'
```

### 1.3 Cek Profil Sesi Aktif (`/auth/me`)
Mendapatkan data pengguna yang sedang login berdasarkan Bearer token atau Cookie.

```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

### 1.4 Daftarkan Admin Baru (Khusus Admin)
Admin yang sedang aktif dapat mendaftarkan akun admin baru.

```bash
curl -X POST http://localhost:8000/api/v1/auth/admins \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "staff.admin@klinik.test",
    "password": "AdminPassword123!",
    "full_name": "Staf Admin Klinik",
    "phone_number": "081211112222"
  }'
```

### 1.5 Logout
Menghapus cookie sesi autentikasi.

```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 2. Spesialis Dokter (`/specialists`)

### 2.1 Daftar Spesialis (Publik)
```bash
curl -X GET http://localhost:8000/api/v1/specialists
```

### 2.2 Detail Spesialis (Publik)
```bash
curl -X GET http://localhost:8000/api/v1/specialists/11111111-0000-0000-0000-000000000001
```

### 2.3 Tambah Spesialis Baru (Admin)
```bash
curl -X POST http://localhost:8000/api/v1/specialists \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bedah Plastik & Rekonstruksi Estetika (Sp.B.P.R.E)"
  }'
```

### 2.4 Edit Spesialis (Admin)
```bash
curl -X PUT http://localhost:8000/api/v1/specialists/11111111-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dermatologi, Venereologi & Estetika Klinis"
  }'
```

### 2.5 Hapus Spesialis (Admin)
```bash
curl -X DELETE http://localhost:8000/api/v1/specialists/<SPECIALIST_ID> \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## 3. Dokter Estetika (`/doctors`)

### 3.1 Daftar Dokter dengan Filter & Pencarian (Publik)
Parameter query yang didukung:
- `search`: cari nama dokter
- `specialist_id`: filter ID bidang spesialis
- `day_of_week`: filter hari praktik (`1` = Senin s/d `7` = Minggu)
- `min_fee` & `max_fee`: filter rentang biaya konsultasi
- `sort`: `newest`, `fee_asc`, `fee_desc`, `experience_desc`
- `page` & `limit`: pagination (default `page=1&limit=10`)

```bash
# Semua dokter aktif
curl -X GET http://localhost:8000/api/v1/doctors

# Filter dokter spesialis tertentu dengan pagination
curl -X GET "http://localhost:8000/api/v1/doctors?page=1&limit=5&sort=experience_desc"
```

### 3.2 Detail Dokter (Publik)
Mengembalikan informasi lengkap dokter, jadwal praktik reguler, dan rating ulasan.

```bash
curl -X GET http://localhost:8000/api/v1/doctors/22222222-0000-0000-0000-000000000001
```

### 3.3 Tambah Dokter Baru (Admin)
```bash
curl -X POST http://localhost:8000/api/v1/doctors \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dr.clarissa@klinik.test",
    "password": "DokterPassword123!",
    "full_name": "dr. Clarissa Wijaya, Sp.D.V.E",
    "phone_number": "081299887766",
    "specialist_id": "11111111-0000-0000-0000-000000000001",
    "consultation_fee": 350000,
    "experience_years": 8,
    "alumnus": "Universitas Airlangga",
    "description": "Fokus pada perawatan laser acne scars dan peremajaan kulit modern."
  }'
```

### 3.4 Upload Foto Profil Dokter (Admin)
Mendukung `multipart/form-data` (file gambar JPG/PNG/WebP, maksimal 5MB).

```bash
curl -X POST http://localhost:8000/api/v1/doctors/22222222-0000-0000-0000-000000000001/photo \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -F "file=@/path/to/foto-dokter.jpg"
```

### 3.5 Edit Data Dokter (Admin)
```bash
curl -X PUT http://localhost:8000/api/v1/doctors/22222222-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "consultation_fee": 320000,
    "experience_years": 11,
    "description": "Spesialis estetika wajah, anti-aging, dan dermatologi kosmetik bersertifikasi internasional."
  }'
```

---

## 4. Jadwal Praktik Dokter (`/schedules`)

### 4.1 Daftar Jadwal Praktik Dokter (Publik)
Melihat jadwal dokter tertentu berdasarkan ID dokter (`day_of_week`: `1`=Senin, `2`=Selasa, ..., `7`=Minggu).

```bash
curl -X GET "http://localhost:8000/api/v1/schedules?doctor_id=22222222-0000-0000-0000-000000000001"
```

### 4.2 Tambah Slot Jadwal Dokter (Admin)
```bash
curl -X POST http://localhost:8000/api/v1/schedules \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "doctor_id": "22222222-0000-0000-0000-000000000001",
    "day_of_week": 1,
    "start_time": "09:00:00",
    "end_time": "14:00:00",
    "patient_quota": 15
  }'
```

---

## 5. Janji Temu & Pemesanan (`/appointments`)

### 5.1 Cek Ketersediaan Kuota Slot Praktik (Publik)
Mengecek apakah pada tanggal tertentu dokter memiliki slot praktik aktif dan berapa sisa kuotanya.

```bash
curl -X GET "http://localhost:8000/api/v1/appointments/availability?doctor_id=22222222-0000-0000-0000-000000000001&date=2026-11-06"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Ketersediaan jadwal berhasil dimuat",
  "data": [
    {
      "schedule_id": "33333333-0000-0000-0000-000000000001",
      "doctor_id": "22222222-0000-0000-0000-000000000001",
      "date": "2026-11-06",
      "day_of_week": 5,
      "start_time": "08:00:00",
      "end_time": "12:00:00",
      "quota": 15,
      "booked": 0,
      "remaining": 15,
      "is_available": true
    }
  ]
}
```

### 5.2 Buat Janji Temu Baru (Pasien)
Membuat booking janji temu baru pada sesi jadwal dokter yang dipilih.

```bash
curl -X POST http://localhost:8000/api/v1/appointments/book \
  -H "Authorization: Bearer <PATIENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "schedule_id": "33333333-0000-0000-0000-000000000001",
    "date": "2026-11-06"
  }'
```

### 5.3 Upload Bukti Pembayaran Konsultasi (Pasien)
Mendukung 2 metode:
1. **Multipart Upload (File):**
```bash
curl -X POST http://localhost:8000/api/v1/appointments/<APPOINTMENT_ID>/payment-proof \
  -H "Authorization: Bearer <PATIENT_TOKEN>" \
  -F "file=@/path/to/struk-transfer.jpg"
```
2. **JSON Base64 Payload:**
```bash
curl -X POST http://localhost:8000/api/v1/appointments/<APPOINTMENT_ID>/payment-proof \
  -H "Authorization: Bearer <PATIENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "file": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "mime_type": "image/jpeg"
  }'
```

### 5.4 Daftar Janji Temu Saya (Pasien)
```bash
curl -X GET http://localhost:8000/api/v1/appointments/my \
  -H "Authorization: Bearer <PATIENT_TOKEN>"
```

### 5.5 Batalkan Janji Temu (Pasien)
```bash
curl -X POST http://localhost:8000/api/v1/appointments/<APPOINTMENT_ID>/cancel \
  -H "Authorization: Bearer <PATIENT_TOKEN>"
```

### 5.6 Berikan Ulasan & Rating Dokter (Pasien)
Dapat dilakukan setelah status janji temu `done` (selesai diperiksa).

```bash
curl -X POST http://localhost:8000/api/v1/appointments/<APPOINTMENT_ID>/rating \
  -H "Authorization: Bearer <PATIENT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "review": "Pelayanan dr. Maya sangat teliti dan ramah, hasil treatment sangat memuaskan!"
  }'
```

---

## 6. Antrean Langsung & Operasional Hari H (`/queue` & `/admin/queue`)

### 6.1 Display TV Antrean Langsung (Publik)
Endpoint publik yang di-polling oleh layar TV monitor ruang tunggu klinik (`/queue`) untuk menampilkan dokter yang sedang praktik, nomor antrean yang sedang dilayani, dan antrean berikutnya.

```bash
curl -X GET http://localhost:8000/api/v1/queue/live
```

**Response (200 OK):**
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
      "start_time": "08:00:00",
      "end_time": "23:00:00",
      "current_queue_number": 2,
      "next_numbers": []
    }
  ]
}
```

### 6.2 Check-in Pasien di Meja Resepsionis / QR Scan (Admin)
Menerima token scan barcode / QR code kartu janji temu, kode janji temu (contoh: `APT-20261104-001`), atau format `CODE:UUID`. Menghasilkan nomor urut antrean fisik harian secara aman dan idempotensial (mencegah penomoran ganda).

```bash
curl -X POST http://localhost:8000/api/v1/admin/queue/check-in \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "APT-20261104-001"
  }'
```

### 6.3 Panggil Antrean Berikutnya / Call Next (Admin)
Admin / perawat memanggil pasien berikutnya pada sesi dokter yang dipilih. Mengupdate `current_queue_number` dan memicu pengumuman suara / audio chime pada monitor.

```bash
curl -X PATCH http://localhost:8000/api/v1/admin/queue/call-next \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "44444444-0000-0000-0000-000000000001"
  }'
```

### 6.4 Tandai Pasien Tidak Hadir / No-Show (Admin)
Jika pasien sudah dipanggil berulang kali dan tidak berada di ruang tunggu klinik.

```bash
curl -X PATCH http://localhost:8000/api/v1/admin/queue/no-show/<APPOINTMENT_ID> \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## 7. Dashboard & Analitik Admin (`/admin/dashboard`)

### 7.1 Ringkasan Metrik Dashboard (Admin)
Metrik operasional real-time klinik: total janji hari ini, pasien menunggu di antrean, bukti bayar menunggu verifikasi, dan perkiraan omzet harian.

```bash
curl -X GET http://localhost:8000/api/v1/admin/dashboard/metrics \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Ringkasan metrik dashboard berhasil dimuat",
  "data": {
    "today_appointments": 12,
    "waiting_queue": 3,
    "pending_verification": 1,
    "today_revenue": 3600000
  }
}
```

### 7.2 Laporan Statistik Grafik (Admin)
Data time-series untuk visualisasi diagram grafik (Recharts) per hari (`day`), bulan (`month`), atau tahun (`year`), serta performa pasien per dokter.

```bash
curl -X GET "http://localhost:8000/api/v1/admin/dashboard/stats?period=day&from=2026-11-01&to=2026-11-07" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

---

## 8. Manajemen Janji Temu Admin (`/admin/appointments`)

### 8.1 Daftar Semua Janji Temu Klinik (Admin)
```bash
curl -X GET "http://localhost:8000/api/v1/admin/appointments?page=1&limit=20&status=waiting_confirmation" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 8.2 Konfirmasi & Setujui Pembayaran Pasien (Admin)
Menyetujui bukti transfer pembayaran pasien (`status` berubah menjadi `done` dan generate QR token check-in).

```bash
curl -X POST http://localhost:8000/api/v1/admin/appointments/<APPOINTMENT_ID>/approve \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### 8.3 Tolak Pembayaran / Batalkan Booking (Admin)
```bash
curl -X POST http://localhost:8000/api/v1/admin/appointments/<APPOINTMENT_ID>/reject \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Nominal transfer tidak sesuai dengan biaya konsultasi."
  }'
```


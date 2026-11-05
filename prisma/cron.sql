-- 1. Aktifkan ekstensi pg_cron (hanya butuh sekali di Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Cron 1: Cek & ubah pembayaran kedaluwarsa otomatis setiap 5 menit
SELECT cron.schedule(
  'auto-expire-appointments',
  '*/5 * * * *',
  'SELECT public.process_expired_appointments();'
);

-- 3. Cron 2: Setiap pukul 00:05 WIB (17:05 UTC), otomatis buat sesi praktik hari ke-7 ke depan
SELECT cron.schedule(
  'auto-generate-future-sessions',
  '5 17 * * *',
  $$
  INSERT INTO public.practice_sessions (
    doctor_id, session_date, start_time, end_time, starts_at, ends_at, patient_quota
  )
  SELECT 
    ds.doctor_id,
    (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE + 7,
    ds.start_time,
    ds.end_time,
    ((NOW() AT TIME ZONE 'Asia/Jakarta')::DATE + 7 + ds.start_time) AT TIME ZONE 'Asia/Jakarta',
    ((NOW() AT TIME ZONE 'Asia/Jakarta')::DATE + 7 + ds.end_time) AT TIME ZONE 'Asia/Jakarta',
    ds.patient_quota
  FROM public.doctor_schedules ds
  WHERE ds.day_of_week = EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE + 7)::INTEGER
    AND ds.is_active = TRUE
  ON CONFLICT (doctor_id, session_date, start_time) DO NOTHING;
  $$
);
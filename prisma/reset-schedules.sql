-- =============================================================================
-- RESET JADWAL & SESI PRAKTIK DOKTER (DOCTOR SCHEDULES & PRACTICE SESSIONS)
-- =============================================================================
-- Deskripsi:
-- 1. Mengosongkan jadwal praktik lama & sesi praktik (serta janji temu lama)
-- 2. Mempertahankan master dokter & spesialis yang sudah ada
-- 3. Memasukkan template jadwal mingguan baru (Shift Pagi, Siang, & Malam)
-- 4. Men-generate otomatis sesi praktik aktif untuk 14 hari ke depan (WIB)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. BERSIHKAN JADWAL, SESI, DAN TRANSAKSI TERKAIT (CASCADE)
-- -----------------------------------------------------------------------------
TRUNCATE TABLE 
  public.ratings,
  public.appointments,
  public.practice_sessions,
  public.doctor_schedules
CASCADE;

-- -----------------------------------------------------------------------------
-- 2. MASUKKAN JADWAL PRAKTIK MINGGUAN BARU (doctor_schedules)
-- Format day_of_week: 0=Minggu, 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu
-- -----------------------------------------------------------------------------

-- dr. Maya Indah, Sp.D.V.E (Dokter 1)
INSERT INTO public.doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, patient_quota, is_active) VALUES
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000001', 1, '09:00:00', '13:00:00', 12, TRUE), -- Senin Pagi
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000001', 3, '14:00:00', '18:00:00', 12, TRUE), -- Rabu Siang
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000001', 5, '09:00:00', '13:00:00', 12, TRUE), -- Jumat Pagi
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000001', 6, '10:00:00', '15:00:00', 10, TRUE); -- Sabtu

-- dr. Gisella Valerie, Dipl. AAAM (Dokter 2)
INSERT INTO public.doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, patient_quota, is_active) VALUES
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000002', 1, '14:00:00', '18:00:00', 10, TRUE), -- Senin Siang
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000002', 2, '10:00:00', '14:00:00', 10, TRUE), -- Selasa Pagi
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000002', 4, '14:00:00', '18:00:00', 10, TRUE), -- Kamis Siang
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000002', 6, '13:00:00', '17:00:00', 10, TRUE); -- Sabtu Siang

-- dr. Kevin Prasetya, Sp.B.P.R.E (Dokter 3)
INSERT INTO public.doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, patient_quota, is_active) VALUES
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000003', 1, '10:00:00', '14:00:00', 8, TRUE),  -- Senin Pagi
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000003', 3, '10:00:00', '14:00:00', 8, TRUE),  -- Rabu Pagi
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000003', 5, '14:00:00', '18:00:00', 8, TRUE),  -- Jumat Siang
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000003', 0, '10:00:00', '14:00:00', 6, TRUE);  -- Minggu

-- dr. Natasha Wijaya, M.Biomed (AAM) (Dokter 4)
INSERT INTO public.doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, patient_quota, is_active) VALUES
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000004', 2, '13:00:00', '17:00:00', 12, TRUE), -- Selasa Siang
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000004', 4, '09:00:00', '13:00:00', 12, TRUE), -- Kamis Pagi
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000004', 5, '13:00:00', '17:00:00', 12, TRUE), -- Jumat Siang
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000004', 6, '09:00:00', '13:00:00', 10, TRUE); -- Sabtu Pagi

-- dr. Amanda Clarissa, Sp.D.V.E (Dokter 5)
INSERT INTO public.doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, patient_quota, is_active) VALUES
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000005', 1, '13:00:00', '17:00:00', 10, TRUE), -- Senin Siang
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000005', 2, '09:00:00', '13:00:00', 10, TRUE), -- Selasa Pagi
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000005', 4, '13:00:00', '17:00:00', 10, TRUE), -- Kamis Siang
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000005', 0, '13:00:00', '17:00:00', 8, TRUE);  -- Minggu Siang

-- dr. Reza Mahendra, Dipl. CIBTAC, AAAM (Dokter 6)
INSERT INTO public.doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, patient_quota, is_active) VALUES
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000006', 2, '14:00:00', '18:00:00', 10, TRUE), -- Selasa Siang
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000006', 3, '09:00:00', '13:00:00', 10, TRUE), -- Rabu Pagi
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000006', 5, '14:00:00', '18:00:00', 10, TRUE), -- Jumat Siang
  (gen_random_uuid(), '22222222-0000-0000-0000-000000000006', 6, '14:00:00', '18:00:00', 8, TRUE);  -- Sabtu Siang

-- -----------------------------------------------------------------------------
-- 3. GENERATE SESI PRAKTIK AKTIF (practice_sessions) UNTUK 14 HARI KE DEPAN
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_day_offset DATE;
  v_i INTEGER;
BEGIN
  -- Looping dari hari ini sampai 14 hari ke depan
  FOR v_i IN 0..14 LOOP
    v_day_offset := CURRENT_DATE + v_i;

    INSERT INTO public.practice_sessions (
      id,
      doctor_id,
      schedule_id,
      session_date,
      start_time,
      end_time,
      starts_at,
      ends_at,
      patient_quota,
      current_queue_number
    )
    SELECT 
      gen_random_uuid(),
      ds.doctor_id,
      ds.id,
      v_day_offset,
      ds.start_time,
      ds.end_time,
      (v_day_offset + ds.start_time) AT TIME ZONE 'Asia/Jakarta',
      (v_day_offset + ds.end_time) AT TIME ZONE 'Asia/Jakarta',
      ds.patient_quota,
      0
    FROM public.doctor_schedules ds
    WHERE ds.day_of_week = EXTRACT(DOW FROM v_day_offset)::INTEGER
      AND ds.is_active = TRUE
    ON CONFLICT (doctor_id, session_date, start_time) DO NOTHING;
  END LOOP;
END $$;

COMMIT;


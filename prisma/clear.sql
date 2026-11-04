-- =============================================================================
-- CLEAR / WIPE: KLINIK KECANTIKAN & ESTETIKA (AESTHETIC CLINIC PLATFORM)
-- Mengosongkan seluruh data transaksi dan data master secara aman (CASCADE)
-- =============================================================================

TRUNCATE TABLE 
  public.ratings,
  public.appointments,
  public.practice_sessions,
  public.doctor_schedules,
  public.doctors,
  public.specialists,
  public.treatments,
  public.profiles,
  public.users
CASCADE;

-- Bersihkan user testing dari auth.users jika tabel auth tersedia
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
    DELETE FROM auth.users WHERE email IN (
      'admin@klinik.test',
      'pasien@klinik.test',
      'siti@klinik.test',
      'ahmad@klinik.test',
      'clara@klinik.test'
    );
  END IF;
END $$;


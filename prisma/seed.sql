-- =============================================================================
-- SEED DATA DUMMY: KLINIK KECANTIKAN & ESTETIKA (AESTHETIC CLINIC PLATFORM)
-- Referensi: clinic-appointment-platform/supabase/seed.sql & wipe_and_seed_beauty_clinic.sql
-- Mendukung PostgreSQL standar & Supabase Cloud secara idempotent & aman.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 0. STUB AUTH & IDENTITIES (Hanya jika belum ada / Postgres Lokal Murni)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- 1. Schema auth & auth.users (hanya jika belum ada di postgres lokal murni)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    BEGIN
      EXECUTE 'CREATE SCHEMA IF NOT EXISTS auth';
      EXECUTE 'CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID,
        aud VARCHAR(255),
        role VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        encrypted_password VARCHAR(255),
        email_confirmed_at TIMESTAMPTZ,
        invited_at TIMESTAMPTZ,
        confirmation_token VARCHAR(255),
        confirmation_sent_at TIMESTAMPTZ,
        recovery_token VARCHAR(255),
        recovery_sent_at TIMESTAMPTZ,
        email_change_token_new VARCHAR(255),
        email_change VARCHAR(255),
        email_change_sent_at TIMESTAMPTZ,
        last_sign_in_at TIMESTAMPTZ,
        raw_app_meta_data JSONB DEFAULT ''{}''::jsonb,
        raw_user_meta_data JSONB DEFAULT ''{}''::jsonb,
        is_super_admin BOOLEAN,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        phone VARCHAR(255),
        phone_confirmed_at TIMESTAMPTZ,
        phone_change VARCHAR(255),
        phone_change_token VARCHAR(255),
        phone_change_sent_at TIMESTAMPTZ,
        confirmed_at TIMESTAMPTZ,
        email_change_token_current VARCHAR(255),
        email_change_confirm_status SMALLINT,
        banned_until TIMESTAMPTZ,
        reauthentication_token VARCHAR(255),
        reauthentication_sent_at TIMESTAMPTZ,
        is_sso_user BOOLEAN DEFAULT FALSE,
        deleted_at TIMESTAMPTZ
      )';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END IF;

  -- 2. auth.identities (hanya jika belum ada di postgres lokal murni)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'identities'
  ) THEN
    BEGIN
      EXECUTE 'CREATE TABLE IF NOT EXISTS auth.identities (
        id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        provider_id TEXT,
        identity_data JSONB NOT NULL,
        provider TEXT NOT NULL,
        last_sign_in_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        PRIMARY KEY (provider, id)
      )';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. MASTER SPESIALISASI KECANTIKAN & ESTETIKA (5 Spesialisasi Utama)
-- -----------------------------------------------------------------------------
INSERT INTO public.specialists (id, name, description, is_active) VALUES
  (
    '11111111-0000-0000-0000-000000000001',
    'Dermatologi, Venereologi & Estetika (Sp.D.V.E)',
    'Diagnosis dan terapi medis jerawat aktif, hiperpigmentasi/melasma, dermatitis, serta perbaikan skin barrier rusak.',
    TRUE
  ),
  (
    '11111111-0000-0000-0000-000000000002',
    'Dokter Estetika Medik & Anti-Aging (Dipl. AAAM)',
    'Peremajaan wajah non-bedah: injeksi botox, dermal filler hyaluronic acid, thread lift (tarik benang), dan skin booster.',
    TRUE
  ),
  (
    '11111111-0000-0000-0000-000000000003',
    'Bedah Plastik Rekonstruksi & Estetik (Sp.B.P.R.E)',
    'Prosedur kontur estetika wajah, blefaroplasti (kelopak mata), revisi bopeng scar mendalam, dan rekonstruksi estetik.',
    TRUE
  ),
  (
    '11111111-0000-0000-0000-000000000004',
    'Laser & Kosmetika Kulit (Advanced Laser Energy)',
    'Teknologi canggih Pico Laser rejuvenasi, Fractional CO2 bopeng/pori, Yellow Laser vascular kemerahan, dan HIFU lifting.',
    TRUE
  ),
  (
    '11111111-0000-0000-0000-000000000005',
    'Trikologi & Perawatan Kulit Kepala (Hair & Scalp)',
    'Terapi kebotakan, penanganan kerontokan rambut kronis, Platelet-Rich Plasma (PRP) scalp therapy, dan stimulasi folikel.',
    TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 2. DOKTER ESTETIKA & KECANTIKAN (6 Dokter Profesional)
-- -----------------------------------------------------------------------------
INSERT INTO public.doctors (id, specialist_id, full_name, bio, experience_years, consultation_fee, photo_url, is_active) VALUES
  (
    '22222222-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000001',
    'dr. Maya Lestari, Sp.D.V.E, FINSDV',
    'Dokter spesialis dermatologi lulusan Universitas Indonesia dengan fellowship laser di Seoul. Ahli dalam menangani acne vulgaris derajat berat, melasma hormonal, dan peremajaan kulit sensitif.',
    11,
    250000.00,
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400',
    TRUE
  ),
  (
    '22222222-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000002',
    'dr. Gisella Valerie, Dipl. AAAM',
    'Dokter estetika bersertifikasi American Academy of Aesthetic Medicine. Memiliki pengalaman internasional dalam facial harmonization, baby botox natural look, dan lip filler hidrasi.',
    8,
    180000.00,
    'https://images.unsplash.com/photo-1594824813589-39f5c2eb7162?auto=format&fit=crop&q=80&w=400',
    TRUE
  ),
  (
    '22222222-0000-0000-0000-000000000003',
    '11111111-0000-0000-0000-000000000003',
    'dr. Kevin Prasetya, Sp.B.P.R.E',
    'Spesialis bedah plastik estetik dengan fokus pada upper & lower blepharoplasty, revisi scar bopeng membandel, dan peremajaan kontur wajah proporsional dengan pemulihan minimal.',
    14,
    350000.00,
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400',
    TRUE
  ),
  (
    '22222222-0000-0000-0000-000000000004',
    '11111111-0000-0000-0000-000000000004',
    'dr. Natasha Wijaya, M.Biomed (AAM)',
    'Magister Anti-Aging Medicine lulusan Universitas Udayana. Ahli dalam protokol kombinasi Pico Laser, Radiofrequency Microneedling, dan chemical peeling pencerah untuk tekstur glass skin.',
    9,
    200000.00,
    'https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&q=80&w=400',
    TRUE
  ),
  (
    '22222222-0000-0000-0000-000000000005',
    '11111111-0000-0000-0000-000000000001',
    'dr. Amanda Clarissa, Sp.D.V.E',
    'Fokus pada penanganan skin barrier rusak akibat over-exfoliation, alergi kosmetik, rosacea, serta terapi injeksi Polynucleotide Salmon DNA untuk elastisitas kulit mendalam.',
    7,
    220000.00,
    'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&q=80&w=400',
    TRUE
  ),
  (
    '22222222-0000-0000-0000-000000000006',
    '11111111-0000-0000-0000-000000000005',
    'dr. Reza Mahendra, Dipl. CIBTAC, AAAM',
    'Pakar trikologi klinis yang berfokus pada terapi kerontokan rambut pria dan wanita, PRP Hair Restoration, serta teknologi body slimming dan pengencangan kulit non-invasif.',
    6,
    175000.00,
    'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400',
    TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  specialist_id = EXCLUDED.specialist_id,
  full_name = EXCLUDED.full_name,
  bio = EXCLUDED.bio,
  experience_years = EXCLUDED.experience_years,
  consultation_fee = EXCLUDED.consultation_fee,
  photo_url = EXCLUDED.photo_url,
  is_active = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 3. JADWAL PRAKTIK MINGGUAN (21 Slot Praktik: 0=Minggu ... 6=Sabtu)
-- -----------------------------------------------------------------------------
DELETE FROM public.doctor_schedules 
WHERE id BETWEEN '33333333-0000-0000-0000-000000000001' AND '33333333-0000-0000-0000-000000000020'
  OR doctor_id IN (
    '22222222-0000-0000-0000-000000000001',
    '22222222-0000-0000-0000-000000000002',
    '22222222-0000-0000-0000-000000000003',
    '22222222-0000-0000-0000-000000000004',
    '22222222-0000-0000-0000-000000000005',
    '22222222-0000-0000-0000-000000000006'
  );

INSERT INTO public.doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, patient_quota, is_active) VALUES
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 1, '09:00', '13:00', 12, TRUE),
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 3, '13:00', '17:00', 12, TRUE),
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001', 5, '09:00', '13:00', 12, TRUE),
  ('33333333-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000001', 0, '10:00', '15:00', 10, TRUE),

  ('33333333-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000002', 2, '10:00', '14:00', 10, TRUE),
  ('33333333-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000002', 4, '14:00', '18:00', 10, TRUE),
  ('33333333-0000-0000-0000-000000000007', '22222222-0000-0000-0000-000000000002', 6, '10:00', '15:00', 12, TRUE),
  ('33333333-0000-0000-0000-000000000008', '22222222-0000-0000-0000-000000000002', 0, '13:00', '17:00', 8, TRUE),

  ('33333333-0000-0000-0000-000000000009', '22222222-0000-0000-0000-000000000003', 1, '14:00', '18:00', 8, TRUE),
  ('33333333-0000-0000-0000-000000000010', '22222222-0000-0000-0000-000000000003', 4, '09:00', '13:00', 8, TRUE),
  ('33333333-0000-0000-0000-000000000011', '22222222-0000-0000-0000-000000000003', 6, '13:00', '17:00', 8, TRUE),

  ('33333333-0000-0000-0000-000000000012', '22222222-0000-0000-0000-000000000004', 2, '14:00', '19:00', 12, TRUE),
  ('33333333-0000-0000-0000-000000000013', '22222222-0000-0000-0000-000000000004', 3, '09:00', '13:00', 10, TRUE),
  ('33333333-0000-0000-0000-000000000014', '22222222-0000-0000-0000-000000000004', 5, '14:00', '19:00', 12, TRUE),

  ('33333333-0000-0000-0000-000000000015', '22222222-0000-0000-0000-000000000005', 1, '10:00', '14:00', 10, TRUE),
  ('33333333-0000-0000-0000-000000000016', '22222222-0000-0000-0000-000000000005', 2, '09:00', '13:00', 10, TRUE),
  ('33333333-0000-0000-0000-000000000017', '22222222-0000-0000-0000-000000000005', 5, '10:00', '14:00', 10, TRUE),

  ('33333333-0000-0000-0000-000000000018', '22222222-0000-0000-0000-000000000006', 3, '14:00', '18:00', 10, TRUE),
  ('33333333-0000-0000-0000-000000000019', '22222222-0000-0000-0000-000000000006', 4, '10:00', '14:00', 10, TRUE),
  ('33333333-0000-0000-0000-000000000020', '22222222-0000-0000-0000-000000000006', 6, '09:00', '13:00', 10, TRUE)
ON CONFLICT (doctor_id, day_of_week, start_time) DO UPDATE SET
  end_time = EXCLUDED.end_time,
  patient_quota = EXCLUDED.patient_quota,
  is_active = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 4. MASTER KATALOG TREATMENT ESTETIKA (14 Treatment)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.treatments ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

INSERT INTO public.treatments (id, slug, name, price, duration_minutes) VALUES
  (gen_random_uuid()::text, 'acne-dermapeel', 'Acne Dermapeel Therapy', 400000, 60),
  (gen_random_uuid()::text, 'ipl-acne', 'IPL Acne Clarifying Pulse', 550000, 45),
  (gen_random_uuid()::text, 'acne-laser-co2', 'Fractional CO2 Laser Scar Revision', 1800000, 90),
  (gen_random_uuid()::text, 'acne-facial', 'Deep Cleansing Acne Facial', 250000, 60),
  (gen_random_uuid()::text, 'brightening-facial', 'Radiance Infusion Brightening Facial', 300000, 60),
  (gen_random_uuid()::text, 'glow-peeling', 'Korean Glass Skin Chemical Peeling', 350000, 45),
  (gen_random_uuid()::text, 'vitamin-c-infusion', 'High-Dose Vitamin C Antioxidant Infusion', 450000, 45),
  (gen_random_uuid()::text, 'anti-aging-facial', 'Youth Renewal Collagen Facial', 400000, 75),
  (gen_random_uuid()::text, 'skin-booster', 'Polynucleotide Salmon DNA Skin Booster', 1500000, 60),
  (gen_random_uuid()::text, 'rf-lifting', 'Multi-Polar RF Skin Tightening & Lifting', 1200000, 60),
  (gen_random_uuid()::text, 'hair-treatment', 'Anti-Dandruff & Scalp Clarifying Ritual', 350000, 60),
  (gen_random_uuid()::text, 'laser-hair-removal', 'Painless Diode Laser Hair Removal', 600000, 45),
  (gen_random_uuid()::text, 'body-slimming', 'Targeted Cavitation Fat Slimming', 500000, 60),
  (gen_random_uuid()::text, 'body-contouring', 'HIFU Body Contouring & Sculpting', 1500000, 90)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  duration_minutes = EXCLUDED.duration_minutes;

-- -----------------------------------------------------------------------------
-- 5. AKUN PENGGUNA (ADMIN, PASIEN DEMO & PASIEN TEST)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_id     UUID := 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
  v_patient_id_1 UUID := 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb';
  v_p1_alias     UUID := 'bbbbbbbb-2222-2222-2222-bbbbbbbbbb01';
  v_patient_id_2 UUID := 'bbbbbbbb-2222-2222-2222-cccccccccccc';
  v_p2_alias     UUID := 'bbbbbbbb-2222-2222-2222-bbbbbbbbbb02';
  v_patient_id_3 UUID := 'bbbbbbbb-2222-2222-2222-dddddddddddd';
  v_p3_alias     UUID := 'bbbbbbbb-2222-2222-2222-bbbbbbbbbb03';
  v_patient_id_4 UUID := 'bbbbbbbb-2222-2222-2222-eeeeeeeeeeee';
  v_pw_hash      VARCHAR(255) := crypt('Admin123!', gen_salt('bf'));
  v_pw_hash_user VARCHAR(255) := crypt('Pasien123!', gen_salt('bf'));
BEGIN
  -- Bersihkan akun jika ada email sama dengan UUID berbeda agar tidak bentrok unique constraint pada email
  DELETE FROM public.users WHERE email IN (
    'admin@klinik.test', 'pasien@klinik.test', 'pasien1@klinik.test',
    'siti@klinik.test', 'pasien2@klinik.test',
    'ahmad@klinik.test', 'pasien3@klinik.test',
    'clara@klinik.test'
  ) AND id NOT IN (
    v_admin_id::text, v_patient_id_1::text, v_patient_id_2::text, v_patient_id_3::text, v_patient_id_4::text,
    v_p1_alias::text, v_p2_alias::text, v_p3_alias::text
  );

  DELETE FROM public.profiles WHERE email IN (
    'admin@klinik.test', 'pasien@klinik.test', 'pasien1@klinik.test',
    'siti@klinik.test', 'pasien2@klinik.test',
    'ahmad@klinik.test', 'pasien3@klinik.test',
    'clara@klinik.test'
  ) AND id NOT IN (
    v_admin_id, v_patient_id_1, v_patient_id_2, v_patient_id_3, v_patient_id_4,
    v_p1_alias, v_p2_alias, v_p3_alias
  );

  DELETE FROM auth.users WHERE email IN (
    'admin@klinik.test', 'pasien@klinik.test', 'pasien1@klinik.test',
    'siti@klinik.test', 'pasien2@klinik.test',
    'ahmad@klinik.test', 'pasien3@klinik.test',
    'clara@klinik.test'
  ) AND id NOT IN (
    v_admin_id, v_patient_id_1, v_patient_id_2, v_patient_id_3, v_patient_id_4,
    v_p1_alias, v_p2_alias, v_p3_alias
  );

  -- A. Admin Account: admin@klinik.test / Admin123!
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
    'admin@klinik.test', v_pw_hash, NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin Utama Klinik Estetika"}'::jsonb, NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  BEGIN
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (v_admin_id::text, v_admin_id, v_admin_id::text, format('{"sub":"%s","email":"admin@klinik.test"}', v_admin_id)::jsonb, 'email', NOW(), NOW(), NOW())
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.profiles (id, email, full_name, phone_number, role)
  VALUES (v_admin_id, 'admin@klinik.test', 'Admin Utama Klinik Estetika', '081200000001', 'admin')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = 'admin';

  INSERT INTO public.users (id, email, full_name, phone_number, password, role)
  VALUES (v_admin_id::text, 'admin@klinik.test', 'Admin Utama Klinik Estetika', '081200000001', v_pw_hash, 'ADMIN')
  ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password, role = 'ADMIN';

  -- B. Patient Demo 1: pasien@klinik.test / Pasien123!
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_patient_id_1, 'authenticated', 'authenticated',
    'pasien@klinik.test', v_pw_hash_user, NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Budi Pasien Demo","phone_number":"081234567890"}'::jsonb, NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  BEGIN
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (v_patient_id_1::text, v_patient_id_1, v_patient_id_1::text, format('{"sub":"%s","email":"pasien@klinik.test"}', v_patient_id_1)::jsonb, 'email', NOW(), NOW(), NOW())
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.profiles (id, email, full_name, phone_number, role, date_of_birth, gender, address)
  VALUES (v_patient_id_1, 'pasien@klinik.test', 'Budi Pasien Demo', '081234567890', 'patient', '1995-08-17', 'male', 'Jl. Senopati No. 45, Jakarta Selatan')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = 'patient';

  INSERT INTO public.users (id, email, full_name, phone_number, password, role)
  VALUES (v_patient_id_1::text, 'pasien@klinik.test', 'Budi Pasien Demo', '081234567890', v_pw_hash_user, 'PATIENT')
  ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password, role = 'PATIENT';

  -- C. Patient Demo 2: siti@klinik.test / Pasien123!
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_patient_id_2, 'authenticated', 'authenticated',
    'siti@klinik.test', v_pw_hash_user, NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Siti Rahayu","phone_number":"081298765431"}'::jsonb, NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  BEGIN
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (v_patient_id_2::text, v_patient_id_2, v_patient_id_2::text, format('{"sub":"%s","email":"siti@klinik.test"}', v_patient_id_2)::jsonb, 'email', NOW(), NOW(), NOW())
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.profiles (id, email, full_name, phone_number, role, date_of_birth, gender, address)
  VALUES (v_patient_id_2, 'siti@klinik.test', 'Siti Rahayu', '081298765431', 'patient', '1998-03-24', 'female', 'Jl. Gandaria I No. 12, Kebayoran Baru, Jakarta Selatan')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = 'patient';

  INSERT INTO public.users (id, email, full_name, phone_number, password, role)
  VALUES (v_patient_id_2::text, 'siti@klinik.test', 'Siti Rahayu', '081298765431', v_pw_hash_user, 'PATIENT')
  ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password, role = 'PATIENT';

  -- D. Patient Demo 3: ahmad@klinik.test / Pasien123!
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_patient_id_3, 'authenticated', 'authenticated',
    'ahmad@klinik.test', v_pw_hash_user, NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Ahmad Fauzi","phone_number":"081377889901"}'::jsonb, NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  BEGIN
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (v_patient_id_3::text, v_patient_id_3, v_patient_id_3::text, format('{"sub":"%s","email":"ahmad@klinik.test"}', v_patient_id_3)::jsonb, 'email', NOW(), NOW(), NOW())
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.profiles (id, email, full_name, phone_number, role, date_of_birth, gender, address)
  VALUES (v_patient_id_3, 'ahmad@klinik.test', 'Ahmad Fauzi', '081377889901', 'patient', '1992-11-10', 'male', 'Jl. Tebet Barat Dalam No. 8, Jakarta Selatan')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = 'patient';

  INSERT INTO public.users (id, email, full_name, phone_number, password, role)
  VALUES (v_patient_id_3::text, 'ahmad@klinik.test', 'Ahmad Fauzi', '081377889901', v_pw_hash_user, 'PATIENT')
  ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password, role = 'PATIENT';

  -- E. Patient Demo 4: clara@klinik.test / Pasien123!
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_patient_id_4, 'authenticated', 'authenticated',
    'clara@klinik.test', v_pw_hash_user, NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Clara Valentine","phone_number":"081288991122"}'::jsonb, NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  BEGIN
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (v_patient_id_4::text, v_patient_id_4, v_patient_id_4::text, format('{"sub":"%s","email":"clara@klinik.test"}', v_patient_id_4)::jsonb, 'email', NOW(), NOW(), NOW())
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.profiles (id, email, full_name, phone_number, role, date_of_birth, gender, address)
  VALUES (v_patient_id_4, 'clara@klinik.test', 'Clara Valentine', '081288991122', 'patient', '1997-02-14', 'female', 'Jl. Panglima Polim IX No. 20, Jakarta Selatan')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = 'patient';

  INSERT INTO public.users (id, email, full_name, phone_number, password, role)
  VALUES (v_patient_id_4::text, 'clara@klinik.test', 'Clara Valentine', '081288991122', v_pw_hash_user, 'PATIENT')
  ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password, role = 'PATIENT';

  -- F. Explicit Testing Accounts: pasien1@klinik.test, pasien2@klinik.test, pasien3@klinik.test
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES 
    ('00000000-0000-0000-0000-000000000000', v_p1_alias, 'authenticated', 'authenticated', 'pasien1@klinik.test', v_pw_hash_user, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Budi Pasien Satu Demo","phone_number":"081234567801"}'::jsonb, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', v_p2_alias, 'authenticated', 'authenticated', 'pasien2@klinik.test', v_pw_hash_user, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Siti Rahayu (Pasien 2)","phone_number":"081234567802"}'::jsonb, NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000000', v_p3_alias, 'authenticated', 'authenticated', 'pasien3@klinik.test', v_pw_hash_user, NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ahmad Fauzi (Pasien 3)","phone_number":"081234567803"}'::jsonb, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password, raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  BEGIN
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES 
      (v_p1_alias::text, v_p1_alias, v_p1_alias::text, format('{"sub":"%s","email":"pasien1@klinik.test"}', v_p1_alias)::jsonb, 'email', NOW(), NOW(), NOW()),
      (v_p2_alias::text, v_p2_alias, v_p2_alias::text, format('{"sub":"%s","email":"pasien2@klinik.test"}', v_p2_alias)::jsonb, 'email', NOW(), NOW(), NOW()),
      (v_p3_alias::text, v_p3_alias, v_p3_alias::text, format('{"sub":"%s","email":"pasien3@klinik.test"}', v_p3_alias)::jsonb, 'email', NOW(), NOW(), NOW())
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  INSERT INTO public.profiles (id, email, full_name, phone_number, role, date_of_birth, gender, address)
  VALUES 
    (v_p1_alias, 'pasien1@klinik.test', 'Budi Pasien Satu Demo', '081234567801', 'patient', '1995-08-17', 'male', 'Jl. Senopati No. 45, Jakarta Selatan'),
    (v_p2_alias, 'pasien2@klinik.test', 'Siti Rahayu (Pasien 2)', '081234567802', 'patient', '1998-03-24', 'female', 'Jl. Gandaria I No. 12, Kebayoran Baru, Jakarta Selatan'),
    (v_p3_alias, 'pasien3@klinik.test', 'Ahmad Fauzi (Pasien 3)', '081234567803', 'patient', '1992-11-10', 'male', 'Jl. Tebet Barat Dalam No. 8, Jakarta Selatan')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = 'patient';

  INSERT INTO public.users (id, email, full_name, phone_number, password, role)
  VALUES 
    (v_p1_alias::text, 'pasien1@klinik.test', 'Budi Pasien Satu Demo', '081234567801', v_pw_hash_user, 'PATIENT'),
    (v_p2_alias::text, 'pasien2@klinik.test', 'Siti Rahayu (Pasien 2)', '081234567802', v_pw_hash_user, 'PATIENT'),
    (v_p3_alias::text, 'pasien3@klinik.test', 'Ahmad Fauzi (Pasien 3)', '081234567803', v_pw_hash_user, 'PATIENT')
  ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password, role = 'PATIENT';
END $$;

-- -----------------------------------------------------------------------------
-- 6. SESI PRAKTIK AKTIF (HARI INI, 7 HARI KE DEPAN, DAN MASA LALU)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_today          DATE := (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;
  v_doc_maya       UUID := '22222222-0000-0000-0000-000000000001';
  v_doc_gisella    UUID := '22222222-0000-0000-0000-000000000002';
  v_doc_kevin      UUID := '22222222-0000-0000-0000-000000000003';
  v_session_today1 UUID := '44444444-0000-0000-0000-000000000001';
  v_session_today2 UUID := '44444444-0000-0000-0000-000000000002';
  v_session_past1  UUID := '44444444-0000-0000-0000-000000000003';
  v_session_past2  UUID := '44444444-0000-0000-0000-000000000004';
  v_session_past3  UUID := '44444444-0000-0000-0000-000000000005';
  v_day_offset     DATE;
BEGIN
  -- Bersihkan data ratings & appointments sampel sebelumnya jika sudah ada (agar foreign key aman)
  DELETE FROM public.ratings WHERE appointment_id IN (
    SELECT id FROM public.appointments 
    WHERE id BETWEEN '55555555-0000-0000-0000-000000000001' AND '55555555-0000-0000-0000-000000000008'
       OR code LIKE 'APT-BEAUTY-%'
       OR session_id IN (v_session_today1, v_session_today2, v_session_past1, v_session_past2, v_session_past3)
  );

  DELETE FROM public.appointments 
  WHERE id BETWEEN '55555555-0000-0000-0000-000000000001' AND '55555555-0000-0000-0000-000000000008'
     OR code LIKE 'APT-BEAUTY-%'
     OR session_id IN (v_session_today1, v_session_today2, v_session_past1, v_session_past2, v_session_past3);

  -- Bersihkan sesi praktik sampel terdahulu agar UUID sesi selalu konsisten untuk tanggal hari ini
  DELETE FROM public.practice_sessions WHERE (
    id IN (v_session_today1, v_session_today2, v_session_past1, v_session_past2, v_session_past3)
    OR (doctor_id = v_doc_maya AND session_date = v_today AND start_time = '08:00')
    OR (doctor_id = v_doc_gisella AND session_date = v_today AND start_time = '09:00')
    OR (doctor_id = v_doc_maya AND session_date = v_today - 14 AND start_time = '09:00')
    OR (doctor_id = v_doc_gisella AND session_date = v_today - 7 AND start_time = '10:00')
    OR (doctor_id = v_doc_kevin AND session_date = v_today - 3 AND start_time = '14:00')
  );

  -- A. Sesi Hari Ini 1 (dr. Maya Lestari): 08:00 - 23:00, sedang melayani antrean #1
  INSERT INTO public.practice_sessions (
    id, doctor_id, session_date, start_time, end_time, starts_at, ends_at, patient_quota, current_queue_number
  ) VALUES (
    v_session_today1,
    v_doc_maya,
    v_today,
    '08:00', '23:00',
    (v_today + TIME '08:00') AT TIME ZONE 'Asia/Jakarta',
    (v_today + TIME '23:00') AT TIME ZONE 'Asia/Jakarta',
    15,
    1
  ) ON CONFLICT (doctor_id, session_date, start_time) DO UPDATE SET
    ends_at = (v_today + TIME '23:00') AT TIME ZONE 'Asia/Jakarta',
    patient_quota = 15;

  -- B. Sesi Hari Ini 2 (dr. Gisella Valerie): 09:00 - 23:00
  INSERT INTO public.practice_sessions (
    id, doctor_id, session_date, start_time, end_time, starts_at, ends_at, patient_quota, current_queue_number
  ) VALUES (
    v_session_today2,
    v_doc_gisella,
    v_today,
    '09:00', '23:00',
    (v_today + TIME '09:00') AT TIME ZONE 'Asia/Jakarta',
    (v_today + TIME '23:00') AT TIME ZONE 'Asia/Jakarta',
    12,
    0
  ) ON CONFLICT (doctor_id, session_date, start_time) DO UPDATE SET
    ends_at = (v_today + TIME '23:00') AT TIME ZONE 'Asia/Jakarta',
    patient_quota = 12;

  -- C. Generate Sesi Otomatis 7 Hari ke Depan Berdasarkan Jadwal Mingguan Dokter
  FOR i IN 1..7 LOOP
    v_day_offset := v_today + i;
    INSERT INTO public.practice_sessions (
      doctor_id, session_date, start_time, end_time, starts_at, ends_at, patient_quota
    )
    SELECT 
      ds.doctor_id,
      v_day_offset,
      ds.start_time,
      ds.end_time,
      (v_day_offset + ds.start_time) AT TIME ZONE 'Asia/Jakarta',
      (v_day_offset + ds.end_time) AT TIME ZONE 'Asia/Jakarta',
      ds.patient_quota
    FROM public.doctor_schedules ds
    WHERE ds.day_of_week = EXTRACT(DOW FROM v_day_offset)::INTEGER
      AND ds.is_active = TRUE
    ON CONFLICT (doctor_id, session_date, start_time) DO NOTHING;
  END LOOP;

  -- D. Sesi Masa Lalu (Untuk Statistik Grafik, Laporan Omzet & Rating)
  -- Sesi 14 hari lalu (dr. Maya)
  INSERT INTO public.practice_sessions (
    id, doctor_id, session_date, start_time, end_time, starts_at, ends_at, patient_quota, current_queue_number
  ) VALUES (
    v_session_past1,
    v_doc_maya,
    v_today - 14,
    '09:00', '13:00',
    (v_today - 14 + TIME '09:00') AT TIME ZONE 'Asia/Jakarta',
    (v_today - 14 + TIME '13:00') AT TIME ZONE 'Asia/Jakarta',
    12,
    2
  ) ON CONFLICT (doctor_id, session_date, start_time) DO NOTHING;

  -- Sesi 7 hari lalu (dr. Gisella)
  INSERT INTO public.practice_sessions (
    id, doctor_id, session_date, start_time, end_time, starts_at, ends_at, patient_quota, current_queue_number
  ) VALUES (
    v_session_past2,
    v_doc_gisella,
    v_today - 7,
    '10:00', '14:00',
    (v_today - 7 + TIME '10:00') AT TIME ZONE 'Asia/Jakarta',
    (v_today - 7 + TIME '14:00') AT TIME ZONE 'Asia/Jakarta',
    10,
    1
  ) ON CONFLICT (doctor_id, session_date, start_time) DO NOTHING;

  -- Sesi 3 hari lalu (dr. Kevin)
  INSERT INTO public.practice_sessions (
    id, doctor_id, session_date, start_time, end_time, starts_at, ends_at, patient_quota, current_queue_number
  ) VALUES (
    v_session_past3,
    v_doc_kevin,
    v_today - 3,
    '14:00', '18:00',
    (v_today - 3 + TIME '14:00') AT TIME ZONE 'Asia/Jakarta',
    (v_today - 3 + TIME '18:00') AT TIME ZONE 'Asia/Jakarta',
    8,
    1
  ) ON CONFLICT (doctor_id, session_date, start_time) DO NOTHING;
END $$;

-- -----------------------------------------------------------------------------
-- 7. JANJI TEMU SAMPEL (LENGKAP: ANTRIAN, VERIFIKASI, QR CODE, & RIWAYAT)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_today          DATE := (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;
  v_admin_id       UUID := 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
  v_patient_id_1   UUID := 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb';
  v_patient_id_2   UUID := 'bbbbbbbb-2222-2222-2222-cccccccccccc';
  v_patient_id_3   UUID := 'bbbbbbbb-2222-2222-2222-dddddddddddd';
  v_patient_id_4   UUID := 'bbbbbbbb-2222-2222-2222-eeeeeeeeeeee';
  v_doc_maya       UUID := '22222222-0000-0000-0000-000000000001';
  v_doc_gisella    UUID := '22222222-0000-0000-0000-000000000002';
  v_doc_kevin      UUID := '22222222-0000-0000-0000-000000000003';
  v_session_today1 UUID := '44444444-0000-0000-0000-000000000001';
  v_session_today2 UUID := '44444444-0000-0000-0000-000000000002';
  v_session_past1  UUID := '44444444-0000-0000-0000-000000000003';
  v_session_past2  UUID := '44444444-0000-0000-0000-000000000004';
  v_session_past3  UUID := '44444444-0000-0000-0000-000000000005';
  v_svg_proof      TEXT := 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><rect width="300" height="150" fill="%23e0e7ff"/><text x="20" y="50" font-family="sans-serif" font-size="14" fill="%231e1b4b" font-weight="bold">Bukti Transfer Bank BCA</text><text x="20" y="80" font-family="sans-serif" font-size="12" fill="%234338ca">Nominal: Rp 250.000</text><text x="20" y="110" font-family="sans-serif" font-size="11" fill="%236366f1">Klinik Kecantikan Arhe</text></svg>';
BEGIN
  -- Bersihkan dummy appointments & ratings terdahulu jika sudah ada
  DELETE FROM public.ratings WHERE appointment_id IN (
    SELECT id FROM public.appointments 
    WHERE id BETWEEN '55555555-0000-0000-0000-000000000001' AND '55555555-0000-0000-0000-000000000008'
       OR code LIKE 'APT-BEAUTY-%'
  );

  DELETE FROM public.appointments WHERE 
    id BETWEEN '55555555-0000-0000-0000-000000000001' AND '55555555-0000-0000-0000-000000000008'
    OR code LIKE 'APT-BEAUTY-%';

  -- [1] Hari Ini - Siti Rahayu (Status: done, sudah check-in, nomor urut antrean #1 sedang dilayani di TV Display)
  INSERT INTO public.appointments (
    id, code, patient_id, doctor_id, session_id, status, consultation_fee,
    payment_deadline, confirmed_at, booking_number, qr_token, checked_in_at, queue_number
  ) VALUES (
    '55555555-0000-0000-0000-000000000001', 'APT-BEAUTY-001',
    v_patient_id_2, v_doc_maya, v_session_today1, 'done', 250000,
    NOW() + INTERVAL '30 minutes', NOW() - INTERVAL '2 hours', 1,
    '99999999-0000-0000-0000-000000000001', NOW() - INTERVAL '30 minutes', 1
  );

  -- [2] Hari Ini - Ahmad Fauzi (Status: waiting_confirmation, bukti bayar SVG siap diverifikasi admin di dashboard)
  INSERT INTO public.appointments (
    id, code, patient_id, doctor_id, session_id, status, consultation_fee,
    payment_deadline, payment_proof_path, payment_uploaded_at, booking_number
  ) VALUES (
    '55555555-0000-0000-0000-000000000002', 'APT-BEAUTY-002',
    v_patient_id_3, v_doc_maya, v_session_today1, 'waiting_confirmation', 250000,
    NOW() + INTERVAL '20 minutes', v_svg_proof, NOW() - INTERVAL '10 minutes', 2
  );

  -- [3] Hari Ini - Budi Pasien Demo (Status: done, memiliki QR Token aktif, BELUM check-in; SIAP DI-SCAN MEJA RESEPSIONIS)
  -- QR Token: 99999999-0000-0000-0000-000000000003
  INSERT INTO public.appointments (
    id, code, patient_id, doctor_id, session_id, status, consultation_fee,
    payment_deadline, confirmed_at, booking_number, qr_token
  ) VALUES (
    '55555555-0000-0000-0000-000000000003', 'APT-BEAUTY-003',
    v_patient_id_1, v_doc_maya, v_session_today1, 'done', 250000,
    NOW() + INTERVAL '45 minutes', NOW() - INTERVAL '1 hour', 3,
    '99999999-0000-0000-0000-000000000003'
  );

  -- [4] Hari Ini - Clara Valentine (Status: waiting_payment, baru pesan janji temu)
  INSERT INTO public.appointments (
    id, code, patient_id, doctor_id, session_id, status, consultation_fee,
    payment_deadline, booking_number
  ) VALUES (
    '55555555-0000-0000-0000-000000000004', 'APT-BEAUTY-004',
    v_patient_id_4, v_doc_maya, v_session_today1, 'waiting_payment', 250000,
    NOW() + INTERVAL '50 minutes', 4
  );

  -- [5] Riwayat Masa Lalu 1 (14 Hari Lalu - Budi Pasien Demo, dr. Maya): Selesai & Beri Ulasan
  INSERT INTO public.appointments (
    id, code, patient_id, doctor_id, session_id, status, consultation_fee,
    payment_deadline, confirmed_at, booking_number, checked_in_at, queue_number
  ) VALUES (
    '55555555-0000-0000-0000-000000000005', 'APT-BEAUTY-PAST-1',
    v_patient_id_1, v_doc_maya, v_session_past1, 'done', 250000,
    NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', 1,
    NOW() - INTERVAL '14 days', 1
  );

  INSERT INTO public.ratings (
    appointment_id, patient_id, doctor_id, rating, review, created_at
  ) VALUES (
    '55555555-0000-0000-0000-000000000005', v_patient_id_1, v_doc_maya, 5,
    'Konsultasi masalah jerawat dan rekomendasi acne peeling dari dr. Maya sangat tepat sasaran. Wajah jauh lebih bersih dan skin barrier kembali sehat!',
    NOW() - INTERVAL '14 days'
  );

  -- [6] Riwayat Masa Lalu 2 (7 Hari Lalu - Siti Rahayu, dr. Gisella): Selesai & Beri Ulasan
  INSERT INTO public.appointments (
    id, code, patient_id, doctor_id, session_id, status, consultation_fee,
    payment_deadline, confirmed_at, booking_number, checked_in_at, queue_number
  ) VALUES (
    '55555555-0000-0000-0000-000000000006', 'APT-BEAUTY-PAST-2',
    v_patient_id_2, v_doc_gisella, v_session_past2, 'done', 180000,
    NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', 1,
    NOW() - INTERVAL '7 days', 1
  );

  INSERT INTO public.ratings (
    appointment_id, patient_id, doctor_id, rating, review, created_at
  ) VALUES (
    '55555555-0000-0000-0000-000000000006', v_patient_id_2, v_doc_gisella, 5,
    'Hasil baby botox dari dr. Gisella sangat natural, kerutan halus di dahi hilang tanpa membuat ekspresi kaku.',
    NOW() - INTERVAL '7 days'
  );

  -- [7] Riwayat Masa Lalu 3 (3 Hari Lalu - Ahmad Fauzi, dr. Kevin): Selesai & Beri Ulasan
  INSERT INTO public.appointments (
    id, code, patient_id, doctor_id, session_id, status, consultation_fee,
    payment_deadline, confirmed_at, booking_number, checked_in_at, queue_number
  ) VALUES (
    '55555555-0000-0000-0000-000000000007', 'APT-BEAUTY-PAST-3',
    v_patient_id_3, v_doc_kevin, v_session_past3, 'done', 350000,
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 1,
    NOW() - INTERVAL '3 days', 1
  );

  INSERT INTO public.ratings (
    appointment_id, patient_id, doctor_id, rating, review, created_at
  ) VALUES (
    '55555555-0000-0000-0000-000000000007', v_patient_id_3, v_doc_kevin, 5,
    'Konsultasi scar revisi sangat mendalam dan memuaskan. dr. Kevin menjelaskan tahapan pemulihan dengan sangat detail.',
    NOW() - INTERVAL '3 days'
  );

  -- [8] Riwayat Masa Lalu 4 (2 Hari Lalu - Budi Pasien Demo): Ditolak Admin (contoh data status rejected)
  INSERT INTO public.appointments (
    id, code, patient_id, doctor_id, session_id, status, consultation_fee,
    payment_deadline, payment_proof_path, payment_uploaded_at, rejection_reason, booking_number
  ) VALUES (
    '55555555-0000-0000-0000-000000000008', 'APT-BEAUTY-REJ',
    v_patient_id_1, v_doc_maya, v_session_past1, 'rejected', 250000,
    NOW() - INTERVAL '2 days', v_svg_proof, NOW() - INTERVAL '2 days',
    'Nominal transfer tidak sesuai dengan nominal tarif konsultasi', 2
  );

END $$;


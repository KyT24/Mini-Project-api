-- =============================================================================
-- ARHE CLINIC APPOINTMENT PLATFORM — UNIFIED DATABASE INITIALIZATION & RESET
-- =============================================================================
-- Skema Lengkap PostgreSQL / Supabase selaras 100% dengan Prisma ORM & Frontend
-- Referensi: /Users/oktaviardi/Okta/clinic-appointment-platform/supabase
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 0. SCHEMA & COMPATIBILITY STUBS (Hanya jika belum ada / Postgres Lokal Murni)
-- -----------------------------------------------------------------------------
do $$
begin
  -- 1. Schema auth & auth.users (hanya jika belum ada di postgres lokal murni)
  if not exists (
    select 1 from information_schema.tables 
    where table_schema = 'auth' and table_name = 'users'
  ) then
    begin
      execute 'create schema if not exists auth';
      execute 'create table if not exists auth.users (
        id                  uuid primary key default gen_random_uuid(),
        instance_id         uuid,
        aud                 varchar(255) default ''authenticated'',
        role                varchar(255) default ''authenticated'',
        email               varchar(255) unique,
        encrypted_password  varchar(255),
        email_confirmed_at  timestamptz default now(),
        raw_app_meta_data   jsonb default ''{"provider":"email","providers":["email"]}''::jsonb,
        raw_user_meta_data  jsonb default ''{}''::jsonb,
        created_at          timestamptz default now(),
        updated_at          timestamptz default now()
      )';
    exception when insufficient_privilege then
      null;
    end;
  end if;

  -- 2. Stub auth.uid() jika belum tersedia
  if not exists (
    select 1 from pg_proc p 
    join pg_namespace n on p.pronamespace = n.oid 
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    begin
      execute $func$
        create or replace function auth.uid()
        returns uuid
        language sql
        stable
        as $body$
          select coalesce(
            nullif(current_setting('request.jwt.claim.sub', true), ''),
            (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
          )::uuid;
        $body$;
      $func$;
    exception when insufficient_privilege then
      null;
    end;
  end if;

  -- 3. Schema storage & tabel buckets/objects jika di postgres lokal murni
  if not exists (
    select 1 from information_schema.tables 
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    begin
      execute 'create schema if not exists storage';
      execute 'create table if not exists storage.buckets (
        id                  text primary key,
        name                text not null,
        owner               uuid references auth.users(id),
        created_at          timestamptz default now(),
        updated_at          timestamptz default now(),
        public              boolean default false,
        avif_autodetection  boolean default false,
        file_size_limit     bigint,
        allowed_mime_types  text[]
      )';
      execute 'create table if not exists storage.objects (
        id                  uuid primary key default gen_random_uuid(),
        bucket_id           text references storage.buckets(id),
        name                text,
        owner               uuid references auth.users(id),
        created_at          timestamptz default now(),
        updated_at          timestamptz default now(),
        last_accessed_at    timestamptz default now(),
        metadata            jsonb default ''{}''::jsonb,
        path_tokens         text[] generated always as (string_to_array(name, ''/'')) stored
      )';
    exception when insufficient_privilege then
      null;
    end;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('patient', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.gender as enum ('male', 'female', 'other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.transaction_status as enum (
    'waiting_payment',
    'waiting_confirmation',
    'done',
    'rejected',
    'expired',
    'canceled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.checkin_status as enum ('checked_in', 'no_show');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.role as enum ('PATIENT', 'ADMIN', 'STAFF', 'DOCTOR');
exception when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- 2. TABEL UTAMA (Prisma & Supabase 1:1)
-- -----------------------------------------------------------------------------

-- Profil 1:1 dengan auth.users
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          public.user_role not null default 'patient',
  full_name     text not null default '',
  phone_number  text,
  avatar_url    text,
  date_of_birth date,
  gender        public.gender,
  address       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Master Spesialisasi Medis
create table if not exists public.specialists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Master Dokter Klinik Estetika
create table if not exists public.doctors (
  id               uuid primary key default gen_random_uuid(),
  specialist_id    uuid references public.specialists (id) on delete set null,
  full_name        text not null,
  bio              text,
  experience_years integer not null default 0 check (experience_years between 0 and 80),
  consultation_fee numeric(12, 0) not null check (consultation_fee >= 0),
  photo_url        text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Jadwal Praktik Mingguan Dokter (Template)
create table if not exists public.doctor_schedules (
  id            uuid primary key default gen_random_uuid(),
  doctor_id     uuid not null references public.doctors (id) on delete cascade,
  day_of_week   smallint not null check (day_of_week between 0 and 6),
  start_time    time not null,
  end_time      time not null,
  patient_quota integer not null check (patient_quota > 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_time > start_time),
  unique (doctor_id, day_of_week, start_time)
);

-- Sesi Praktik Nyata di Tanggal Tertentu
create table if not exists public.practice_sessions (
  id                   uuid primary key default gen_random_uuid(),
  doctor_id            uuid not null references public.doctors (id) on delete cascade,
  schedule_id          uuid references public.doctor_schedules (id) on delete set null,
  session_date         date not null,
  start_time           time not null,
  end_time             time not null,
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  patient_quota        integer not null check (patient_quota > 0),
  current_queue_number integer not null default 0,
  created_at           timestamptz not null default now(),
  unique (doctor_id, session_date, start_time)
);

-- Janji Temu / Reservasi Pasien
create table if not exists public.appointments (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique default (
    'APT-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-' ||
    upper(substr(md5(gen_random_uuid()::text), 1, 6))
  ),
  patient_id          uuid not null references public.profiles (id) on delete cascade,
  doctor_id           uuid not null references public.doctors (id),
  session_id          uuid not null references public.practice_sessions (id),
  status              public.transaction_status not null default 'waiting_payment',
  consultation_fee    numeric(12, 0) not null,
  payment_deadline    timestamptz not null,
  payment_proof_path  text,
  payment_uploaded_at timestamptz,
  rejection_reason    text,
  confirmed_at        timestamptz,
  booking_number      integer,
  qr_token            uuid unique,
  checked_in_at       timestamptz,
  queue_number        integer,
  is_no_show          boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (session_id, queue_number)
);

-- Indeks Kinerja Appointments
create unique index if not exists appointments_one_active_per_session
  on public.appointments (patient_id, session_id)
  where status in ('waiting_payment', 'waiting_confirmation', 'done');

create index if not exists appointments_session_idx on public.appointments (session_id);
create index if not exists appointments_patient_idx on public.appointments (patient_id, created_at desc);
create index if not exists appointments_status_idx  on public.appointments (status);

-- Rating & Review Dokter
create table if not exists public.ratings (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  patient_id     uuid not null references public.profiles (id) on delete cascade,
  doctor_id      uuid not null references public.doctors (id) on delete cascade,
  rating         smallint not null check (rating between 1 and 5),
  review         text,
  created_at     timestamptz not null default now()
);

create index if not exists ratings_doctor_idx on public.ratings (doctor_id);

-- Tabel Tambahan Kompatibilitas Express Auth & Treatment
create table if not exists public.users (
  id              varchar(255) primary key,
  email           varchar(255) not null unique,
  full_name       varchar(150) not null,
  password        varchar(255) not null,
  phone_number    varchar(20) not null unique,
  role            public.role not null default 'PATIENT',
  profile_picture varchar(255),
  is_active       boolean not null default true,
  created_at      timestamp not null default now(),
  updated_at      timestamp not null default now()
);

create table if not exists public.treatments (
  id               varchar(255) primary key default gen_random_uuid()::text,
  slug             varchar(150) unique,
  name             varchar(150) not null,
  description      text,
  price            numeric(12, 2) not null,
  duration_minutes integer not null default 60,
  image            varchar(255),
  is_active        boolean not null default true,
  created_at       timestamp not null default now(),
  updated_at       timestamp not null default now()
);

-- View Ringkasan Rating Dokter
create or replace view public.doctor_rating_summary
with (security_invoker = true) as
select
  doctor_id,
  round(avg(rating)::numeric, 1) as rating_avg,
  count(*)::integer              as rating_count
from public.ratings
group by doctor_id;

-- -----------------------------------------------------------------------------
-- 3. TRIGGERS UMUM
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists specialists_updated_at on public.specialists;
create trigger specialists_updated_at before update on public.specialists for each row execute function public.set_updated_at();

drop trigger if exists doctors_updated_at on public.doctors;
create trigger doctors_updated_at before update on public.doctors for each row execute function public.set_updated_at();

drop trigger if exists doctor_schedules_updated_at on public.doctor_schedules;
create trigger doctor_schedules_updated_at before update on public.doctor_schedules for each row execute function public.set_updated_at();

drop trigger if exists appointments_updated_at on public.appointments;
create trigger appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();

-- Trigger pembuatan profil otomatis saat pendaftaran auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, phone_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone_number'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$ begin
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
exception when insufficient_privilege then
  -- Diabaikan jika role postgres tidak memiliki hak trigger langsung pada auth.users
  null;
end $$;

-- Helper role admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. STORED PROCEDURES & RPC ATOMIK
-- -----------------------------------------------------------------------------

-- Renumber bookings
create or replace function public.renumber_bookings(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  with ordered as (
    select id, row_number() over (order by created_at) as new_num
    from public.appointments
    where session_id = p_session_id
      and status in ('waiting_payment', 'waiting_confirmation', 'done')
  )
  update public.appointments a
  set booking_number = o.new_num
  from ordered o
  where a.id = o.id;

  update public.appointments
  set booking_number = null
  where session_id = p_session_id
    and status not in ('waiting_payment', 'waiting_confirmation', 'done')
    and booking_number is not null;
end;
$$;

-- Availability jadwal
create or replace function public.get_availability(p_doctor_id uuid, p_date date)
returns table (
  schedule_id uuid,
  start_time  time,
  end_time    time,
  quota       integer,
  booked      integer,
  remaining   integer,
  available   boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    s.id,
    s.start_time,
    s.end_time,
    coalesce(ps.patient_quota, s.patient_quota) as quota,
    coalesce(b.booked, 0)                       as booked,
    greatest(coalesce(ps.patient_quota, s.patient_quota) - coalesce(b.booked, 0), 0) as remaining,
    (coalesce(ps.patient_quota, s.patient_quota) - coalesce(b.booked, 0)) > 0
      and ((p_date + s.end_time) at time zone 'Asia/Jakarta') > now() as available
  from public.doctor_schedules s
  join public.doctors d on d.id = s.doctor_id and d.is_active
  left join public.practice_sessions ps
    on ps.doctor_id = s.doctor_id
   and ps.session_date = p_date
   and ps.start_time = s.start_time
  left join lateral (
    select count(*)::integer as booked
    from public.appointments a
    where a.session_id = ps.id
      and a.status in ('waiting_payment', 'waiting_confirmation', 'done')
  ) b on true
  where s.doctor_id = p_doctor_id
    and s.day_of_week = extract(dow from p_date)::smallint
    and s.is_active
  order by s.start_time;
$$;

-- Booking Janji Temu (Atomik)
create or replace function public.book_appointment(p_schedule_id uuid, p_date date)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sched        public.doctor_schedules;
  v_doc          public.doctors;
  v_session      public.practice_sessions;
  v_booked_count integer;
  v_new_appt     public.appointments;
begin
  if auth.uid() is null then
    raise exception 'Harus login untuk membuat janji';
  end if;

  select * into v_sched
  from public.doctor_schedules
  where id = p_schedule_id and is_active;

  if not found then
    raise exception 'Jadwal tidak ditemukan atau tidak aktif';
  end if;

  if v_sched.day_of_week <> extract(dow from p_date)::smallint then
    raise exception 'Tanggal tidak sesuai dengan hari praktik dokter';
  end if;

  if p_date < (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Tidak bisa booking tanggal masa lalu';
  end if;

  if ((p_date + v_sched.end_time) at time zone 'Asia/Jakarta') <= now() then
    raise exception 'Sesi praktik untuk jadwal ini sudah berakhir';
  end if;

  select * into v_doc from public.doctors where id = v_sched.doctor_id and is_active;
  if not found then
    raise exception 'Dokter tidak aktif';
  end if;

  insert into public.practice_sessions (
    doctor_id, schedule_id, session_date, start_time, end_time, starts_at, ends_at, patient_quota
  ) values (
    v_sched.doctor_id,
    v_sched.id,
    p_date,
    v_sched.start_time,
    v_sched.end_time,
    (p_date + v_sched.start_time) at time zone 'Asia/Jakarta',
    (p_date + v_sched.end_time)   at time zone 'Asia/Jakarta',
    v_sched.patient_quota
  )
  on conflict (doctor_id, session_date, start_time) do update
    set patient_quota = excluded.patient_quota
  returning * into v_session;

  select * into v_session
  from public.practice_sessions
  where id = v_session.id
  for update;

  if exists (
    select 1 from public.appointments
    where patient_id = auth.uid()
      and session_id = v_session.id
      and status in ('waiting_payment', 'waiting_confirmation', 'done')
  ) then
    raise exception 'Anda sudah punya janji aktif di sesi ini';
  end if;

  select count(*) into v_booked_count
  from public.appointments
  where session_id = v_session.id
    and status in ('waiting_payment', 'waiting_confirmation', 'done');

  if v_booked_count >= v_session.patient_quota then
    raise exception 'Kuota sesi ini sudah penuh';
  end if;

  insert into public.appointments (
    patient_id,
    doctor_id,
    session_id,
    status,
    consultation_fee,
    payment_deadline,
    booking_number
  ) values (
    auth.uid(),
    v_session.doctor_id,
    v_session.id,
    'waiting_payment',
    v_doc.consultation_fee,
    now() + interval '30 minutes',
    v_booked_count + 1
  )
  returning * into v_new_appt;

  return v_new_appt;
end;
$$;

-- Unggah Bukti Bayar Pasien
create or replace function public.submit_payment_proof(p_appointment_id uuid, p_path text)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.appointments;
begin
  if not (p_path like 'data:image/%' or split_part(p_path, '/', 1) = auth.uid()::text) then
    raise exception 'Lokasi atau format file bukti bayar tidak valid';
  end if;

  update public.appointments
  set status = 'waiting_confirmation',
      payment_proof_path = p_path,
      payment_uploaded_at = now()
  where id = p_appointment_id
    and patient_id = auth.uid()
    and status = 'waiting_payment'
    and payment_deadline > now()
  returning * into v_result;

  if not found then
    raise exception 'Batas waktu pembayaran sudah habis atau janji tidak valid';
  end if;

  return v_result;
end;
$$;

-- Batal Janji Pasien
create or replace function public.cancel_appointment(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.appointments;
begin
  update public.appointments
  set status = 'canceled'
  where id = p_appointment_id
    and patient_id = auth.uid()
    and status in ('waiting_payment', 'waiting_confirmation')
  returning * into v_result;

  if not found then
    raise exception 'Janji tidak bisa dibatalkan';
  end if;

  perform public.renumber_bookings(v_result.session_id);
  return v_result;
end;
$$;

-- Rating Janji Temu Selesai
create or replace function public.rate_appointment(
  p_appointment_id uuid,
  p_rating smallint,
  p_review text default null
)
returns public.ratings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_appt    public.appointments;
  v_session public.practice_sessions;
  v_result  public.ratings;
begin
  select * into v_appt
  from public.appointments
  where id = p_appointment_id and patient_id = auth.uid();

  if not found then
    raise exception 'Janji tidak ditemukan';
  end if;

  select * into v_session from public.practice_sessions where id = v_appt.session_id;

  if v_appt.status <> 'done'
     or v_appt.checked_in_at is null
     or (v_appt.queue_number > v_session.current_queue_number and now() < v_session.ends_at) then
    raise exception 'Rating hanya bisa diberikan setelah janji selesai';
  end if;

  insert into public.ratings (appointment_id, patient_id, doctor_id, rating, review)
  values (v_appt.id, v_appt.patient_id, v_appt.doctor_id, p_rating, nullif(trim(p_review), ''))
  returning * into v_result;

  return v_result;
exception
  when unique_violation then
    raise exception 'Anda sudah memberi rating untuk janji ini';
end;
$$;

-- Konfirmasi Pembayaran Admin (Approve)
create or replace function public.approve_appointment(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.appointments;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengonfirmasi pembayaran';
  end if;

  update public.appointments a
  set status = 'done',
      qr_token = gen_random_uuid(),
      confirmed_at = now()
  from public.practice_sessions s
  where a.id = p_appointment_id
    and s.id = a.session_id
    and a.status = 'waiting_confirmation'
    and s.ends_at > now()
  returning a.* into v_result;

  if not found then
    raise exception 'Janji tidak bisa dikonfirmasi (status salah atau sesi sudah selesai)';
  end if;

  return v_result;
end;
$$;

-- Penolakan Pembayaran Admin (Reject)
create or replace function public.reject_appointment(p_appointment_id uuid, p_reason text)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.appointments;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat menolak janji temu';
  end if;

  update public.appointments
  set status = 'rejected',
      rejection_reason = nullif(trim(p_reason), '')
  where id = p_appointment_id
    and status = 'waiting_confirmation'
  returning * into v_result;

  if not found then
    raise exception 'Janji tidak bisa ditolak';
  end if;

  perform public.renumber_bookings(v_result.session_id);
  return v_result;
end;
$$;

-- Check-in QR Kedatangan di Hari H
drop function if exists public.check_in(uuid);
drop function if exists public.check_in(text);

create or replace function public.check_in(p_qr_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_appt         public.appointments;
  v_session      public.practice_sessions;
  v_next         integer;
  v_clean        text;
  v_patient_name text;
  v_doctor_name  text;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat memproses check-in pasien';
  end if;

  v_clean := trim(p_qr_token);
  if position(':' in v_clean) > 0 then
    v_clean := trim(split_part(v_clean, ':', 2));
  end if;

  select a.* into v_appt
  from public.appointments a
  where (case when v_clean ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then a.qr_token = v_clean::uuid
              else false end)
     or a.code = v_clean
     or a.code = trim(p_qr_token);

  if not found then
    raise exception 'QR Token atau Kode Janji Temu tidak dikenali';
  end if;

  select * into v_session
  from public.practice_sessions
  where id = v_appt.session_id
  for update;

  if v_session.session_date <> (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Check-in hanya berlaku pada tanggal sesi (% WIB)', v_session.session_date;
  end if;

  if v_appt.status <> 'done' then
    raise exception 'Janji temu belum dikonfirmasi atau status tidak valid (%)', v_appt.status;
  end if;

  if v_appt.is_no_show then
    raise exception 'Janji temu sudah ditandai tidak hadir (no-show)';
  end if;

  select full_name into v_patient_name from public.profiles where id = v_appt.patient_id;
  select full_name into v_doctor_name  from public.doctors  where id = v_appt.doctor_id;

  -- Idempotent check-in
  if v_appt.checked_in_at is not null and v_appt.queue_number is not null then
    return jsonb_build_object(
      'success', true,
      'is_already_checked_in', true,
      'message', format('Pasien %s sudah check-in sebelumnya pada %s WIB', coalesce(v_patient_name, 'Pasien'), to_char(v_appt.checked_in_at at time zone 'Asia/Jakarta', 'HH24:MI')),
      'appointment_id', v_appt.id,
      'code', v_appt.code,
      'queue_number', v_appt.queue_number,
      'patient_name', coalesce(v_patient_name, 'Pasien'),
      'doctor_name', coalesce(v_doctor_name, 'Dokter'),
      'current_queue_number', v_session.current_queue_number,
      'checked_in_at', v_appt.checked_in_at
    );
  end if;

  select coalesce(max(queue_number), 0) + 1
  into v_next
  from public.appointments
  where session_id = v_session.id
    and checked_in_at is not null;

  update public.appointments
  set checked_in_at = now(),
      queue_number  = v_next
  where id = v_appt.id
  returning * into v_appt;

  return jsonb_build_object(
    'success', true,
    'is_already_checked_in', false,
    'message', format('Check-in berhasil! Nomor antrean kedatangan fisik: #%s', v_next),
    'appointment_id', v_appt.id,
    'code', v_appt.code,
    'queue_number', v_next,
    'patient_name', coalesce(v_patient_name, 'Pasien'),
    'doctor_name', coalesce(v_doctor_name, 'Dokter'),
    'current_queue_number', v_session.current_queue_number,
    'checked_in_at', v_appt.checked_in_at
  );
end;
$$;

-- Panggil Antrean Berikutnya (Call Next)
create or replace function public.call_next(p_session_id uuid)
returns public.practice_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next    integer;
  v_session public.practice_sessions;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat memanggil antrean berikutnya';
  end if;

  select * into v_session from public.practice_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Sesi tidak ditemukan';
  end if;

  select min(queue_number) into v_next
  from public.appointments
  where session_id = p_session_id
    and checked_in_at is not null
    and not is_no_show
    and queue_number > v_session.current_queue_number;

  if v_next is null then
    raise exception 'Tidak ada antrean berikutnya';
  end if;

  update public.practice_sessions
  set current_queue_number = v_next
  where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$$;

-- Tandai Pasien Tidak Hadir (Mark No-Show)
create or replace function public.mark_no_show(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.appointments;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat menandai tidak hadir';
  end if;

  update public.appointments
  set is_no_show = true
  where id = p_appointment_id
    and status = 'done'
    and checked_in_at is null
  returning * into v_result;

  if not found then
    raise exception 'Janji tidak bisa ditandai tidak hadir';
  end if;

  return v_result;
end;
$$;

-- Display Antrean Live TV Ruang Tunggu (/queue)
create or replace function public.get_live_queue()
returns table (
  session_id           uuid,
  doctor_id            uuid,
  doctor_name          text,
  specialist_name      text,
  start_time           time,
  end_time             time,
  current_queue_number integer,
  next_numbers         integer[]
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    s.id,
    d.id,
    d.full_name,
    sp.name,
    s.start_time,
    s.end_time,
    s.current_queue_number,
    coalesce((
      select array_agg(q.queue_number order by q.queue_number)
      from (
        select a.queue_number
        from public.appointments a
        where a.session_id = s.id
          and a.checked_in_at is not null
          and not a.is_no_show
          and a.queue_number > s.current_queue_number
        order by a.queue_number
        limit 3
      ) q
    ), '{}')
  from public.practice_sessions s
  join public.doctors d on d.id = s.doctor_id
  left join public.specialists sp on sp.id = d.specialist_id
  where s.session_date = (now() at time zone 'Asia/Jakarta')::date
  order by s.start_time, d.full_name;
$$;

-- Statistik Laporan Admin (/admin/statistic)
create or replace function public.get_appointment_stats(
  p_period    text,
  p_from      date default null,
  p_to        date default null,
  p_doctor_id uuid default null
)
returns table (
  bucket_date text,
  done        bigint,
  rejected    bigint,
  canceled    bigint,
  expired     bigint,
  revenue     numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    case
      when p_period = 'year'  then to_char(s.session_date, 'YYYY')
      when p_period = 'month' then to_char(s.session_date, 'YYYY-MM')
      else                         to_char(s.session_date, 'YYYY-MM-DD')
    end as bucket_date,
    count(*) filter (where a.status = 'done')     as done,
    count(*) filter (where a.status = 'rejected') as rejected,
    count(*) filter (where a.status = 'canceled') as canceled,
    count(*) filter (where a.status = 'expired')  as expired,
    coalesce(sum(a.consultation_fee) filter (where a.status = 'done'), 0) as revenue
  from public.appointments a
  join public.practice_sessions s on s.id = a.session_id
  where (p_doctor_id is null or a.doctor_id = p_doctor_id)
    and (p_from is null or s.session_date >= p_from)
    and (p_to   is null or s.session_date <= p_to)
  group by 1
  order by 1;
$$;

-- Proses Kedaluwarsa Otomatis
create or replace function public.process_expired_appointments()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expired  uuid[];
  v_canceled uuid[];
  v_id       uuid;
begin
  with e as (
    update public.appointments
    set status = 'expired'
    where status = 'waiting_payment'
      and payment_deadline <= now()
    returning session_id
  )
  select array_agg(distinct session_id) into v_expired from e;

  with c as (
    update public.appointments a
    set status = 'canceled'
    from public.practice_sessions s
    where s.id = a.session_id
      and a.status = 'waiting_confirmation'
      and s.starts_at <= now()
    returning a.session_id
  )
  select array_agg(distinct session_id) into v_canceled from c;

  foreach v_id in array coalesce(v_expired, '{}') || coalesce(v_canceled, '{}') loop
    perform public.renumber_bookings(v_id);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) & STORAGE BUCKETS
-- -----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.specialists       enable row level security;
alter table public.doctors           enable row level security;
alter table public.doctor_schedules  enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.appointments      enable row level security;
alter table public.ratings           enable row level security;

-- profiles
drop policy if exists "profiles: baca milik sendiri atau admin" on public.profiles;
create policy "profiles: baca milik sendiri atau admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: ubah milik sendiri" on public.profiles;
create policy "profiles: ubah milik sendiri"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- specialists
drop policy if exists "specialists: publik baca" on public.specialists;
create policy "specialists: publik baca" on public.specialists for select to anon, authenticated using (true);

drop policy if exists "specialists: admin kelola" on public.specialists;
create policy "specialists: admin kelola" on public.specialists for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- doctors
drop policy if exists "doctors: publik baca" on public.doctors;
create policy "doctors: publik baca" on public.doctors for select to anon, authenticated using (true);

drop policy if exists "doctors: admin kelola" on public.doctors;
create policy "doctors: admin kelola" on public.doctors for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- doctor_schedules
drop policy if exists "schedules: publik baca" on public.doctor_schedules;
create policy "schedules: publik baca" on public.doctor_schedules for select to anon, authenticated using (true);

drop policy if exists "schedules: admin kelola" on public.doctor_schedules;
create policy "schedules: admin kelola" on public.doctor_schedules for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- practice_sessions
drop policy if exists "sessions: publik baca" on public.practice_sessions;
create policy "sessions: publik baca" on public.practice_sessions for select to anon, authenticated using (true);

-- appointments
drop policy if exists "appointments: baca milik sendiri atau admin" on public.appointments;
create policy "appointments: baca milik sendiri atau admin"
  on public.appointments for select to authenticated
  using (patient_id = auth.uid() or public.is_admin());

-- ratings
drop policy if exists "ratings: publik baca" on public.ratings;
create policy "ratings: publik baca" on public.ratings for select to anon, authenticated using (true);

-- Storage buckets
do $$ begin
  insert into storage.buckets (id, name, public) values
    ('avatars',        'avatars',        true),
    ('doctor-photos',  'doctor-photos',  true),
    ('payment-proofs', 'payment-proofs', false)
  on conflict (id) do nothing;
exception when insufficient_privilege or undefined_table then
  null;
end $$;

-- Storage policies
do $$ begin
  drop policy if exists "avatars: upload milik sendiri" on storage.objects;
  create policy "avatars: upload milik sendiri"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

  drop policy if exists "doctor-photos: admin kelola" on storage.objects;
  create policy "doctor-photos: admin kelola"
    on storage.objects for all to authenticated
    using (bucket_id = 'doctor-photos' and public.is_admin())
    with check (bucket_id = 'doctor-photos' and public.is_admin());

  drop policy if exists "payment-proofs: upload milik sendiri" on storage.objects;
  create policy "payment-proofs: upload milik sendiri"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

  drop policy if exists "payment-proofs: baca milik sendiri atau admin" on storage.objects;
  create policy "payment-proofs: baca milik sendiri atau admin"
    on storage.objects for select to authenticated
    using (
      bucket_id = 'payment-proofs'
      and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
    );
exception when insufficient_privilege or undefined_table or undefined_function then
  null;
end $$;

-- -----------------------------------------------------------------------------
-- 6. WIPE & RE-SEED LENGKAP KLINIK ESTETIKA & KECANTIKAN
-- -----------------------------------------------------------------------------
do $$
declare
  v_admin_id       uuid := 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
  v_patient_id     uuid := 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb';
  v_patient_id_p1  uuid := 'bbbbbbbb-2222-2222-2222-bbbbbbbbbb01';
  v_patient_id_2   uuid := 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbb2';
  v_patient_id_p2  uuid := 'bbbbbbbb-2222-2222-2222-bbbbbbbbbb02';
  v_patient_id_3   uuid := 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbb3';
  v_patient_id_p3  uuid := 'bbbbbbbb-2222-2222-2222-bbbbbbbbbb03';

  v_sp_dve         uuid := '11111111-0000-0000-0000-000000000001';
  v_sp_aaam        uuid := '11111111-0000-0000-0000-000000000002';
  v_sp_bpre        uuid := '11111111-0000-0000-0000-000000000003';
  v_sp_laser       uuid := '11111111-0000-0000-0000-000000000004';
  v_sp_hair        uuid := '11111111-0000-0000-0000-000000000005';

  v_doc_maya       uuid := '22222222-0000-0000-0000-000000000001';
  v_doc_gisella    uuid := '22222222-0000-0000-0000-000000000002';
  v_doc_kevin      uuid := '22222222-0000-0000-0000-000000000003';
  v_doc_natasha    uuid := '22222222-0000-0000-0000-000000000004';
  v_doc_amanda     uuid := '22222222-0000-0000-0000-000000000005';
  v_doc_reza       uuid := '22222222-0000-0000-0000-000000000006';

  v_today          date := (now() at time zone 'Asia/Jakarta')::date;
  v_session_today  uuid := gen_random_uuid();
  v_session_today2 uuid := gen_random_uuid();
  v_session_past   uuid := gen_random_uuid();
  v_day_offset     date;
begin

  -- Bersihkan data transaksi dan master
  truncate table 
    public.ratings,
    public.appointments,
    public.practice_sessions,
    public.doctor_schedules,
    public.doctors,
    public.specialists
  cascade;

  -- 1. Master Spesialisasi
  insert into public.specialists (id, name, description) values
    (v_sp_dve, 'Dermatologi, Venereologi & Estetika (Sp.D.V.E)', 'Diagnosis dan terapi medis jerawat aktif, hiperpigmentasi/melasma, dermatitis, serta perbaikan skin barrier rusak.'),
    (v_sp_aaam, 'Dokter Estetika Medik & Anti-Aging (Dipl. AAAM)', 'Peremajaan wajah non-bedah: injeksi botox, dermal filler hyaluronic acid, thread lift (tarik benang), dan skin booster.'),
    (v_sp_bpre, 'Bedah Plastik Rekonstruksi & Estetik (Sp.B.P.R.E)', 'Prosedur kontur estetika wajah, blefaroplasti (kelopak mata), revisi bopeng scar mendalam, dan rekonstruksi estetik.'),
    (v_sp_laser, 'Laser & Kosmetika Kulit (Advanced Laser Energy)', 'Teknologi canggih Pico Laser rejuvenasi, Fractional CO2 bopeng/pori, Yellow Laser vascular kemerahan, dan HIFU lifting.'),
    (v_sp_hair, 'Trikologi & Perawatan Kulit Kepala (Hair & Scalp)', 'Terapi kebotakan, penanganan kerontokan rambut kronis, Platelet-Rich Plasma (PRP) scalp therapy, dan stimulasi folikel.');

  -- 2. Master Dokter
  insert into public.doctors (id, specialist_id, full_name, bio, experience_years, consultation_fee, photo_url, is_active) values
    (v_doc_maya, v_sp_dve, 'dr. Maya Lestari, Sp.D.V.E, FINSDV', 'Spesialis Dermatologi & Venereologi lulusan Universitas Indonesia dengan fellowship Aesthetic Dermatology di Seoul. Berpengalaman 12 tahun menangani acne vulgaris derajat berat, melasma, dan rejuvenasi skin barrier.', 12, 250000, 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400', true),
    (v_doc_gisella, v_sp_aaam, 'dr. Gisella Valerie, Dipl. AAAM', 'Dokter estetika bersertifikasi American Academy of Aesthetic Medicine. Ahli dalam facial contouring alami, lip filler harmonisasi proporsi wajah, dan biostimulator kolagen.', 8, 180000, 'https://images.unsplash.com/photo-1594824813589-39f5c2eb7162?auto=format&fit=crop&q=80&w=400', true),
    (v_doc_kevin, v_sp_bpre, 'dr. Kevin Prasetya, Sp.B.P.R.E', 'Spesialis Bedah Plastik Rekonstruksi & Estetik. Fokus klinis pada bedah estetika minimal invasif, revisi scar atrofi mendalam pasca jerawat, dan blefaroplasti presisi tinggi.', 15, 350000, 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400', true),
    (v_doc_natasha, v_sp_laser, 'dr. Natasha Wijaya, M.Biomed (AAM)', 'Magister Biomedik Anti-Aging Medicine dengan keahlian khusus kombinasi modalitas Laser Q-Switched Nd:YAG, Pico Laser, dan Focused Ultrasound (HIFU) untuk pigmentasi dan pori-pori.', 7, 200000, 'https://images.unsplash.com/photo-1623854767648-e7bb8009f0db?auto=format&fit=crop&q=80&w=400', true),
    (v_doc_amanda, v_sp_dve, 'dr. Amanda Clarissa, Sp.D.V.E', 'Dermatovenereologis berdedikasi tinggi dengan keahlian terapi peradangan kulit sensitif, eczema, rosacea, dan chemical peeling medis terkontrol untuk mencerahkan kulit kusam.', 9, 220000, 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&q=80&w=400', true),
    (v_doc_reza, v_sp_hair, 'dr. Reza Mahendra, Dipl. CIBTAC, AAAM', 'Praktisi estetika medis & trikologi. Ahli dalam penanganan kerontokan rambut androgenik, terapi mikroneedling scalp, serta protokol eksosom regeneratif rambut.', 6, 175000, 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400', true);

  -- 3. Master Jadwal Mingguan Dokter
  insert into public.doctor_schedules (doctor_id, day_of_week, start_time, end_time, patient_quota, is_active) values
    (v_doc_maya, 1, '09:00', '13:00', 12, true),
    (v_doc_maya, 2, '14:00', '18:00', 15, true),
    (v_doc_maya, 3, '09:00', '13:00', 12, true),
    (v_doc_maya, 5, '13:00', '17:00', 15, true),
    (v_doc_maya, 0, '10:00', '14:00', 10, true),
    (v_doc_gisella, 0, '09:00', '13:00', 10, true),
    (v_doc_gisella, 2, '10:00', '15:00', 12, true),
    (v_doc_gisella, 4, '14:00', '18:00', 12, true),
    (v_doc_gisella, 6, '10:00', '15:00', 15, true),
    (v_doc_kevin, 1, '10:00', '14:00', 8, true),
    (v_doc_kevin, 4, '09:00', '13:00', 8, true),
    (v_doc_kevin, 6, '13:00', '17:00', 10, true),
    (v_doc_natasha, 2, '09:00', '13:00', 15, true),
    (v_doc_natasha, 3, '13:00', '17:00', 15, true),
    (v_doc_natasha, 5, '09:00', '14:00', 15, true),
    (v_doc_amanda, 1, '13:00', '17:00', 12, true),
    (v_doc_amanda, 2, '09:00', '13:00', 12, true),
    (v_doc_amanda, 5, '10:00', '15:00', 12, true),
    (v_doc_reza, 3, '10:00', '14:00', 10, true),
    (v_doc_reza, 4, '10:00', '14:00', 10, true),
    (v_doc_reza, 6, '14:00', '18:00', 12, true);

  -- 4. Akun Demo (Auth & Profile)
  -- A. Admin Utama
  delete from auth.users where id = v_admin_id or email = 'admin@klinik.test';
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
    'admin@klinik.test', crypt('Admin123!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin Utama Klinik Estetika","phone_number":"081234567890"}'::jsonb,
    now(), now()
  );

  insert into public.profiles (id, role, full_name, phone_number)
  values (v_admin_id, 'admin', 'Admin Utama Klinik Estetika', '081234567890')
  on conflict (id) do update set role = 'admin', full_name = 'Admin Utama Klinik Estetika';

  -- B. Pasien Demo Budi (pasien@klinik.test & pasien1@klinik.test)
  delete from auth.users where id in (v_patient_id, v_patient_id_p1) or email in ('pasien@klinik.test', 'pasien1@klinik.test');
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values 
    ('00000000-0000-0000-0000-000000000000', v_patient_id, 'authenticated', 'authenticated',
     'pasien@klinik.test', crypt('Pasien123!', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Budi Pasien Demo","phone_number":"08123456789"}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_patient_id_p1, 'authenticated', 'authenticated',
     'pasien1@klinik.test', crypt('Pasien123!', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Budi Pasien Satu Demo","phone_number":"081234567801"}'::jsonb, now(), now());

  insert into public.profiles (id, role, full_name, phone_number)
  values 
    (v_patient_id, 'patient', 'Budi Pasien Demo', '08123456789'),
    (v_patient_id_p1, 'patient', 'Budi Pasien Satu Demo', '081234567801')
  on conflict (id) do update set role = 'patient', full_name = excluded.full_name;

  -- C. Pasien Demo Siti (siti@klinik.test & pasien2@klinik.test)
  delete from auth.users where id in (v_patient_id_2, v_patient_id_p2) or email in ('siti@klinik.test', 'pasien2@klinik.test');
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values 
    ('00000000-0000-0000-0000-000000000000', v_patient_id_2, 'authenticated', 'authenticated',
     'siti@klinik.test', crypt('Pasien123!', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Siti Rahayu","phone_number":"08129988776"}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_patient_id_p2, 'authenticated', 'authenticated',
     'pasien2@klinik.test', crypt('Pasien123!', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Siti Rahayu (Pasien 2)","phone_number":"081234567802"}'::jsonb, now(), now());

  insert into public.profiles (id, role, full_name, phone_number)
  values 
    (v_patient_id_2, 'patient', 'Siti Rahayu', '08129988776'),
    (v_patient_id_p2, 'patient', 'Siti Rahayu (Pasien 2)', '081234567802')
  on conflict (id) do update set role = 'patient', full_name = excluded.full_name;

  -- D. Pasien Demo Ahmad (ahmad@klinik.test & pasien3@klinik.test)
  delete from auth.users where id in (v_patient_id_3, v_patient_id_p3) or email in ('ahmad@klinik.test', 'pasien3@klinik.test');
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values 
    ('00000000-0000-0000-0000-000000000000', v_patient_id_3, 'authenticated', 'authenticated',
     'ahmad@klinik.test', crypt('Pasien123!', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Ahmad Fauzi","phone_number":"08137788990"}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', v_patient_id_p3, 'authenticated', 'authenticated',
     'pasien3@klinik.test', crypt('Pasien123!', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"full_name":"Ahmad Fauzi (Pasien 3)","phone_number":"081234567803"}'::jsonb, now(), now());

  insert into public.profiles (id, role, full_name, phone_number)
  values 
    (v_patient_id_3, 'patient', 'Ahmad Fauzi', '08137788990'),
    (v_patient_id_p3, 'patient', 'Ahmad Fauzi (Pasien 3)', '081234567803')
  on conflict (id) do update set role = 'patient', full_name = excluded.full_name;

  -- Sinkronkan ke tabel public.users untuk autentikasi Express lokal
  insert into public.users (id, email, full_name, phone_number, password, role, is_active) values
    (v_admin_id::text, 'admin@klinik.test', 'Admin Utama Klinik Estetika', '081234567890', crypt('Admin123!', gen_salt('bf')), 'ADMIN', true),
    (v_patient_id::text, 'pasien@klinik.test', 'Budi Pasien Demo', '08123456789', crypt('Pasien123!', gen_salt('bf')), 'PATIENT', true),
    (v_patient_id_p1::text, 'pasien1@klinik.test', 'Budi Pasien Satu Demo', '081234567801', crypt('Pasien123!', gen_salt('bf')), 'PATIENT', true),
    (v_patient_id_2::text, 'siti@klinik.test', 'Siti Rahayu', '08129988776', crypt('Pasien123!', gen_salt('bf')), 'PATIENT', true),
    (v_patient_id_p2::text, 'pasien2@klinik.test', 'Siti Rahayu (Pasien 2)', '081234567802', crypt('Pasien123!', gen_salt('bf')), 'PATIENT', true),
    (v_patient_id_3::text, 'ahmad@klinik.test', 'Ahmad Fauzi', '08137788990', crypt('Pasien123!', gen_salt('bf')), 'PATIENT', true),
    (v_patient_id_p3::text, 'pasien3@klinik.test', 'Ahmad Fauzi (Pasien 3)', '081234567803', crypt('Pasien123!', gen_salt('bf')), 'PATIENT', true)
  on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

  -- 5. Sesi Praktik Hari Ini & 7 Hari ke Depan
  -- Sesi Hari Ini 1 (dr. Maya Lestari)
  insert into public.practice_sessions (
    id, doctor_id, session_date, start_time, end_time, starts_at, ends_at, patient_quota, current_queue_number
  ) values (
    v_session_today, v_doc_maya, v_today, '08:00', '23:00',
    (v_today + time '08:00') at time zone 'Asia/Jakarta',
    (v_today + time '23:00') at time zone 'Asia/Jakarta',
    15, 1
  ) on conflict (doctor_id, session_date, start_time) do update set
    patient_quota = 15;

  -- Sesi Hari Ini 2 (dr. Gisella Valerie)
  insert into public.practice_sessions (
    id, doctor_id, session_date, start_time, end_time, starts_at, ends_at, patient_quota, current_queue_number
  ) values (
    v_session_today2, v_doc_gisella, v_today, '09:00', '23:00',
    (v_today + time '09:00') at time zone 'Asia/Jakarta',
    (v_today + time '23:00') at time zone 'Asia/Jakarta',
    12, 0
  ) on conflict (doctor_id, session_date, start_time) do update set
    patient_quota = 12;

  -- Generate sesi untuk 7 hari ke depan
  for i in 1..7 loop
    v_day_offset := v_today + i;
    insert into public.practice_sessions (
      doctor_id, session_date, start_time, end_time, starts_at, ends_at, patient_quota
    )
    select 
      ds.doctor_id,
      v_day_offset,
      ds.start_time,
      ds.end_time,
      (v_day_offset + ds.start_time) at time zone 'Asia/Jakarta',
      (v_day_offset + ds.end_time) at time zone 'Asia/Jakarta',
      ds.patient_quota
    from public.doctor_schedules ds
    where ds.day_of_week = extract(dow from v_day_offset)::integer
    on conflict (doctor_id, session_date, start_time) do nothing;
  end loop;

  -- Sesi Masa Lalu (14 hari lalu) untuk riwayat & grafik
  insert into public.practice_sessions (
    id, doctor_id, session_date, start_time, end_time, starts_at, ends_at, patient_quota, current_queue_number
  ) values (
    v_session_past, v_doc_maya, v_today - 14, '09:00', '13:00',
    (v_today - 14 + time '09:00') at time zone 'Asia/Jakarta',
    (v_today - 14 + time '13:00') at time zone 'Asia/Jakarta',
    12, 2
  ) on conflict (doctor_id, session_date, start_time) do nothing;

  -- 6. Sampel Janji Temu Terverifikasi
  -- A. Janji Hari Ini #1: Siti Rahayu (Status: done, sudah check-in, nomor antrean #1 sedang dilayani)
  insert into public.appointments (
    id, code, patient_id, doctor_id, session_id, status, consultation_fee,
    payment_deadline, confirmed_at, booking_number, qr_token, checked_in_at, queue_number
  ) values (
    '55555555-0000-0000-0000-000000000001', 'APT-BEAUTY-001',
    v_patient_id_2, v_doc_maya, v_session_today, 'done', 250000,
    now() + interval '30 minutes', now() - interval '2 hours', 1,
    '99999999-0000-0000-0000-000000000001', now() - interval '30 minutes', 1
  );

  -- B. Janji Hari Ini #2: Ahmad Fauzi (Status: waiting_confirmation untuk admin /admin/payment)
  insert into public.appointments (
    id, code, patient_id, doctor_id, session_id, status, consultation_fee,
    payment_deadline, payment_proof_path, payment_uploaded_at, booking_number
  ) values (
    '55555555-0000-0000-0000-000000000002', 'APT-BEAUTY-002',
    v_patient_id_3, v_doc_maya, v_session_today, 'waiting_confirmation', 250000,
    now() + interval '20 minutes',
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><rect width="300" height="150" fill="%23e0e7ff"/><text x="20" y="50" font-family="sans-serif" font-size="14" fill="%231e1b4b" font-weight="bold">Bukti Transfer Bank BCA</text><text x="20" y="80" font-family="sans-serif" font-size="12" fill="%234338ca">Nominal: Rp 250.000</text><text x="20" y="110" font-family="sans-serif" font-size="11" fill="%236366f1">Klinik Kecantikan Arhe</text></svg>',
    now() - interval '10 minutes', 2
  );

  -- C. Janji Hari Ini #3: Pasien Budi Demo (Status: done, memiliki QR Token aktif, BELUM check-in)
  -- Siap di-scan di scanner admin (QR: 99999999-0000-0000-0000-000000000003)
  insert into public.appointments (
    id, code, patient_id, doctor_id, session_id, status, consultation_fee,
    payment_deadline, confirmed_at, booking_number, qr_token
  ) values (
    '55555555-0000-0000-0000-000000000003', 'APT-BEAUTY-003',
    v_patient_id, v_doc_maya, v_session_today, 'done', 250000,
    now() + interval '30 minutes', now() - interval '1 hour', 3,
    '99999999-0000-0000-0000-000000000003'
  );

  -- D. Janji Masa Lalu: Pasien Budi Demo (Status: done, sudah selesai, memiliki review bintang 5)
  insert into public.appointments (
    id, code, patient_id, doctor_id, session_id, status, consultation_fee,
    payment_deadline, confirmed_at, booking_number, checked_in_at, queue_number
  ) values (
    '55555555-0000-0000-0000-000000000004', 'APT-BEAUTY-PAST',
    v_patient_id, v_doc_maya, v_session_past, 'done', 250000,
    now() - interval '14 days', now() - interval '14 days', 1,
    now() - interval '14 days', 1
  );

  insert into public.ratings (
    appointment_id, patient_id, doctor_id, rating, review, created_at
  ) values (
    '55555555-0000-0000-0000-000000000004', v_patient_id, v_doc_maya, 5,
    'Konsultasi masalah jerawat dan rekomendasi acne peeling dari dr. Maya sangat tepat sasaran. Wajah jauh lebih bersih dan skin barrier kembali sehat!',
    now() - interval '14 days'
  );

  -- 7. Katalog Master Perawatan Kecantikan (Treatments)
  insert into public.treatments (id, slug, name, description, price, duration_minutes, is_active) values
    (gen_random_uuid()::text, 'acne-dermapeel', 'Acne Dermapeel', 'Pengelupasan kimia medis terkontrol untuk mengangkat sel kulit mati, meredakan peradangan jerawat, dan membuka pori tersumbat.', 400000, 60, true),
    (gen_random_uuid()::text, 'ipl-acne', 'IPL Acne Therapy', 'Terapi Intense Pulsed Light untuk membunuh bakteri P. acnes, mengurangi kemerahan bekas jerawat, dan menekan produksi sebum berlebih.', 550000, 45, true),
    (gen_random_uuid()::text, 'acne-laser-co2', 'Fractional CO2 Laser Scar', 'Teknologi laser ablatif fraksional untuk menstimulasi regenerasi kolagen baru, meratakan tekstur bopeng scar jerawat, dan mengecilkan pori.', 1800000, 75, true),
    (gen_random_uuid()::text, 'acne-facial', 'Acne Clarifying Facial', 'Perawatan ekstraksi komedo higienis dengan uap ozon, masker purifying tea tree, dan terapi High Frequency anti-bakterial.', 250000, 60, true),
    (gen_random_uuid()::text, 'brightening-facial', 'Radiance Brightening Facial', 'Facial eksfoliasi lembut dengan serum vitamin kompleks, pemijatan lymphatic drainage wajah, dan masker pencerah botanical.', 300000, 60, true),
    (gen_random_uuid()::text, 'glow-peeling', 'Korean Glass Skin Peeling', 'Kombinasi asam laktat dan AHA konsentrasi rendah untuk menghasilkan kilau instan tanpa pengelupasan berlebihan (zero downtime).', 350000, 45, true),
    (gen_random_uuid()::text, 'vitamin-c-infusion', 'High-Dose Vitamin C Infusion', 'Penghantaran antioksidan vitamin C murni ke lapisan dermis menggunakan teknologi iontophoresis / elektroporasi ultrasound.', 450000, 45, true),
    (gen_random_uuid()::text, 'anti-aging-facial', 'Collagen Lift Anti-Aging Facial', 'Perawatan intensif hidrasi peptida kolagen, stimulasi microcurrent wajah, dan serum penyamar garis halus ekspresi.', 400000, 60, true),
    (gen_random_uuid()::text, 'skin-booster', 'Hyaluronic Acid Skin Booster', 'Injeksi mikro asam hialuronat murni untuk hidrasi mendalam, elastisitas tinggi, dan perbaikan tekstur kulit kusam dari dalam.', 1500000, 45, true),
    (gen_random_uuid()::text, 'rf-lifting', 'Radiofrequency V-Shape Lifting', 'Energi termal gelombang radio untuk mengencangkan kulit kendur di area pipi, garis rahang, serta meniruskan double chin non-invasif.', 1200000, 60, true),
    (gen_random_uuid()::text, 'hair-treatment', 'Hair Fall Defense Therapy', 'Pembersihan mendalam kulit kepala dari sebum, stimulasi folikel rambut dengan serum biostimulan dan sinar LED inframerah.', 350000, 50, true),
    (gen_random_uuid()::text, 'laser-hair-removal', 'Laser Hair Removal Underarm', 'Penghilangan bulu permanen tanpa rasa sakit menggunakan teknologi diode laser berpendingin es.', 600000, 30, true),
    (gen_random_uuid()::text, 'body-slimming', 'Cavitation Fat Slimming', 'Ultrasound kavitasi untuk memecah sel lemak subkutan membandel di area perut atau paha dengan drainase limfatik.', 500000, 60, true),
    (gen_random_uuid()::text, 'body-contouring', 'RF Body Contouring & Tightening', 'Pengencangan kulit tubuh pasca penurunan berat badan dan perataan selulit dengan radiofrequency multipolar.', 1500000, 60, true)
  on conflict (slug) do update set price = excluded.price, name = excluded.name;

end $$;


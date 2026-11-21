-- Dr. Lakshmi Skin & Hair Clinic: database schema (PostgreSQL / Supabase).
-- Apply with `npm run db:migrate` or `supabase db push`. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Settings (single rows)
-- ---------------------------------------------------------------------------

create table if not exists app_settings (
  id                  smallint primary key default 1 check (id = 1),
  auto_confirm_online boolean not null default false,
  doctor_cap_lakshmi  integer not null default 25  check (doctor_cap_lakshmi between 1 and 1000),
  doctor_cap_others   integer not null default 100 check (doctor_cap_others between 1 and 1000),
  token_seq           integer not null default 0   check (token_seq >= 0)
);

-- Public contact details and content switches, edited from the admin portal.
create table if not exists site_settings (
  id                  smallint primary key default 1 check (id = 1),
  phone               text not null default '',
  phone_display       text not null default '',
  whatsapp_number     text not null default '',
  email               text not null default '',
  address_line1       text not null default '',
  address_line2       text not null default '',
  pincode             text not null default '',
  working_hours       text not null default '',
  closed_day          text not null default '',
  facebook_url        text not null default '',
  instagram_url       text not null default '',
  x_url               text not null default '',
  youtube_url         text not null default '',
  google_maps_url     text not null default '',
  google_review_url   text not null default '',
  google_rating       numeric(2,1) check (google_rating between 1 and 5),
  google_review_count integer check (google_review_count >= 0),
  trust_stats         jsonb not null default '[]'::jsonb
);

-- ---------------------------------------------------------------------------
-- Catalogue: appointment types, time slots, doctors, treatments
-- ---------------------------------------------------------------------------

create table if not exists appointment_types (
  id          text primary key,
  name        text not null,
  description text not null default '',
  active      boolean not null default true,
  sort_order  integer not null default 0
);
create unique index if not exists appointment_types_name_key on appointment_types (lower(name));

create table if not exists time_slots (
  id         text primary key,
  name       text not null,
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time   text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  capacity   integer not null default 25 check (capacity between 1 and 500),
  active     boolean not null default true,
  check (end_time > start_time)
);
create unique index if not exists time_slots_times_key on time_slots (start_time, end_time);

-- Per-date limit or closure for one slot ("2026-11-24_09:00").
create table if not exists slot_overrides (
  slot_key text primary key,
  capacity integer check (capacity between 1 and 500),
  disabled boolean not null default false
);

create table if not exists blocked_dates (
  date   date primary key,
  reason text not null
);

create table if not exists doctors (
  id             text primary key,
  name           text not null,
  qualification  text not null default '',
  designation    text not null default '',
  reg_no         text not null default '',
  experience     integer not null default 0 check (experience between 0 and 60),
  specialization text[] not null default '{}',
  bio            text not null default '',
  message        text not null default '',
  image          text not null default '',
  is_senior      boolean not null default false,
  published      boolean not null default true,
  sort_order     integer not null default 0
);
create unique index if not exists doctors_name_key on doctors (lower(name));
create unique index if not exists doctors_one_senior on doctors (is_senior) where is_senior;

create table if not exists treatments (
  id            text primary key,
  slug          text not null unique,
  name          text not null,
  image         text not null default '',
  subcategories text[] not null default '{}',
  published     boolean not null default true,
  sort_order    integer not null default 0
);
create unique index if not exists treatments_name_key on treatments (lower(name));

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------

-- Gap-free appointment numbers per year (APT-2026-001, ...).
create table if not exists appointment_counters (
  year integer primary key,
  last integer not null default 0
);

create table if not exists appointments (
  id               text primary key,
  token            uuid not null unique default gen_random_uuid(),
  date             date not null,
  start_time       text not null,
  end_time         text not null,
  full_name        text not null,
  phone            text not null,
  email            text,
  age              integer check (age between 1 and 120),
  gender           text check (gender in ('MALE', 'FEMALE', 'OTHER')),
  patient_type     text not null default 'NEW' check (patient_type in ('NEW', 'FOLLOW_UP')),
  type_id          text,
  type_name        text,
  kind             text not null default 'CONSULTATION' check (kind in ('CONSULTATION', 'TREATMENT')),
  doctor_id        text,
  doctor_name      text,
  doctor_group     text check (doctor_group in ('LAKSHMI', 'OTHERS')),
  treatment_id     text,
  treatment_name   text,
  persons          integer not null default 1 check (persons between 1 and 20),
  notes            text,
  status           text not null default 'PENDING' check (status in ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  cancel_reason    text,
  cancelled_by     text check (cancelled_by in ('ADMIN', 'PATIENT')),
  needs_attention  boolean not null default false,
  attention_reason text,
  reminder_sent    boolean not null default false,
  reschedule_count integer not null default 0 check (reschedule_count >= 0),
  token_number     integer unique check (token_number > 0),
  completed_at     timestamptz,
  source           text not null default 'ONLINE' check (source in ('ONLINE', 'ADMIN')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists appointments_date_idx    on appointments (date, start_time);
create index if not exists appointments_phone_idx   on appointments (phone, date desc);
create index if not exists appointments_status_idx  on appointments (status, date);
create index if not exists appointments_created_idx on appointments (created_at desc);
-- Backstop for the application rule: one person cannot hold two live bookings in the same slot.
create unique index if not exists appointments_no_duplicate_live
  on appointments (phone, lower(full_name), date, start_time) where status in ('PENDING', 'CONFIRMED');

-- Everything that happened to an appointment (replaces the old in-record history).
create table if not exists appointment_events (
  id             bigint generated always as identity primary key,
  appointment_id text not null references appointments (id) on delete cascade,
  at             timestamptz not null default now(),
  kind           text not null,
  from_status    text,
  to_status      text,
  actor          text not null,
  note           text,
  changes        jsonb
);
create index if not exists appointment_events_appointment_idx on appointment_events (appointment_id, at);
create index if not exists appointment_events_at_idx on appointment_events (at);

-- ---------------------------------------------------------------------------
-- Audit, messages, abuse protection
-- ---------------------------------------------------------------------------

create table if not exists audit_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  actor     text not null,
  action    text not null,
  entity_id text,
  summary   text not null
);
create index if not exists audit_log_at_idx on audit_log (at desc);

-- One row per message the app tried to send, so failures are visible to staff.
create table if not exists message_log (
  id                  bigint generated always as identity primary key,
  at                  timestamptz not null default now(),
  appointment_id      text,
  audience            text not null default 'PATIENT',
  event               text not null,
  channel             text not null default 'WHATSAPP',
  recipient_masked    text not null,
  status              text not null check (status in ('SENT', 'FAILED', 'SKIPPED')),
  error               text,
  provider_message_id text
);
create index if not exists message_log_at_idx on message_log (at desc);

create table if not exists login_failures (
  client   text primary key,
  count    integer not null default 0,
  first_at timestamptz not null default now()
);

create table if not exists rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------------
-- Admin accounts
-- ---------------------------------------------------------------------------

create table if not exists admin_users (
  id              uuid primary key default gen_random_uuid(),
  username        text not null,
  password_hash   text not null,
  role            text not null default 'STAFF' check (role in ('OWNER', 'STAFF')),
  active          boolean not null default true,
  session_version integer not null default 1,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz
);
create unique index if not exists admin_users_username_key on admin_users (lower(username));

-- ---------------------------------------------------------------------------
-- Website content managed from the admin portal
-- ---------------------------------------------------------------------------

create table if not exists gallery_items (
  id         text primary key,
  title      text not null,
  category   text not null default '',
  image      text not null,
  sort_order integer not null default 0,
  published  boolean not null default true
);

create table if not exists testimonials (
  id                text primary key,
  name              text not null,
  treatment         text not null default '',
  quote             text not null,
  rating            integer check (rating between 1 and 5),
  consent_confirmed boolean not null default false,
  published         boolean not null default false,
  sort_order        integer not null default 0,
  -- a testimonial can only go live once the patient's written consent is recorded
  check (not published or consent_confirmed)
);

create table if not exists faqs (
  id         text primary key,
  question   text not null,
  answer     text not null,
  sort_order integer not null default 0,
  published  boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Security: the app talks to the database with its own server-side connection.
-- Row Level Security with no policies means the public Supabase API keys (anon /
-- authenticated) cannot read or write any of these tables.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  r text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('alter default privileges in schema public revoke all on tables from %I', r);
      execute format('alter default privileges in schema public revoke all on sequences from %I', r);
    end if;
  end loop;
end $$;

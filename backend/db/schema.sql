create table if not exists users (
  id            serial primary key,
  email         text not null,
  password_hash text not null,
  full_name     text not null,
  phone         text,
  role          text not null default 'patient' check (role in ('patient', 'doctor', 'admin')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create unique index if not exists users_email_unique on users (lower(email));

create table if not exists specialties (
  id   serial primary key,
  name text not null unique
);

create table if not exists doctors (
  id             serial primary key,
  user_id        int not null unique references users (id) on delete cascade,
  specialty_id   int not null references specialties (id),
  license_number text not null unique,
  slot_minutes   int not null check (slot_minutes in (30, 45)),
  bio            text,
  active         boolean not null default true
);

create table if not exists availability_windows (
  id        serial primary key,
  doctor_id int not null references doctors (id) on delete cascade,
  weekday   int not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at   time not null,
  check (starts_at < ends_at)
);

create index if not exists availability_doctor_day_idx
  on availability_windows (doctor_id, weekday);

create table if not exists appointments (
  id            serial primary key,
  patient_id    int not null references users (id),
  doctor_id     int not null references doctors (id),
  starts_at     timestamp not null,
  ends_at       timestamp not null,
  status        text not null default 'booked'
                check (status in ('booked', 'attended', 'no_show', 'cancelled')),
  reason        varchar(200),
  cancelled_by  int references users (id),
  cancel_reason text,
  created_at    timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists appointments_doctor_start_idx
  on appointments (doctor_id, starts_at);

create index if not exists appointments_patient_start_idx
  on appointments (patient_id, starts_at);

create index if not exists appointments_start_idx
  on appointments (starts_at);

create unique index if not exists appointments_no_double_booking
  on appointments (doctor_id, starts_at)
  where status = 'booked';

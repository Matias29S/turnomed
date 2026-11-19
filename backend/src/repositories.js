import { pool, transaction } from './db.js';

const db = (client) => client ?? pool;

const APPOINTMENT_COLUMNS = `
  a.id,
  a.patient_id,
  a.doctor_id,
  to_char(a.starts_at, 'YYYY-MM-DD"T"HH24:MI') as starts_at,
  to_char(a.ends_at, 'YYYY-MM-DD"T"HH24:MI') as ends_at,
  a.status,
  a.reason,
  a.cancel_reason
`;

// RETURNING no admite el alias de la tabla usado en los SELECT.
const APPOINTMENT_RETURNING = `
  id,
  patient_id,
  doctor_id,
  to_char(starts_at, 'YYYY-MM-DD"T"HH24:MI') as starts_at,
  to_char(ends_at, 'YYYY-MM-DD"T"HH24:MI') as ends_at,
  status,
  reason,
  cancel_reason
`;

export const users = {
  async findByEmail(email, client) {
    const { rows } = await db(client).query(
      `select id, email, password_hash, full_name, phone, role, active
       from users where email = $1`,
      [email],
    );
    return rows[0] ?? null;
  },

  async findById(id, client, options = {}) {
    const lock = options.forUpdate ? 'for update' : '';
    const { rows } = await db(client).query(
      `select id, email, full_name, phone, role, active
       from users where id = $1 ${lock}`,
      [id],
    );
    return rows[0] ?? null;
  },

  async create({ email, passwordHash, fullName, phone, role }, client) {
    const { rows } = await db(client).query(
      `insert into users (email, password_hash, full_name, phone, role)
       values ($1, $2, $3, $4, $5)
       returning id, email, full_name, phone, role`,
      [email, passwordHash, fullName, phone ?? null, role],
    );
    return rows[0];
  },

  async listAll(client) {
    const { rows } = await db(client).query(
      `select id, email, full_name, phone, role, active, created_at
       from users order by created_at desc limit 200`,
    );
    return rows;
  },
};

export const specialties = {
  async list(client) {
    const { rows } = await db(client).query('select id, name from specialties order by name');
    return rows;
  },

  async create(name, client) {
    const { rows } = await db(client).query(
      'insert into specialties (name) values ($1) returning id, name',
      [name],
    );
    return rows[0];
  },
};

export const doctors = {
  async findActiveById(id, client, options = {}) {
    const lock = options.forUpdate ? 'for update' : '';
    const { rows } = await db(client).query(
      `select d.id, d.user_id, d.specialty_id, d.license_number, d.slot_minutes, d.active,
              u.full_name, s.name as specialty
       from doctors d
       join users u on u.id = d.user_id
       join specialties s on s.id = d.specialty_id
       where d.id = $1 and d.active = true ${lock}`,
      [id],
    );
    return rows[0] ?? null;
  },

  async findByUserId(userId, client) {
    const { rows } = await db(client).query(
      `select id, user_id, specialty_id, license_number, slot_minutes, active
       from doctors where user_id = $1`,
      [userId],
    );
    return rows[0] ?? null;
  },

  async listBySpecialty(specialtyId, client) {
    const params = [];
    let filter = 'where d.active = true';
    if (specialtyId) {
      params.push(specialtyId);
      filter += ` and d.specialty_id = $${params.length}`;
    }
    const { rows } = await db(client).query(
      `select d.id, u.full_name, d.license_number, d.slot_minutes, s.name as specialty
       from doctors d
       join users u on u.id = d.user_id
       join specialties s on s.id = d.specialty_id
       ${filter}
       order by u.full_name`,
      params,
    );
    return rows;
  },

  async create({ userId, specialtyId, licenseNumber, slotMinutes, bio }, client) {
    const { rows } = await db(client).query(
      `insert into doctors (user_id, specialty_id, license_number, slot_minutes, bio)
       values ($1, $2, $3, $4, $5)
       returning id, user_id, specialty_id, license_number, slot_minutes`,
      [userId, specialtyId, licenseNumber, slotMinutes, bio ?? null],
    );
    return rows[0];
  },
};

export const availability = {
  async listByDoctor(doctorId, client) {
    const { rows } = await db(client).query(
      `select id, weekday, to_char(starts_at, 'HH24:MI') as start, to_char(ends_at, 'HH24:MI') as "end"
       from availability_windows
       where doctor_id = $1
       order by weekday, starts_at`,
      [doctorId],
    );
    return rows;
  },

  async listByDoctorWeekday(doctorId, weekday, client) {
    const { rows } = await db(client).query(
      `select to_char(starts_at, 'HH24:MI') as start, to_char(ends_at, 'HH24:MI') as "end"
       from availability_windows
       where doctor_id = $1 and weekday = $2
       order by starts_at`,
      [doctorId, weekday],
    );
    return rows;
  },

  async create({ doctorId, weekday, start, end }, client) {
    const { rows } = await db(client).query(
      `insert into availability_windows (doctor_id, weekday, starts_at, ends_at)
       values ($1, $2, $3::time, $4::time)
       returning id, weekday, to_char(starts_at, 'HH24:MI') as start, to_char(ends_at, 'HH24:MI') as "end"`,
      [doctorId, weekday, start, end],
    );
    return rows[0];
  },

  async remove(id, doctorId, client) {
    const { rowCount } = await db(client).query(
      'delete from availability_windows where id = $1 and doctor_id = $2',
      [id, doctorId],
    );
    return rowCount > 0;
  },
};

export const appointments = {
  async create(client, { patientId, doctorId, startsAt, endsAt, reason }) {
    const { rows } = await client.query(
      `insert into appointments (patient_id, doctor_id, starts_at, ends_at, reason)
       values ($1, $2, $3::timestamp, $4::timestamp, $5)
       returning ${APPOINTMENT_RETURNING}`,
      [patientId, doctorId, startsAt, endsAt, reason ?? null],
    );
    return rows[0];
  },

  async findById(id, client) {
    const { rows } = await db(client).query(
      `select ${APPOINTMENT_COLUMNS} from appointments a where a.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  },

  async countActiveByPatient(patientId, client) {
    const { rows } = await db(client).query(
      `select count(*)::int as total from appointments
       where patient_id = $1 and status = 'booked'`,
      [patientId],
    );
    return rows[0].total;
  },

  async findOverlappingForDoctor(client, doctorId, startsAt, endsAt, excludeId = null) {
    const { rows } = await db(client).query(
      `select id from appointments
       where doctor_id = $1 and status = 'booked'
         and starts_at < $3::timestamp and ends_at > $2::timestamp
         and ($4::int is null or id <> $4)
       limit 1`,
      [doctorId, startsAt, endsAt, excludeId],
    );
    return rows[0] ?? null;
  },

  async findOverlappingForPatient(client, patientId, startsAt, endsAt, excludeId = null) {
    const { rows } = await db(client).query(
      `select id from appointments
       where patient_id = $1 and status = 'booked'
         and starts_at < $3::timestamp and ends_at > $2::timestamp
         and ($4::int is null or id <> $4)
       limit 1`,
      [patientId, startsAt, endsAt, excludeId],
    );
    return rows[0] ?? null;
  },

  async listActiveByDoctorRange(doctorId, from, to, client) {
    const { rows } = await db(client).query(
      `select id,
              to_char(starts_at, 'YYYY-MM-DD"T"HH24:MI') as start,
              to_char(ends_at, 'YYYY-MM-DD"T"HH24:MI') as "end"
       from appointments
       where doctor_id = $1 and status = 'booked'
         and starts_at >= $2::timestamp and starts_at < $3::timestamp`,
      [doctorId, from, to],
    );
    return rows;
  },

  async listByPatient(patientId, client) {
    const { rows } = await db(client).query(
      `select ${APPOINTMENT_COLUMNS},
              u.full_name as doctor_name, s.name as specialty
       from appointments a
       join doctors d on d.id = a.doctor_id
       join users u on u.id = d.user_id
       join specialties s on s.id = d.specialty_id
       where a.patient_id = $1
       order by a.starts_at desc`,
      [patientId],
    );
    return rows;
  },

  async listByDoctorRange(doctorId, from, to, client) {
    const { rows } = await db(client).query(
      `select ${APPOINTMENT_COLUMNS}, u.full_name as patient_name, u.phone as patient_phone
       from appointments a
       join users u on u.id = a.patient_id
       where a.doctor_id = $1
         and a.starts_at >= $2::timestamp and a.starts_at < $3::timestamp
       order by a.starts_at`,
      [doctorId, from, to],
    );
    return rows;
  },

  async cancel(client, id, userId, reason) {
    const { rows } = await client.query(
      `update appointments
       set status = 'cancelled', cancelled_by = $2, cancel_reason = $3
       where id = $1 and status = 'booked'
       returning ${APPOINTMENT_RETURNING}`,
      [id, userId, reason ?? null],
    );
    return rows[0] ?? null;
  },

  async reschedule(client, id, startsAt, endsAt) {
    const { rows } = await client.query(
      `update appointments
       set starts_at = $2::timestamp, ends_at = $3::timestamp
       where id = $1 and status = 'booked'
       returning ${APPOINTMENT_RETURNING}`,
      [id, startsAt, endsAt],
    );
    return rows[0] ?? null;
  },

  async updateStatus(client, id, status) {
    const { rows } = await client.query(
      `update appointments set status = $2
       where id = $1 and status = 'booked'
       returning ${APPOINTMENT_RETURNING}`,
      [id, status],
    );
    return rows[0] ?? null;
  },
};

export const metrics = {
  async summary(from, to, client) {
    const { rows } = await db(client).query(
      `select
         count(*)::int as total,
         count(*) filter (where status = 'attended')::int as attended,
         count(*) filter (where status = 'cancelled')::int as cancelled,
         count(*) filter (where status = 'no_show')::int as no_show
       from appointments
       where starts_at >= $1::timestamp and starts_at < $2::timestamp`,
      [from, to],
    );
    return rows[0];
  },
};

export const repo = {
  users,
  specialties,
  doctors,
  availability,
  appointments,
  metrics,
  transaction,
};

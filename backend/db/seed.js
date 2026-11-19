import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const adminEmail = (process.env.INITIAL_ADMIN_EMAIL ?? 'admin@turnomed.local').toLowerCase();
const isProduction = process.env.NODE_ENV === 'production';
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || (isProduction ? null : 'Admin1234');
const doctorPassword = process.env.INITIAL_DOCTOR_PASSWORD || (isProduction ? null : 'Doctor1234');

if (!adminPassword || !doctorPassword) {
  console.error(
    'En producción hay que definir INITIAL_ADMIN_PASSWORD e INITIAL_DOCTOR_PASSWORD.',
  );
  process.exit(1);
}

const specialties = ['Clínica médica', 'Pediatría', 'Dermatología'];

const doctors = [
  {
    fullName: 'Dra. Laura Gómez',
    email: 'laura.gomez@turnomed.local',
    specialty: 'Clínica médica',
    license: 'MP-1001',
    slotMinutes: 30,
    windows: [
      [1, '09:00', '13:00'],
      [3, '09:00', '13:00'],
      [5, '14:00', '18:00'],
    ],
  },
  {
    fullName: 'Dr. Martín Paz',
    email: 'martin.paz@turnomed.local',
    specialty: 'Pediatría',
    license: 'MP-1002',
    slotMinutes: 45,
    windows: [
      [2, '08:00', '12:00'],
      [4, '14:00', '19:00'],
    ],
  },
  {
    fullName: 'Dra. Sofía Ríos',
    email: 'sofia.rios@turnomed.local',
    specialty: 'Dermatología',
    license: 'MP-1003',
    slotMinutes: 30,
    windows: [
      [1, '14:00', '18:00'],
      [2, '14:00', '18:00'],
      [4, '09:00', '12:00'],
    ],
  },
];

const { rows: existing } = await pool.query('select count(*)::int as total from users');

if (existing[0].total > 0) {
  console.log('La base ya tiene usuarios. No se cargan datos de ejemplo.');
  await pool.end();
  process.exit(0);
}

const client = await pool.connect();

try {
  await client.query('BEGIN');

  const adminHash = await bcrypt.hash(adminPassword, 12);
  await client.query(
    `insert into users (email, password_hash, full_name, role)
     values ($1, $2, $3, 'admin')`,
    [adminEmail, adminHash, 'Administración TurnoMed'],
  );

  const specialtyIds = new Map();
  for (const name of specialties) {
    const { rows } = await client.query(
      'insert into specialties (name) values ($1) returning id',
      [name],
    );
    specialtyIds.set(name, rows[0].id);
  }

  for (const doctor of doctors) {
    const hash = await bcrypt.hash(doctorPassword, 12);
    const { rows: userRows } = await client.query(
      `insert into users (email, password_hash, full_name, role)
       values ($1, $2, $3, 'doctor') returning id`,
      [doctor.email, hash, doctor.fullName],
    );

    const { rows: doctorRows } = await client.query(
      `insert into doctors (user_id, specialty_id, license_number, slot_minutes)
       values ($1, $2, $3, $4) returning id`,
      [userRows[0].id, specialtyIds.get(doctor.specialty), doctor.license, doctor.slotMinutes],
    );

    for (const [weekday, start, end] of doctor.windows) {
      await client.query(
        `insert into availability_windows (doctor_id, weekday, starts_at, ends_at)
         values ($1, $2, $3::time, $4::time)`,
        [doctorRows[0].id, weekday, start, end],
      );
    }
  }

  await client.query('COMMIT');
  console.log('Datos iniciales cargados.');
  console.log(`Admin: ${adminEmail}`);
  console.log(
    'Médicos: laura.gomez@turnomed.local, martin.paz@turnomed.local, sofia.rios@turnomed.local',
  );
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Error al cargar los datos:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeRepo } from './helpers/fake-repo.js';
import { createAppointmentsService } from '../src/services/appointments.service.js';

const MONDAY = new Date('2026-11-16T08:00:00');

async function setup() {
  const { repo, state } = createFakeRepo();

  const specialty = await repo.specialties.create('Clínica médica');

  const patient = await repo.users.create({
    email: 'paciente@test.com',
    passwordHash: 'x',
    fullName: 'Paciente Uno',
    role: 'patient',
  });

  const otherPatient = await repo.users.create({
    email: 'otro@test.com',
    passwordHash: 'x',
    fullName: 'Paciente Dos',
    role: 'patient',
  });

  const doctorUser = await repo.users.create({
    email: 'medica@test.com',
    passwordHash: 'x',
    fullName: 'Dra. Laura Gómez',
    role: 'doctor',
  });

  const doctor = await repo.doctors.create({
    userId: doctorUser.id,
    specialtyId: specialty.id,
    licenseNumber: 'MP-1001',
    slotMinutes: 30,
  });

  const doctorUser2 = await repo.users.create({
    email: 'medico2@test.com',
    passwordHash: 'x',
    fullName: 'Dr. Martín Paz',
    role: 'doctor',
  });

  const doctor2 = await repo.doctors.create({
    userId: doctorUser2.id,
    specialtyId: specialty.id,
    licenseNumber: 'MP-1002',
    slotMinutes: 30,
  });

  for (const doctorId of [doctor.id, doctor2.id]) {
    await repo.availability.create({ doctorId, weekday: 1, start: '09:00', end: '12:00' });
    await repo.availability.create({ doctorId, weekday: 3, start: '09:00', end: '12:00' });
  }

  let current = MONDAY;
  const service = createAppointmentsService({ repo, clock: () => current });

  return {
    repo,
    state,
    service,
    patient,
    otherPatient,
    doctor,
    doctor2,
    doctorUser,
    setNow: (value) => {
      current = value;
    },
  };
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `Se esperaba ${code} y llegó ${error.code}: ${error.message}`);
    return true;
  });
}

test('reserva una franja libre y calcula el fin con la duración del médico', async () => {
  const { service, patient, doctor } = await setup();

  const appointment = await service.book({
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt: '2026-11-18T09:00',
  });

  assert.equal(appointment.status, 'booked');
  assert.equal(appointment.starts_at, '2026-11-18T09:00');
  assert.equal(appointment.ends_at, '2026-11-18T09:30');
});

test('rechaza la doble reserva de la misma franja', async () => {
  const { service, patient, otherPatient, doctor } = await setup();

  await service.book({ patientId: patient.id, doctorId: doctor.id, startsAt: '2026-11-18T09:00' });

  await expectCode(
    service.book({ patientId: otherPatient.id, doctorId: doctor.id, startsAt: '2026-11-18T09:00' }),
    'SLOT_TAKEN',
  );
});

test('limita al paciente a dos turnos activos', async () => {
  const { service, patient, doctor } = await setup();

  await service.book({ patientId: patient.id, doctorId: doctor.id, startsAt: '2026-11-18T09:00' });
  await service.book({ patientId: patient.id, doctorId: doctor.id, startsAt: '2026-11-18T10:00' });

  await expectCode(
    service.book({ patientId: patient.id, doctorId: doctor.id, startsAt: '2026-11-18T11:00' }),
    'MAX_ACTIVE',
  );
});

test('impide que el paciente tenga dos turnos a la misma hora con médicos distintos', async () => {
  const { service, patient, doctor, doctor2 } = await setup();

  await service.book({ patientId: patient.id, doctorId: doctor.id, startsAt: '2026-11-18T09:00' });

  await expectCode(
    service.book({ patientId: patient.id, doctorId: doctor2.id, startsAt: '2026-11-18T09:00' }),
    'PATIENT_OVERLAP',
  );
});

test('rechaza una franja fuera de la disponibilidad del médico', async () => {
  const { service, patient, doctor } = await setup();

  await expectCode(
    service.book({ patientId: patient.id, doctorId: doctor.id, startsAt: '2026-11-18T13:00' }),
    'SLOT_OUTSIDE_AVAILABILITY',
  );
});

test('rechaza reservar con menos de 60 minutos de anticipación', async () => {
  const { service, patient, doctor } = await setup();

  await expectCode(
    service.book({ patientId: patient.id, doctorId: doctor.id, startsAt: '2026-11-16T08:30' }),
    'TOO_SOON',
  );
});

test('el paciente cancela con más de 24 horas y la franja queda libre', async () => {
  const { service, patient, doctor } = await setup();

  const appointment = await service.book({
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt: '2026-11-18T09:00',
  });

  const cancelled = await service.cancel({
    appointmentId: appointment.id,
    user: { id: patient.id, role: 'patient' },
  });

  assert.equal(cancelled.status, 'cancelled');

  const again = await service.book({
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt: '2026-11-18T09:00',
  });
  assert.equal(again.status, 'booked');
});

test('el paciente no puede cancelar con menos de 24 horas', async () => {
  const { service, patient, doctor, setNow } = await setup();

  const appointment = await service.book({
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt: '2026-11-18T09:00',
  });

  setNow(new Date('2026-11-17T10:00:00'));

  await expectCode(
    service.cancel({ appointmentId: appointment.id, user: { id: patient.id, role: 'patient' } }),
    'CANCEL_TOO_LATE',
  );
});

test('el médico cancela con motivo obligatorio', async () => {
  const { service, patient, doctor, doctorUser } = await setup();

  const appointment = await service.book({
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt: '2026-11-18T09:00',
  });

  await expectCode(
    service.cancel({ appointmentId: appointment.id, user: { id: doctorUser.id, role: 'doctor' } }),
    'INVALID_REASON',
  );

  const cancelled = await service.cancel({
    appointmentId: appointment.id,
    user: { id: doctorUser.id, role: 'doctor' },
    reason: 'El médico se ausentó',
  });

  assert.equal(cancelled.status, 'cancelled');
});

test('reprograma a otra franja libre del mismo médico', async () => {
  const { service, patient, doctor } = await setup();

  const appointment = await service.book({
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt: '2026-11-18T09:00',
  });

  const moved = await service.reschedule({
    appointmentId: appointment.id,
    userId: patient.id,
    startsAt: '2026-11-18T10:00',
  });

  assert.equal(moved.starts_at, '2026-11-18T10:00');
  assert.equal(moved.ends_at, '2026-11-18T10:30');
  assert.equal(moved.status, 'booked');
});

test('no reprograma a la misma franja que ya tiene', async () => {
  const { service, patient, doctor } = await setup();

  const appointment = await service.book({
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt: '2026-11-18T09:00',
  });

  await expectCode(
    service.reschedule({
      appointmentId: appointment.id,
      userId: patient.id,
      startsAt: '2026-11-18T09:00',
    }),
    'SAME_SLOT',
  );
});

test('no reprograma a una franja ya ocupada', async () => {
  const { service, patient, otherPatient, doctor } = await setup();

  const first = await service.book({
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt: '2026-11-18T09:00',
  });

  await service.book({
    patientId: otherPatient.id,
    doctorId: doctor.id,
    startsAt: '2026-11-18T10:00',
  });

  await expectCode(
    service.reschedule({
      appointmentId: first.id,
      userId: patient.id,
      startsAt: '2026-11-18T10:00',
    }),
    'SLOT_TAKEN',
  );
});

test('no se puede marcar asistencia antes del inicio', async () => {
  const { service, patient, doctor, doctorUser, setNow } = await setup();

  const appointment = await service.book({
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt: '2026-11-18T09:00',
  });

  setNow(new Date('2026-11-18T08:30:00'));

  await expectCode(
    service.markStatus({ appointmentId: appointment.id, userId: doctorUser.id, status: 'attended' }),
    'NOT_STARTED',
  );
});

test('el médico marca el turno como atendido', async () => {
  const { service, patient, doctor, doctorUser, setNow } = await setup();

  const appointment = await service.book({
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt: '2026-11-18T09:00',
  });

  setNow(new Date('2026-11-18T09:10:00'));

  const attended = await service.markStatus({
    appointmentId: appointment.id,
    userId: doctorUser.id,
    status: 'attended',
  });

  assert.equal(attended.status, 'attended');
});

test('no se puede marcar un turno cancelado', async () => {
  const { service, patient, doctor, doctorUser } = await setup();

  const appointment = await service.book({
    patientId: patient.id,
    doctorId: doctor.id,
    startsAt: '2026-11-18T09:00',
  });

  await service.cancel({ appointmentId: appointment.id, user: { id: patient.id, role: 'patient' } });

  await expectCode(
    service.markStatus({ appointmentId: appointment.id, userId: doctorUser.id, status: 'attended' }),
    'FINAL_STATE',
  );
});

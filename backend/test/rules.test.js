import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCanCancel,
  assertCanReschedule,
  assertSlotDuration,
  assertSlotInAvailability,
  assertTransition,
  assertWithinBookingWindow,
  validateWindows,
} from '../src/domain/rules.js';

const NOW = new Date('2026-11-20T08:00:00');

test('permite reservar dentro de la ventana de 60 minutos a 60 días', () => {
  assert.doesNotThrow(() =>
    assertWithinBookingWindow('2026-11-20T09:00', NOW),
  );
});

test('rechaza una reserva con menos de 60 minutos de anticipación', () => {
  assert.throws(() => assertWithinBookingWindow('2026-11-20T08:30', NOW), /60 minutos/);
});

test('rechaza una reserva con más de 60 días de anticipación', () => {
  assert.throws(() => assertWithinBookingWindow('2027-02-01T09:00', NOW), /60 días/);
});

test('el paciente puede cancelar con 24 horas o más', () => {
  assert.doesNotThrow(() =>
    assertCanCancel({ role: 'patient', startsAt: '2026-11-21T08:00', now: NOW }),
  );
});

test('el paciente no puede cancelar con menos de 24 horas', () => {
  assert.throws(
    () => assertCanCancel({ role: 'patient', startsAt: '2026-11-21T07:59', now: NOW }),
    /24 horas/,
  );
});

test('el médico debe indicar un motivo para cancelar', () => {
  assert.throws(
    () => assertCanCancel({ role: 'doctor', startsAt: '2026-11-20T09:00', now: NOW }),
    /motivo/i,
  );

  assert.doesNotThrow(() =>
    assertCanCancel({
      role: 'doctor',
      startsAt: '2026-11-20T09:00',
      now: NOW,
      reason: 'El médico se ausentó',
    }),
  );
});

test('el administrador puede cancelar en cualquier momento con motivo', () => {
  assert.doesNotThrow(() =>
    assertCanCancel({
      role: 'admin',
      startsAt: '2026-11-20T08:30',
      now: NOW,
      reason: 'Cierre del consultorio',
    }),
  );
});

test('solo el paciente puede reprogramar', () => {
  assert.throws(
    () => assertCanReschedule({ role: 'doctor', startsAt: '2026-11-25T09:00', now: NOW }),
    /Solo el paciente/,
  );
});

test('el paciente no puede reprogramar con menos de 24 horas', () => {
  assert.throws(
    () => assertCanReschedule({ role: 'patient', startsAt: '2026-11-20T20:00', now: NOW }),
    /24 horas/,
  );
});

test('no se puede marcar asistencia antes del inicio', () => {
  assert.throws(
    () =>
      assertTransition({
        from: 'booked',
        to: 'attended',
        role: 'doctor',
        startsAt: '2026-11-20T09:00',
        now: NOW,
      }),
    /antes del inicio/,
  );
});

test('el médico puede marcar asistencia después del inicio', () => {
  assert.doesNotThrow(() =>
    assertTransition({
      from: 'booked',
      to: 'attended',
      role: 'doctor',
      startsAt: '2026-11-20T09:00',
      now: new Date('2026-11-20T09:30:00'),
    }),
  );
});

test('un estado final no puede volver a abrirse', () => {
  assert.throws(
    () =>
      assertTransition({
        from: 'cancelled',
        to: 'attended',
        role: 'doctor',
        startsAt: '2026-11-20T09:00',
        now: new Date('2026-11-20T10:00:00'),
      }),
    /cerrado/,
  );
});

test('solo el médico puede marcar la asistencia', () => {
  assert.throws(
    () =>
      assertTransition({
        from: 'booked',
        to: 'attended',
        role: 'patient',
        startsAt: '2026-11-20T09:00',
        now: new Date('2026-11-20T10:00:00'),
      }),
    /Solo el médico/,
  );
});

test('rechaza ventanas de disponibilidad superpuestas', () => {
  assert.throws(
    () =>
      validateWindows(
        [
          { start: '09:00', end: '12:00' },
          { start: '11:00', end: '13:00' },
        ],
        30,
      ),
    /superponerse/,
  );
});

test('rechaza una ventana más corta que un turno', () => {
  assert.throws(
    () => validateWindows([{ start: '09:00', end: '09:20' }], 30),
    /al menos 30 minutos/,
  );
});

test('la franja debe caer dentro de la disponibilidad y alineada a la grilla', () => {
  const windows = [{ start: '09:00', end: '12:00' }];

  assert.doesNotThrow(() =>
    assertSlotInAvailability({ windows, startsAt: new Date('2026-11-20T09:00'), durationMin: 30 }),
  );

  assert.throws(
    () =>
      assertSlotInAvailability({ windows, startsAt: new Date('2026-11-20T09:10'), durationMin: 30 }),
    /disponibilidad/,
  );

  assert.throws(
    () =>
      assertSlotInAvailability({ windows, startsAt: new Date('2026-11-20T11:45'), durationMin: 30 }),
    /disponibilidad/,
  );
});

test('la duración solo puede ser de 30 o 45 minutos', () => {
  assert.doesNotThrow(() => assertSlotDuration(30));
  assert.doesNotThrow(() => assertSlotDuration(45));
  assert.throws(() => assertSlotDuration(60), /30 o 45/);
});

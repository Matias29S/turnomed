import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSlots } from '../src/domain/slots.js';

const NOW = new Date('2026-11-20T08:00:00');
const DATE = '2026-11-20';
const base = { date: DATE, now: NOW, minLeadMinutes: 0 };

test('devuelve las franjas libres de una ventana', () => {
  const slots = buildSlots({
    ...base,
    windows: [{ start: '09:00', end: '10:00' }],
    busy: [],
    durationMin: 30,
  });

  assert.deepEqual(
    slots.map((slot) => slot.time),
    ['09:00', '09:30'],
  );
});

test('descarta la franja ocupada al final de la ventana', () => {
  const slots = buildSlots({
    ...base,
    windows: [{ start: '09:00', end: '10:00' }],
    busy: [{ start: '2026-11-20T09:30', end: '2026-11-20T10:00' }],
    durationMin: 30,
  });

  assert.deepEqual(
    slots.map((slot) => slot.time),
    ['09:00'],
  );
});

test('descarta todas las franjas si el turno cae en el medio', () => {
  const slots = buildSlots({
    ...base,
    windows: [{ start: '09:00', end: '10:00' }],
    busy: [{ start: '2026-11-20T09:15', end: '2026-11-20T09:45' }],
    durationMin: 30,
  });

  assert.deepEqual(slots, []);
});

test('permite una franja que empieza justo cuando termina un turno', () => {
  const slots = buildSlots({
    ...base,
    windows: [{ start: '09:00', end: '10:30' }],
    busy: [{ start: '2026-11-20T10:00', end: '2026-11-20T10:30' }],
    durationMin: 30,
  });

  assert.deepEqual(
    slots.map((slot) => slot.time),
    ['09:00', '09:30'],
  );
});

test('no devuelve franjas que ya pasaron', () => {
  const slots = buildSlots({
    ...base,
    now: new Date('2026-11-20T09:20:00'),
    windows: [{ start: '09:00', end: '10:00' }],
    busy: [],
    durationMin: 30,
  });

  assert.deepEqual(
    slots.map((slot) => slot.time),
    ['09:30'],
  );
});

test('no duplica franjas cuando las ventanas se superponen', () => {
  const slots = buildSlots({
    ...base,
    windows: [
      { start: '09:00', end: '10:00' },
      { start: '09:30', end: '10:30' },
    ],
    busy: [],
    durationMin: 30,
  });

  assert.deepEqual(
    slots.map((slot) => slot.time),
    ['09:00', '09:30', '10:00'],
  );
});

test('respeta la anticipación mínima de 60 minutos', () => {
  const slots = buildSlots({
    ...base,
    now: new Date('2026-11-20T09:00:00'),
    minLeadMinutes: 60,
    windows: [{ start: '09:00', end: '11:00' }],
    busy: [],
    durationMin: 30,
  });

  assert.deepEqual(
    slots.map((slot) => slot.time),
    ['10:00', '10:30'],
  );
});

test('calcula franjas de 45 minutos', () => {
  const slots = buildSlots({
    ...base,
    windows: [{ start: '09:00', end: '10:30' }],
    busy: [],
    durationMin: 45,
  });

  assert.deepEqual(
    slots.map((slot) => slot.time),
    ['09:00', '09:45'],
  );
});

test('no devuelve franjas más allá de los 60 días', () => {
  const slots = buildSlots({
    ...base,
    date: '2027-02-01',
    windows: [{ start: '09:00', end: '12:00' }],
    busy: [],
    durationMin: 30,
  });

  assert.deepEqual(slots, []);
});

test('rechaza una duración inválida', () => {
  assert.throws(
    () =>
      buildSlots({
        ...base,
        windows: [{ start: '09:00', end: '10:00' }],
        busy: [],
        durationMin: 0,
      }),
    /duración/i,
  );
});

test('rechaza una fecha inválida', () => {
  assert.throws(
    () =>
      buildSlots({
        ...base,
        date: '2026-13-40',
        windows: [],
        busy: [],
        durationMin: 30,
      }),
    /fecha/i,
  );
});

import { AppError } from './errors.js';
import { formatNaive, parseNaive } from './time.js';
import { MAX_DAYS_AHEAD, MIN_LEAD_MINUTES, overlaps, toMinutes, toTime } from './rules.js';

/**
 * Calcula las franjas libres de un médico para un día.
 * Función pura: no toca la base ni el reloj del sistema.
 */
export function buildSlots({
  windows,
  busy,
  durationMin,
  date,
  now,
  minLeadMinutes = MIN_LEAD_MINUTES,
  maxDaysAhead = MAX_DAYS_AHEAD,
}) {
  if (!Number.isInteger(durationMin) || durationMin <= 0) {
    throw new AppError(400, 'INVALID_DURATION', 'La duración del turno no es válida');
  }

  const dayStart = parseNaive(`${date}T00:00`);
  if (!dayStart) {
    throw new AppError(400, 'INVALID_DATE', 'La fecha no es válida');
  }

  const earliest = new Date(now.getTime() + minLeadMinutes * 60000);
  const latest = new Date(now.getTime() + maxDaysAhead * 86400000);

  const taken = (busy ?? [])
    .filter((item) => typeof item.start === 'string' && item.start.startsWith(date))
    .map((item) => [toMinutes(item.start.slice(11, 16)), toMinutes(item.end.slice(11, 16))]);

  const slots = new Map();

  for (const window of windows ?? []) {
    const from = toMinutes(window.start);
    const to = toMinutes(window.end);

    for (let minute = from; minute + durationMin <= to; minute += durationMin) {
      const startsAt = new Date(dayStart.getTime() + minute * 60000);

      if (startsAt < earliest || startsAt > latest) {
        continue;
      }

      const blocked = taken.some(([start, end]) =>
        overlaps(minute, minute + durationMin, start, end),
      );

      if (!blocked) {
        slots.set(minute, { time: toTime(minute), startsAt: formatNaive(startsAt) });
      }
    }
  }

  return [...slots.values()].sort((a, b) => a.time.localeCompare(b.time));
}

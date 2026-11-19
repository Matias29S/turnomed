import { AppError } from './errors.js';

export const MIN_LEAD_MINUTES = 60;
export const MAX_DAYS_AHEAD = 60;
export const CANCEL_LIMIT_HOURS = 24;
export const MAX_ACTIVE_APPOINTMENTS = 2;
export const ALLOWED_SLOT_MINUTES = [30, 45];
export const MIN_CANCEL_REASON = 5;
export const MAX_CANCEL_REASON = 200;
export const MAX_REASON = 200;

export function toMinutes(hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

export function toTime(total) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

export function assertWithinBookingWindow(startsAt, now, options = {}) {
  const minLead = options.minLeadMinutes ?? MIN_LEAD_MINUTES;
  const maxDays = options.maxDaysAhead ?? MAX_DAYS_AHEAD;
  const start = new Date(startsAt);

  if (Number.isNaN(start.getTime())) {
    throw new AppError(400, 'INVALID_DATETIME', 'La fecha y hora del turno no es válida');
  }

  const diff = start.getTime() - now.getTime();

  if (diff < minLead * 60000) {
    throw new AppError(
      400,
      'TOO_SOON',
      `El turno debe reservarse con al menos ${minLead} minutos de anticipación`,
    );
  }

  if (diff > maxDays * 86400000) {
    throw new AppError(
      400,
      'TOO_FAR',
      `No se puede reservar con más de ${maxDays} días de anticipación`,
    );
  }
}

export function assertCanCancel({ role, startsAt, now, reason }) {
  if (role === 'patient') {
    const diff = new Date(startsAt).getTime() - now.getTime();
    if (diff < CANCEL_LIMIT_HOURS * 3600000) {
      throw new AppError(
        409,
        'CANCEL_TOO_LATE',
        `Solo se puede cancelar con ${CANCEL_LIMIT_HOURS} horas o más de anticipación`,
      );
    }
    return;
  }

  if (role === 'doctor' || role === 'admin') {
    const text = typeof reason === 'string' ? reason.trim() : '';
    if (text.length < MIN_CANCEL_REASON || text.length > MAX_CANCEL_REASON) {
      throw new AppError(
        400,
        'INVALID_REASON',
        `El motivo debe tener entre ${MIN_CANCEL_REASON} y ${MAX_CANCEL_REASON} caracteres`,
      );
    }
    return;
  }

  throw new AppError(403, 'FORBIDDEN', 'No tenés permiso para cancelar este turno');
}

export function assertCanReschedule({ role, startsAt, now }) {
  if (role !== 'patient') {
    throw new AppError(403, 'FORBIDDEN', 'Solo el paciente puede reprogramar su turno');
  }

  const diff = new Date(startsAt).getTime() - now.getTime();
  if (diff < CANCEL_LIMIT_HOURS * 3600000) {
    throw new AppError(
      409,
      'RESCHEDULE_TOO_LATE',
      `Solo se puede reprogramar con ${CANCEL_LIMIT_HOURS} horas o más de anticipación`,
    );
  }
}

export function assertTransition({ from, to, role, startsAt, now }) {
  if (from !== 'booked') {
    throw new AppError(409, 'FINAL_STATE', 'El turno ya está cerrado y no puede cambiar de estado');
  }

  if (to === 'cancelled') {
    return;
  }

  if (to !== 'attended' && to !== 'no_show') {
    throw new AppError(400, 'INVALID_STATUS', 'Estado de turno inválido');
  }

  if (role !== 'doctor') {
    throw new AppError(403, 'FORBIDDEN', 'Solo el médico puede marcar la asistencia');
  }

  if (now.getTime() < new Date(startsAt).getTime()) {
    throw new AppError(409, 'NOT_STARTED', 'No se puede marcar la asistencia antes del inicio del turno');
  }
}

export function validateWindows(windows, slotMinutes) {
  for (const window of windows) {
    const from = toMinutes(window.start);
    const to = toMinutes(window.end);

    if (!(from < to)) {
      throw new AppError(400, 'INVALID_WINDOW', 'La hora de inicio debe ser anterior a la de fin');
    }

    if (to - from < slotMinutes) {
      throw new AppError(
        400,
        'WINDOW_TOO_SHORT',
        `La ventana debe durar al menos ${slotMinutes} minutos`,
      );
    }
  }

  for (let i = 0; i < windows.length; i += 1) {
    for (let j = i + 1; j < windows.length; j += 1) {
      const a = windows[i];
      const b = windows[j];
      if (overlaps(toMinutes(a.start), toMinutes(a.end), toMinutes(b.start), toMinutes(b.end))) {
        throw new AppError(409, 'WINDOW_OVERLAP', 'Las ventanas de disponibilidad no pueden superponerse');
      }
    }
  }
}

export function assertSlotInAvailability({ windows, startsAt, durationMin }) {
  const start = new Date(startsAt);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = startMin + durationMin;

  const fits = windows.some((window) => {
    const from = toMinutes(window.start);
    const to = toMinutes(window.end);
    return startMin >= from && endMin <= to && (startMin - from) % durationMin === 0;
  });

  if (!fits) {
    throw new AppError(409, 'SLOT_OUTSIDE_AVAILABILITY', 'La franja elegida no está dentro de la disponibilidad del médico');
  }
}

export function assertSlotDuration(minutes) {
  if (!ALLOWED_SLOT_MINUTES.includes(minutes)) {
    throw new AppError(400, 'INVALID_DURATION', 'La duración del turno debe ser de 30 o 45 minutos');
  }
}

const pad = (value) => String(value).padStart(2, '0');

/**
 * Fecha y hora "de pared" del centro médico.
 * Devuelve un Date cuyos getters locales representan la hora del consultorio,
 * así todas las comparaciones se hacen sobre la misma línea de tiempo.
 */
export function clinicNow(timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const get = (type) => Number(parts.find((part) => part.type === type).value);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

export function formatNaive(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

export function parseNaive(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

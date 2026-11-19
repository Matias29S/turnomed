import { useEffect, useState } from 'react';
import { addDays, api, formatDateTime, today } from '../api.js';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const STATUS_LABELS = {
  booked: 'Reservado',
  attended: 'Atendido',
  no_show: 'Ausente',
  cancelled: 'Cancelado',
};

export default function DoctorAgenda() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(addDays(today(), 7));
  const [items, setItems] = useState([]);
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ weekday: '1', start: '09:00', end: '13:00' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadAgenda() {
    try {
      setItems(await api.get(`/api/doctor/agenda?from=${from}&to=${to}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadWindows() {
    try {
      setWindows(await api.get('/api/doctor/availability'));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadAgenda();
  }, [from, to]);

  useEffect(() => {
    loadWindows();
  }, []);

  async function markStatus(id, status) {
    setError('');
    setMessage('');

    try {
      await api.patch(`/api/doctor/appointments/${id}/status`, { status });
      setMessage('Turno actualizado.');
      loadAgenda();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancelAppointment(item) {
    const reason = window.prompt('Motivo de la cancelación (entre 5 y 200 caracteres):');

    if (reason === null) return;

    setError('');
    setMessage('');

    try {
      await api.patch(`/api/doctor/appointments/${item.id}/cancel`, { reason });
      setMessage('Turno cancelado.');
      loadAgenda();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addWindow(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.post('/api/doctor/availability', {
        weekday: Number(form.weekday),
        start: form.start,
        end: form.end,
      });
      setMessage('Disponibilidad agregada.');
      loadWindows();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeWindow(id) {
    try {
      await api.del(`/api/doctor/availability/${id}`);
      loadWindows();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h1>Mi agenda</h1>

        <div className="filters">
          <label>
            Desde
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>

        {loading && <p className="muted">Cargando agenda…</p>}
        {!loading && items.length === 0 && <p className="muted">No hay turnos en ese rango.</p>}

        <ul className="list">
          {items.map((item) => (
            <li key={item.id} className="appointment">
              <div>
                <strong>{formatDateTime(item.starts_at)} hs</strong>
                <span className="muted">{item.patient_name}</span>
                {item.patient_phone && <span className="muted">Tel: {item.patient_phone}</span>}
                {item.reason && <span className="muted">Motivo: {item.reason}</span>}
              </div>

              <div className="appointment-actions">
                <span className={`badge ${item.status}`}>{STATUS_LABELS[item.status]}</span>
                {item.status === 'booked' && (
                  <>
                    <button type="button" onClick={() => markStatus(item.id, 'attended')}>
                      Atendido
                    </button>
                    <button type="button" className="ghost" onClick={() => markStatus(item.id, 'no_show')}>
                      No asistió
                    </button>
                    <button type="button" className="danger" onClick={() => cancelAppointment(item)}>
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>Mi disponibilidad</h2>
        <p className="muted">Las ventanas definen en qué días y horarios se pueden reservar turnos.</p>

        <ul className="list">
          {windows.map((window) => (
            <li key={window.id} className="window">
              <span>
                <strong>{WEEKDAYS[window.weekday]}</strong> de {window.start} a {window.end}
              </span>
              <button type="button" className="ghost" onClick={() => removeWindow(window.id)}>
                Quitar
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={addWindow} className="filters">
          <label>
            Día
            <select
              value={form.weekday}
              onChange={(event) => setForm({ ...form, weekday: event.target.value })}
            >
              {WEEKDAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input
              type="time"
              value={form.start}
              onChange={(event) => setForm({ ...form, start: event.target.value })}
            />
          </label>
          <label>
            Hasta
            <input
              type="time"
              value={form.end}
              onChange={(event) => setForm({ ...form, end: event.target.value })}
            />
          </label>
          <button type="submit">Agregar</button>
        </form>
      </section>
    </div>
  );
}

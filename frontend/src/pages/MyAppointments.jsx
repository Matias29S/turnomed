import { useEffect, useState } from 'react';
import { api, formatDateTime, today } from '../api.js';

const STATUS_LABELS = {
  booked: 'Reservado',
  attended: 'Atendido',
  no_show: 'Ausente',
  cancelled: 'Cancelado',
};

export default function MyAppointments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [rescheduling, setRescheduling] = useState(null);
  const [date, setDate] = useState(today());
  const [slots, setSlots] = useState([]);

  async function load() {
    try {
      setItems(await api.get('/api/appointments/me'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!rescheduling) return;

    api
      .get(`/api/doctors/${rescheduling.doctor_id}/availability?date=${date}`)
      .then((data) => setSlots(data.slots))
      .catch(() => setSlots([]));
  }, [rescheduling, date]);

  async function handleCancel(id) {
    setError('');
    setMessage('');

    try {
      await api.patch(`/api/appointments/${id}/cancel`, {});
      setMessage('Turno cancelado.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReschedule(slot) {
    setError('');
    setMessage('');

    try {
      await api.patch(`/api/appointments/${rescheduling.id}/reschedule`, { startsAt: slot.startsAt });
      setMessage('Turno reprogramado.');
      setRescheduling(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h1>Mis turnos</h1>
        <p className="muted">Podés cancelar o reprogramar hasta 24 horas antes del inicio.</p>

        {loading && <p className="muted">Cargando turnos…</p>}
        {!loading && items.length === 0 && <p className="muted">Todavía no tenés turnos.</p>}

        <ul className="list">
          {items.map((item) => (
            <li key={item.id} className="appointment">
              <div>
                <strong>{formatDateTime(item.starts_at)} hs</strong>
                <span className="muted">
                  {item.doctor_name} · {item.specialty}
                </span>
                {item.reason && <span className="muted">Motivo: {item.reason}</span>}
                {item.cancel_reason && <span className="muted">Cancelado: {item.cancel_reason}</span>}
              </div>

              <div className="appointment-actions">
                <span className={`badge ${item.status}`}>{STATUS_LABELS[item.status]}</span>

                {item.status === 'booked' && (
                  <>
                    <button type="button" className="ghost" onClick={() => setRescheduling(item)}>
                      Reprogramar
                    </button>
                    <button type="button" className="danger" onClick={() => handleCancel(item.id)}>
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

      {rescheduling && (
        <section className="card">
          <h2>Reprogramar turno</h2>
          <p className="muted">
            {rescheduling.doctor_name} · turno actual: {formatDateTime(rescheduling.starts_at)} hs
          </p>

          <label>
            Nueva fecha
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>

          {slots.length === 0 && <p className="muted">No hay horarios libres ese día.</p>}

          <div className="slots">
            {slots.map((slot) => (
              <button
                key={slot.startsAt}
                type="button"
                className="slot"
                onClick={() => handleReschedule(slot)}
              >
                {slot.time}
              </button>
            ))}
          </div>

          <button type="button" className="ghost" onClick={() => setRescheduling(null)}>
            Cerrar
          </button>
        </section>
      )}
    </div>
  );
}

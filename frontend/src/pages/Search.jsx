import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, today } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Search() {
  const { user } = useAuth();
  const [specialties, setSpecialties] = useState([]);
  const [specialtyId, setSpecialtyId] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(today());
  const [slots, setSlots] = useState([]);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    api.get('/api/specialties').then(setSpecialties).catch(() => setSpecialties([]));
  }, []);

  useEffect(() => {
    const query = specialtyId ? `?specialty=${specialtyId}` : '';
    setLoadingDoctors(true);
    api
      .get(`/api/doctors${query}`)
      .then((rows) => {
        setDoctors(rows);
        setDoctorId('');
        setSlots([]);
      })
      .catch(() => setDoctors([]))
      .finally(() => setLoadingDoctors(false));
  }, [specialtyId]);

  useEffect(() => {
    if (!doctorId) {
      setSlots([]);
      return;
    }

    setLoadingSlots(true);
    setError('');

    api
      .get(`/api/doctors/${doctorId}/availability?date=${date}`)
      .then((data) => setSlots(data.slots))
      .catch((err) => {
        setSlots([]);
        setError(err.message);
      })
      .finally(() => setLoadingSlots(false));
  }, [doctorId, date]);

  async function handleBook(slot) {
    setError('');
    setMessage('');

    try {
      const appointment = await api.post('/api/appointments', {
        doctorId: Number(doctorId),
        startsAt: slot.startsAt,
        reason: reason.trim() || undefined,
      });
      setMessage(`Turno reservado para el ${appointment.starts_at.replace('T', ' ')} hs.`);
      setSlots((previous) => previous.filter((item) => item.startsAt !== slot.startsAt));
    } catch (err) {
      setError(err.message);
    }
  }

  const selectedDoctor = doctors.find((doctor) => String(doctor.id) === String(doctorId));

  return (
    <div className="stack">
      <section className="card">
        <h1>Buscar un turno</h1>
        <p className="muted">
          Elegí una especialidad, un médico y un día. Solo se muestran las franjas realmente libres.
        </p>

        <div className="filters">
          <label>
            Especialidad
            <select value={specialtyId} onChange={(event) => setSpecialtyId(event.target.value)}>
              <option value="">Todas</option>
              {specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Fecha
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Médicos</h2>

        {loadingDoctors && <p className="muted">Cargando médicos…</p>}
        {!loadingDoctors && doctors.length === 0 && (
          <p className="muted">No hay médicos disponibles para esa especialidad.</p>
        )}

        <ul className="list">
          {doctors.map((doctor) => (
            <li key={doctor.id}>
              <button
                type="button"
                className={`list-item ${String(doctor.id) === String(doctorId) ? 'selected' : ''}`}
                onClick={() => setDoctorId(String(doctor.id))}
              >
                <strong>{doctor.full_name}</strong>
                <span className="muted">
                  {doctor.specialty} · MP {doctor.license_number} · turnos de {doctor.slot_minutes} min
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selectedDoctor && (
        <section className="card">
          <h2>Horarios de {selectedDoctor.full_name}</h2>

          {loadingSlots && <p className="muted">Buscando horarios…</p>}

          {!loadingSlots && slots.length === 0 && (
            <p className="muted">No hay horarios libres ese día. Probá con otra fecha.</p>
          )}

          <div className="slots">
            {slots.map((slot) => (
              <button
                key={slot.startsAt}
                type="button"
                className="slot"
                onClick={() => handleBook(slot)}
                disabled={user?.role !== 'patient'}
              >
                {slot.time}
              </button>
            ))}
          </div>

          {user?.role === 'patient' && (
            <label className="reason">
              Motivo de consulta (opcional)
              <input
                maxLength={200}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ej.: control anual"
              />
            </label>
          )}

          {!user && (
            <p className="muted">
              <Link to="/login">Ingresá</Link> para reservar.
            </p>
          )}

          {user && user.role !== 'patient' && (
            <p className="muted">Solo los pacientes pueden reservar turnos.</p>
          )}

          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
        </section>
      )}
    </div>
  );
}

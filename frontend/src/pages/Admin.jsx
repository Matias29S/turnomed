import { useEffect, useState } from 'react';
import { addDays, api, today } from '../api.js';

const EMPTY_DOCTOR = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  specialtyId: '',
  licenseNumber: '',
  slotMinutes: '30',
};

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [range, setRange] = useState({ from: today(), to: addDays(today(), 30) });
  const [specialtyName, setSpecialtyName] = useState('');
  const [doctor, setDoctor] = useState(EMPTY_DOCTOR);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadAll() {
    try {
      const [userRows, specialtyRows] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/specialties'),
      ]);
      setUsers(userRows);
      setSpecialties(specialtyRows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMetrics(from = range.from, to = range.to) {
    try {
      setMetrics(await api.get(`/api/admin/metrics?from=${from}&to=${to}`));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadAll();
    loadMetrics();
  }, []);

  async function createSpecialty(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.post('/api/admin/specialties', { name: specialtyName });
      setSpecialtyName('');
      setMessage('Especialidad creada.');
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createDoctor(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.post('/api/admin/doctors', {
        ...doctor,
        specialtyId: Number(doctor.specialtyId),
        slotMinutes: Number(doctor.slotMinutes),
        phone: doctor.phone || undefined,
      });
      setDoctor(EMPTY_DOCTOR);
      setMessage('Médico creado.');
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  const update = (field) => (event) => setDoctor({ ...doctor, [field]: event.target.value });

  return (
    <div className="stack">
      <section className="card">
        <h1>Administración</h1>

        {loading && <p className="muted">Cargando datos…</p>}

        <div className="filters">
          <label>
            Métricas desde
            <input
              type="date"
              value={range.from}
              onChange={(event) => setRange({ ...range, from: event.target.value })}
            />
          </label>
          <label>
            hasta
            <input
              type="date"
              value={range.to}
              onChange={(event) => setRange({ ...range, to: event.target.value })}
            />
          </label>
          <button type="button" onClick={() => loadMetrics()}>
            Actualizar
          </button>
        </div>

        {metrics && (
          <div className="metrics">
            <div>
              <strong>{metrics.total}</strong>
              <span className="muted">Turnos</span>
            </div>
            <div>
              <strong>{metrics.attended}</strong>
              <span className="muted">Atendidos</span>
            </div>
            <div>
              <strong>{metrics.cancelled}</strong>
              <span className="muted">Cancelados</span>
            </div>
            <div>
              <strong>{metrics.no_show}</strong>
              <span className="muted">Ausentes</span>
            </div>
            <div>
              <strong>{metrics.no_show_rate}%</strong>
              <span className="muted">Ausentismo</span>
            </div>
          </div>
        )}

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>Especialidades</h2>

        <form onSubmit={createSpecialty} className="filters">
          <label>
            Nueva especialidad
            <input
              required
              minLength={3}
              value={specialtyName}
              onChange={(event) => setSpecialtyName(event.target.value)}
            />
          </label>
          <button type="submit">Crear</button>
        </form>

        <p className="muted">{specialties.map((item) => item.name).join(' · ')}</p>
      </section>

      <section className="card">
        <h2>Nuevo médico</h2>

        <form onSubmit={createDoctor} className="form grid">
          <label>
            Nombre
            <input required value={doctor.fullName} onChange={update('fullName')} />
          </label>
          <label>
            Email
            <input type="email" required value={doctor.email} onChange={update('email')} />
          </label>
          <label>
            Contraseña inicial
            <input
              type="password"
              required
              minLength={8}
              value={doctor.password}
              onChange={update('password')}
            />
          </label>
          <label>
            Teléfono
            <input value={doctor.phone} onChange={update('phone')} />
          </label>
          <label>
            Especialidad
            <select required value={doctor.specialtyId} onChange={update('specialtyId')}>
              <option value="">Elegir…</option>
              {specialties.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Matrícula
            <input required value={doctor.licenseNumber} onChange={update('licenseNumber')} />
          </label>
          <label>
            Duración del turno
            <select value={doctor.slotMinutes} onChange={update('slotMinutes')}>
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
            </select>
          </label>
          <button type="submit">Crear médico</button>
        </form>
      </section>

      <section className="card">
        <h2>Usuarios</h2>

        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Activo</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.full_name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.active ? 'Sí' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

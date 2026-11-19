import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSending(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  return (
    <section className="card narrow">
      <h1>Crear cuenta</h1>
      <p className="muted">El registro público crea cuentas de paciente.</p>

      <form onSubmit={handleSubmit} className="form">
        <label>
          Nombre y apellido
          <input required minLength={2} value={form.fullName} onChange={update('fullName')} />
        </label>
        <label>
          Email
          <input type="email" required value={form.email} onChange={update('email')} />
        </label>
        <label>
          Teléfono
          <input value={form.phone} onChange={update('phone')} />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={update('password')}
          />
          <small className="muted">Al menos 8 caracteres, con una letra y un número.</small>
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={sending}>
          {sending ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="muted">
        ¿Ya tenés cuenta? <Link to="/login">Ingresar</Link>
      </p>
    </section>
  );
}

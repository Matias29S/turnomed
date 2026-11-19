import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          TurnoMed
        </Link>

        <nav>
          <Link to="/">Buscar turno</Link>
          {user?.role === 'patient' && <Link to="/mis-turnos">Mis turnos</Link>}
          {user?.role === 'doctor' && <Link to="/agenda">Mi agenda</Link>}
          {user?.role === 'admin' && <Link to="/admin">Administración</Link>}
        </nav>

        <div className="session">
          {user ? (
            <>
              <span className="muted">{user.full_name}</span>
              <button type="button" className="ghost" onClick={handleLogout}>
                Salir
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Ingresar</Link>
              <Link to="/register" className="button">
                Crear cuenta
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <footer className="footer muted">
        TurnoMed · turnos médicos online · datos de salud no incluidos en esta versión
      </footer>
    </div>
  );
}

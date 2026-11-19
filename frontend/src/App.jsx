import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Search from './pages/Search.jsx';
import MyAppointments from './pages/MyAppointments.jsx';
import DoctorAgenda from './pages/DoctorAgenda.jsx';
import Admin from './pages/Admin.jsx';

function Protected({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="muted">Cargando…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Search />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/mis-turnos"
          element={
            <Protected roles={['patient']}>
              <MyAppointments />
            </Protected>
          }
        />
        <Route
          path="/agenda"
          element={
            <Protected roles={['doctor']}>
              <DoctorAgenda />
            </Protected>
          }
        />
        <Route
          path="/admin"
          element={
            <Protected roles={['admin']}>
              <Admin />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

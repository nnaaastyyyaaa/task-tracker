import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Projects from './pages/Projects.jsx';
import Project from './pages/Project.jsx';

const ROLE_LABELS = { team_lead: 'Тімлід', team_member: 'Учасник' };

function Layout() {
  const { user, checking, logout } = useAuth();

  if (checking) return <p className="center muted">Завантаження…</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          Task Tracker
        </Link>
        <div className="topbar-user">
          <span>
            {user.name}{' '}
            <span className="badge">{ROLE_LABELS[user.role] ?? user.role}</span>
          </span>
          <button type="button" className="btn secondary" onClick={logout}>
            Вийти
          </button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Projects />} />
        <Route path="/projects/:projectId" element={<Project />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

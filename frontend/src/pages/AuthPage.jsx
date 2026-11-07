import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth.jsx';

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { user, login, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'team_member',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const setField = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      if (isRegister) await register(form);
      else await login(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>{isRegister ? 'Реєстрація' : 'Вхід'}</h1>

        {error && <p className="alert">{error}</p>}

        {isRegister && (
          <label>
            Ім'я
            <input value={form.name} onChange={setField('name')} required />
          </label>
        )}

        <label>
          Email
          <input type="email" value={form.email} onChange={setField('email')} required />
        </label>

        <label>
          Пароль
          <input
            type="password"
            value={form.password}
            onChange={setField('password')}
            minLength={isRegister ? 8 : undefined}
            required
          />
          {isRegister && <small className="muted">Від 8 до 72 символів</small>}
        </label>

        {isRegister && (
          <label>
            Роль
            <select value={form.role} onChange={setField('role')}>
              <option value="team_member">Учасник команди</option>
              <option value="team_lead">Тімлід (може створювати проєкти)</option>
            </select>
          </label>
        )}

        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Зачекайте…' : isRegister ? 'Зареєструватися' : 'Увійти'}
        </button>

        <p className="muted">
          {isRegister ? (
            <>
              Вже є акаунт? <Link to="/login">Увійти</Link>
            </>
          ) : (
            <>
              Немає акаунта? <Link to="/register">Зареєструватися</Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}

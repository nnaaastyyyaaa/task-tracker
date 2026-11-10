import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', description: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setProjects(await api.projects.list());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(event) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      await api.projects.create({ name: form.name, description: form.description });
      setForm({ name: '', description: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Проєкти</h1>

      {error && <p className="alert">{error}</p>}

      {user.role === 'team_lead' && (
        <form className="card form-row" onSubmit={create}>
          <h2>Новий проєкт</h2>
          <label>
            Назва
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              minLength={2}
              maxLength={100}
              required
            />
          </label>
          <label>
            Опис
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={1000}
              rows={2}
            />
          </label>
          <button type="submit" className="btn" disabled={busy}>
            Створити
          </button>
        </form>
      )}

      {projects === null && !error && <p className="muted">Завантаження…</p>}

      {projects?.length === 0 && (
        <p className="muted">
          {user.role === 'team_lead'
            ? 'Проєктів ще немає, створіть перший.'
            : 'Вас ще не додали до жодного проєкту.'}
        </p>
      )}

      <ul className="project-list">
        {projects?.map((project) => (
          <li key={project.id}>
            <Link to={`/projects/${project.id}`} className="card project-card">
              <strong>{project.name}</strong>
              {project.description && (
                <span className="muted">{project.description}</span>
              )}
              {project.ownerId === user.id && <span className="badge">Власник</span>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

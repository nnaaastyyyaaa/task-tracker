import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import TaskCard, { PRIORITIES, STATUSES } from '../components/TaskCard.jsx';

export default function Project() {
  const { projectId } = useParams();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [fatal, setFatal] = useState('');

  const [memberEmail, setMemberEmail] = useState('');
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigneeId: '',
  });

  const isOwner = project?.ownerId === user.id;
  const members = project?.members ?? [];

  const loadProject = useCallback(async () => {
    try {
      setProject(await api.projects.get(projectId));
    } catch (err) {
      setFatal(err.message);
    }
  }, [projectId]);

  const loadTasks = useCallback(async () => {
    try {
      setTasks(await api.tasks.list(projectId, { mine: filter === 'mine' }));
    } catch (err) {
      setError(err.message);
    }
  }, [projectId, filter]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function addMember(event) {
    event.preventDefault();
    setError('');

    try {
      await api.projects.addMember(projectId, memberEmail);
      setMemberEmail('');
      await loadProject();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createTask(event) {
    event.preventDefault();
    setError('');

    const assigneeId = Number(taskForm.assigneeId || members[0]?.id);

    try {
      await api.tasks.create(projectId, {
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        assigneeId,
      });
      setTaskForm({ ...taskForm, title: '', description: '' });
      await loadTasks();
    } catch (err) {
      setError(err.message);
    }
  }

  if (fatal) {
    return (
      <>
        <p className="alert">{fatal}</p>
        <Link to="/">← До проєктів</Link>
      </>
    );
  }

  if (!project) return <p className="muted">Завантаження…</p>;

  return (
    <>
      <Link to="/">← До проєктів</Link>
      <h1>{project.name}</h1>
      {project.description && <p className="muted">{project.description}</p>}

      {error && <p className="alert">{error}</p>}

      <section className="card">
        <h2>Учасники</h2>
        <ul className="members">
          {members.map((member) => (
            <li key={member.id}>
              {member.name} <small className="muted">{member.email}</small>
              {member.role === 'owner' && <span className="badge">Власник</span>}
            </li>
          ))}
        </ul>

        {isOwner && (
          <form className="inline-form" onSubmit={addMember}>
            <input
              type="email"
              placeholder="Email користувача"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              required
            />
            <button type="submit" className="btn">
              Додати
            </button>
          </form>
        )}
      </section>

      {isOwner && (
        <form className="card form-row" onSubmit={createTask}>
          <h2>Нова задача</h2>
          <label>
            Назва
            <input
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              required
            />
          </label>
          <label>
            Опис
            <textarea
              rows={2}
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
            />
          </label>
          <div className="inline-form">
            <label>
              Пріоритет
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
            <label>
              Виконавець
              <select
                value={taskForm.assigneeId || members[0]?.id || ''}
                onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })}
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className="btn">
            Створити задачу
          </button>
        </form>
      )}

      <div className="board-bar">
        <h2>Дошка</h2>
        <div className="segmented">
          <button
            type="button"
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            Усі
          </button>
          <button
            type="button"
            className={filter === 'mine' ? 'active' : ''}
            onClick={() => setFilter('mine')}
          >
            Лише мої
          </button>
        </div>
      </div>

      <div className="board">
        {STATUSES.map((status) => {
          const column = tasks.filter((task) => task.status === status.key);

          return (
            <section key={status.key} className="column">
              <h3>
                {status.label} <span className="muted">{column.length}</span>
              </h3>
              {column.map((task) => (
                <TaskCard
                  key={`${task.id}-${task.updatedAt ?? ''}`}
                  task={task}
                  members={members}
                  isOwner={isOwner}
                  canMove={isOwner || task.assigneeId === user.id}
                  onChanged={loadTasks}
                  onError={setError}
                />
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}

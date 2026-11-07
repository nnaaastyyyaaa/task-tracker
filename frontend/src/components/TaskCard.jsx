import { useState } from 'react';

import { api } from '../api.js';

export const STATUSES = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
];

export const PRIORITIES = ['low', 'medium', 'high'];

export default function TaskCard({
  task,
  members,
  isOwner,
  canMove,
  onChanged,
  onError,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: task.title,
    description: task.description,
    priority: task.priority,
  });

  const index = STATUSES.findIndex((status) => status.key === task.status);

  async function run(action) {
    onError('');
    try {
      await action();
      await onChanged();
    } catch (err) {
      onError(err.message);
      // 409/422 означають, що дані застаріли: підтягуємо актуальний стан.
      if (err.status === 409 || err.status === 422) await onChanged();
    }
  }

  const move = (offset) =>
    run(() => api.tasks.setStatus(task.id, STATUSES[index + offset].key));
  const changeAssignee = (event) =>
    run(() => api.tasks.setAssignee(task.id, Number(event.target.value)));
  const remove = () => {
    if (window.confirm(`Видалити задачу «${task.title}»?`))
      run(() => api.tasks.remove(task.id));
  };

  async function save(event) {
    event.preventDefault();
    await run(async () => {
      await api.tasks.update(task.id, draft);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <form className="task editing" onSubmit={save}>
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          required
        />
        <textarea
          rows={2}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        <select
          value={draft.priority}
          onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
        >
          {PRIORITIES.map((priority) => (
            <option key={priority}>{priority}</option>
          ))}
        </select>
        <div className="task-actions">
          <button type="submit" className="btn small">
            Зберегти
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => setEditing(false)}
          >
            Скасувати
          </button>
        </div>
      </form>
    );
  }

  return (
    <article className="task">
      <div className="task-head">
        <strong>{task.title}</strong>
        <span className={`badge priority-${task.priority}`}>{task.priority}</span>
      </div>

      {task.description && <p className="muted">{task.description}</p>}

      {isOwner ? (
        <select
          value={task.assigneeId ?? ''}
          onChange={changeAssignee}
          aria-label="Виконавець"
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      ) : (
        <small className="muted">Виконавець: {task.assigneeName ?? '—'}</small>
      )}

      <div className="task-actions">
        {canMove && (
          <>
            <button
              type="button"
              className="btn secondary small"
              disabled={index <= 0}
              onClick={() => move(-1)}
              title="Назад"
            >
              ←
            </button>
            <button
              type="button"
              className="btn secondary small"
              disabled={index >= STATUSES.length - 1}
              onClick={() => move(1)}
              title="Далі"
            >
              →
            </button>
          </>
        )}
        {isOwner && (
          <>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => setEditing(true)}
            >
              Редагувати
            </button>
            <button type="button" className="btn danger small" onClick={remove}>
              Видалити
            </button>
          </>
        )}
      </div>
    </article>
  );
}

# Task Tracker: фронтенд

React + Vite. Працює з бекендом через проксі `/api` → `http://localhost:3000`
(префікс `/api` відрізається), тому cookie `sid` лишається на одному origin і CORS не потрібен.

## Запуск

```bash
npm install
npm run dev        # http://localhost:5173
```

Бекенд має бути запущений. Якщо він слухає інший порт:

```bash
VITE_API_TARGET=http://localhost:4000 npm run dev
```

## Що вміє

- Реєстрація (роль `team_lead` / `team_member`), вхід, вихід.
- Список проєктів; створення проєкту (лише тімлід).
- Сторінка проєкту: учасники, додавання за email (власник), створення задачі з виконавцем (власник).
- Дошка `todo → in_progress → review → done` з фільтром «Усі / Лише мої».
- Статус змінюють власник та виконавець задачі (лише на сусідній стовпець).
  Редагування, зміна виконавця і видалення доступні власнику.

## Припущення щодо бекенду (усе в `src/api.js`)

- `POST /auth/login` повертає `{ data: { id, name, email, role } }`.
- Значення пріоритету: `low`, `medium`, `high`.
- Відповідь задачі містить `id, title, description, priority, status, assigneeId, assigneeName`.
- Ендпоінта `/auth/me` немає, тому користувач зберігається в `localStorage`,
  а чинність cookie перевіряється запитом `GET /projects`.

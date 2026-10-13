## 1. Сценарії та очікувана поведінка

**Загальні правила**

- Автентифікація: серверна сесія в cookie `sid`. Ідентифікатор сесії — випадкове 256-бітне значення, сесія зберігається в БД і діє 1 годину. Відсутня, невідома або прострочена сесія → `401 UNAUTHENTICATED`. Публічні лише A-01 та A-02.
- Пароль: 8–72 символи, зберігається лише як bcrypt-хеш, не повертається у відповідях. Роль зчитується з БД разом із сесією при кожному запиті.
- Порядок перевірок: автентифікація (`401`) → існування ресурсу (`404`) → права (`403`) → валідація тіла (`400`) → бізнес-правила (`409`, `422`).
- Рядки обрізаються від пробілів по краях; невідоме поле в тілі → `400`.

### Автентифікація (модуль C-02)

**A-01. Реєстрація** — `POST /auth/register`, `{name, email, password, role}`

- `role` — `TEAM_LEAD` або `TEAM_MEMBER` (у лабораторній роль обирається при реєстрації).
- Успіх: `201`, `{id, name, email, role}` без пароля.
- Помилки: `400` (невалідні поля, зокрема некоректний `email` або короткий пароль), `409 EMAIL_TAKEN` (`email` у будь-якому регістрі вже зареєстровано).

**A-02. Вхід** — `POST /auth/login`, `{email, password}`

- Успіх: `200`, `{user: {id, name, email, role}}`; створюється сесія, її ідентифікатор повертається в cookie `sid`.
- Помилки: `400`, `401 INVALID_CREDENTIALS` .

**A-03. Вихід** — `POST /auth/logout`

- Передумова: чинна сесія.
- Успіх: `204`; сесію видалено з БД, cookie `sid` скинуто.
- Помилки: `401`.

### Читання

| Сценарій | Успіх | Помилки |
|----------|-------|---------|
| **R-01** `GET /projects` | `200`, проєкти, які користувач створив або де він учасник; якщо немає — `[]` | `401` |
| **R-02** `GET /projects/{projectId}` | `200`, проєкт і список учасників | `400`, `401`, `404`, `403` |
| **R-03** `GET /projects/{projectId}/tasks[?assignee=me]` | `200`, масив задач за датою створення; з `assignee=me` лише задачі поточного користувача | `400` (зокрема інше значення `assignee`), `401`, `404`, `403` |
| **R-04** `GET /tasks/{taskId}` | `200`, задача з іменем виконавця | `400`, `401`, `404`, `403` |

### Оновлення

**U-01. Створення проєкту** — `POST /projects`, `{name, description?}`

- Передумова: роль `TEAM_LEAD`.
- Успіх: `201`, проєкт; `ownerId` — поточний користувач.
- Помилки: `401`, `403` (не team lead), `400`.

**U-02. Додавання учасника** — `POST /projects/{projectId}/members`, `{email}`

- Передумова: поточний користувач — власник проєкту.
- Успіх: `201`, оновлений список учасників.
- Повторне додавання того самого користувача нічого не змінює й повертає `409`.
- Помилки: `401`, `404` (проєкт або користувач), `403`, `400`, `409 ALREADY_MEMBER`.

**U-03. Створення та призначення задачі** — `POST /projects/{projectId}/tasks`, `{title, description?, assigneeId, priority}`

- Передумови: власник проєкту; виконавець — учасник проєкту.
- Успіх: `201`, задача зі `status = TODO`; `priority = MEDIUM`, `description = ""`, якщо не передано.
- Помилки: `401`, `404`, `403`, `400`, `422 ASSIGNEE_NOT_MEMBER`.

**U-04. Зміна статусу** — `PATCH /tasks/{taskId}/status`, `{status}`

- Передумова: власник проєкту або виконавець задачі.
- Успіх: `200`, оновлена задача. Дозволені лише переходи між сусідніми стовпцями (TODO ↔ IN_PROGRESS ↔ REVIEW ↔ DONE). Той самий статус — нічого не змінюється, `200`.
- Помилки: `401`, `404`, `403`, `400`, `422 INVALID_STATUS_TRANSITION`, `409 CONCURRENT_UPDATE` (статус змінили паралельно).

**U-05. Зміна виконавця** — `PATCH /tasks/{taskId}/assignee`, `{assigneeId}`

- Передумови: власник проєкту; новий виконавець — учасник проєкту.
- Успіх: `200`, оновлена задача.
- Помилки: `401`, `404`, `403`, `400`, `422 ASSIGNEE_NOT_MEMBER`.

**U-06. Видалення задачі** — `DELETE /tasks/{taskId}`

- Передумова: власник проєкту.
- Успіх: `204`. Повторний виклик повертає `404`.
- Помилки: `401`, `404`, `403`.

**U-07. Редагування задачі** — `PATCH /tasks/{taskId}`, `{title?, description?, priority?}` (хоча б одне поле)

- Передумова: власник проєкту.
- Успіх: `200`, оновлена задача. Статус і виконавець цим сценарієм не змінюються.
- Помилки: `401`, `404`, `403`, `400` (зокрема порожнє тіло).

## 2. Схема БД і запити

DDL у діалекті PostgreSQL.

```sql
CREATE TYPE role_name AS ENUM ('team_lead', 'team_member');

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL CHECK (char_length(name) >= 2),
  email         VARCHAR(254) NOT NULL UNIQUE, 
  password_hash TEXT NOT NULL,
  role          role_name NOT NULL
);

CREATE TABLE sessions (
  id         VARCHAR(64) PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES users (id),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE projects (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL CHECK (char_length(name) >= 2),
  description VARCHAR(1000),
  owner_id    integer NOT NULL REFERENCES users (id)
);

CREATE TYPE project_role_name AS ENUM ('owner', 'member');

CREATE TABLE project_member (
  project_id integer NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  user_id    integer NOT NULL REFERENCES users (id),
  PRIMARY KEY (project_id, user_id),
  role        project_role_name NOT NULL
);
CREATE INDEX project_members_user_idx ON project_members (user_id);

CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');

CREATE TABLE tasks (
  id          SERIAL PRIMARY KEY,
  project_id  integer NOT NULL,
  title       VARCHAR(200) NOT NULL CHECK (char_length(title) >= 2),
  description VARCHAR(5000) NOT NULL DEFAULT '',
  assignee_id  integer NOT NULL,
  priority    task_priority  NOT NULL DEFAULT 'medium',
  status      task_status NOT NULL DEFAULT 'todo',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tasks_project_fk FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT tasks_assignee_member_fk FOREIGN KEY (project_id, assignee_id)
  REFERENCES project_members (project_id, user_id)
);
CREATE INDEX tasks_project_assignee_idx ON tasks (project_id, assignee_id);
```

Складений ключ `tasks_assignee_member_fk` гарантує на рівні БД, що виконавець є учасником проєкту. Пароль зберігається лише як bcrypt-хеш у `password_hash`. Сесії зберігаються в `sessions`, прострочені видаляються періодичним очищенням.

### Запити

Ключові звернення до БД, які повторно використовують сценарії. Кількість звернень на один API-виклик фіксована й не залежить від кількості задач чи учасників: імена виконавців, власника проєкту та ознаку членства отримують у тому самому зверненні, що й самі дані.

| Запит | Де використовується | Що робить | Звернень | Індекс |
|-------|---------------------|-----------|----------|--------|
| Користувач за сесією | кожен захищений запит | знаходить непрострочену сесію разом із користувачем (id, ім'я, роль) | 1 | первинний ключ `sessions` |
| Доступ до проєкту | R-02, R-03, U-02, U-03 | повертає власника проєкту й ознаку, чи є користувач учасником | 1 | первинні ключі `projects`, `project_members` |
| Задача з правами | R-04, U-04–U-07 | повертає задачу з іменем виконавця, власником проєкту й ознакою членства | 1 | первинні ключі |
| Список проєктів | R-01 | проєкти, які користувач створив або де він учасник, за назвою | 1 | `project_members_user_idx` |
| Учасники проєкту | R-02 | учасники проєкту з іменами | 1 | первинний ключ `project_members` |
| Дошка проєкту | R-03 | задачі проєкту з іменами виконавців; з `assignee=me` лише задачі користувача | 1 | `tasks_project_assignee_idx` |
| Додавання учасника | U-02 | знаходить користувача за `email` і додає до проєкту; якщо вже є, нічого не змінює | 1 (+1, щоб відрізнити `404` від `409`) | унікальний `email` |
| Запис однієї задачі | U-03, U-05, U-07, U-06 | створення, зміна виконавця, редагування, видалення одного запису | 1 | первинний ключ `tasks` |
| Зміна статусу | U-04 | оновлює статус лише якщо в БД він досі такий, як зчитано раніше; інакше `409` | 1 | первинний ключ `tasks` |
| Автентифікація | A-01–A-03 | створення користувача, пошук за `email`, створення й видалення сесії | 1–2 | унікальний `email`, первинний ключ `sessions` |


## 3. Сценарії помилок

Формат відповіді: `{ "error": { "code": "…", "message": "…" } }`.

| HTTP | `code` | Коли |
|------|--------|------|
| 400 | `VALIDATION_ERROR` | некоректний id, тіло або параметр запиту |
| 401 | `UNAUTHENTICATED` | відсутня, невідома або прострочена сесія |
| 401 | `INVALID_CREDENTIALS` | неправильний `email` або пароль при вході |
| 403 | `FORBIDDEN` | недостатньо прав або немає доступу до проєкту |
| 404 | `PROJECT_NOT_FOUND`, `TASK_NOT_FOUND`, `USER_NOT_FOUND` | ресурс не існує |
| 409 | `EMAIL_TAKEN` | `email` уже зареєстровано |
| 409 | `ALREADY_MEMBER` | користувач уже є учасником |
| 409 | `CONCURRENT_UPDATE` | статус задачі змінили паралельно |
| 422 | `INVALID_STATUS_TRANSITION` | перехід між несусідніми статусами |
| 422 | `ASSIGNEE_NOT_MEMBER` | виконавець не є учасником проєкту |
| 500 | `INTERNAL_ERROR` | непередбачена або постійна помилка сховища |
| 503 | `STORAGE_UNAVAILABLE` | сховище недоступне; заголовок `Retry-After: 5` |

**Збої джерела даних**

- Тимчасові збої (втрата з'єднання, таймаут, deadlock): до 3 спроб із затримкою 100, 200, 400 мс. Після вичерпання спроб транзакція відкочується, відповідь `503`.
- Автоматично повторюються лише безпечні операції: усі читання, вхід (A-02), вихід (A-03), зміна статусу (U-04), видалення (U-06). Створення (A-01, U-01, U-03) повторно не виконується, бо можливий дубль; клієнт отримує `503`.
- Постійні збої (синтаксична помилка, відсутня таблиця) → `500`, без повторів; деталі лише в журналі.
- Порушення обмежень БД перетворюються на відповідні коди таблиці.
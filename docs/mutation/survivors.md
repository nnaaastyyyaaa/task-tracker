# Вижилі мутанти

Прогін: 2026-11-07. Mutation score: **97.2%** (виявлено 836, вижило 24). Поріг `thresholds.break` = 80.

Класи: **реальна прогалина** (зміна поведінки, яку тест міг би помітити), **еквівалентний** (поведінка не змінюється),
**прийнятний** (вплив є, але покривати його тестом недоцільно).

Усі 16 «прийнятних» мутантів одного типу: текст повідомлення (`message`) замінено на `""`. Клієнти й тести спираються
на `error.code`, який перевіряється, а текст призначений для людини й не є частиною контракту.
Повідомлення при цьому лишається рядком, що відповідає формату `{ error: { code, message } }`.

| Файл:рядок | Мутація | Клас | Причина | Тест |
|---|---|---|---|---|
| src/modules/projectMember/entity.js:18 | тіло `toEntity()` → `{}` | реальна прогалина | метод не викликався жодним тестом, а він задає форму запису в БД | projectMemberEntity.test.js: "maps to the database shape" |
| src/modules/projectMember/entity.js:19 | об'єкт у `toEntity()` → `{}` | реальна прогалина | те саме, що й вище | projectMemberEntity.test.js: "maps to the database shape" |
| src/modules/projectMember/service.js:29 | `'VALIDATION_ERROR'` → `""` | реальна прогалина | тести перевіряли лише статус 400, а `code` є частиною контракту | projectMemberServiceRole.test.js: "rejects the role ... with 400 VALIDATION_ERROR" |
| src/modules/projectMember/service.js:29 | `'Member role is invalid'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/modules/task/repository.js:6 | `'Assignee is not a member of the project'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/modules/task/repository.js:51 | `'Task not found'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/modules/task/repository.js:90 | `'Task not found'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/modules/task/service.js:9 | `'Assignee is not a member of the project'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/modules/task/service.js:69 | `'priority: LOW, MEDIUM or HIGH'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/modules/task/service.js:100 | `'priority: LOW, MEDIUM or HIGH'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/modules/task/service.js:104 | `'At least one field is required'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/modules/task/service.js:134 | `'Invalid task status'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/modules/task/service.js:157 | `'Task status was changed concurrently'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/modules/user/service.js:24 | `'email: must be a string'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/modules/user/service.js:26 | `'Invalid email'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/modules/user/service.js:33 | `'Password must be 8-72 characters'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/modules/user/service.js:38 | `'VALIDATION_ERROR'` → `""` | реальна прогалина | тести перевіряли лише статус 400, а `code` є частиною контракту | userServiceRole.test.js: "rejects the role ... with 400 VALIDATION_ERROR" |
| src/modules/user/service.js:38 | `'User role is invalid'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/modules/user/service.js:43 | `'User with this email already exists'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` (`EMAIL_TAKEN`) | — |
| src/modules/user/service.js:67 | `'Enter email and password'` → `""` | прийнятний | текст повідомлення не входить у контракт, перевіряється `code` | — |
| src/utils/errorHandler.js:57 | `error.statusCode === 400` → `false` | реальна прогалина | не було тесту на помилку зі статусом 400 без поля `validation` (наприклад, зламаний JSON): відповідь стала б `BAD_REQUEST` замість `VALIDATION_ERROR` | errorHandlerStatusCodes.test.js: "maps a malformed JSON body to 400 VALIDATION_ERROR" |
| src/utils/errorHandler.js:62 | `error.statusCode < 500` → `true` | реальна прогалина | помилки зі статусом ≥ 500 не перевірялися: мутант віддавав би клієнту їхній `message` замість `INTERNAL_ERROR` | errorHandlerStatusCodes.test.js: "returns 500 INTERNAL_ERROR without leaking details" |
| src/utils/errorHandler.js:62 | `&&` → `\|\|` | реальна прогалина | те саме: статус ≥ 500 потрапляв би в гілку клієнтських помилок | errorHandlerStatusCodes.test.js: "returns 500 INTERNAL_ERROR without leaking details" |
| src/utils/errorHandler.js:62 | `<` → `<=` | реальна прогалина | межа 500: помилка зі статусом рівно 500 віддавалася б як `BAD_REQUEST` | errorHandlerStatusCodes.test.js: кейс `500` у "returns 500 INTERNAL_ERROR without leaking details" |

## Побічні знахідки (не мутанти)

- `src/modules/task/repository.js:51`: у `update` при `P2025` код помилки `NOT_FOUND`, а в `delete` (рядок 90) і в сервісі `TASK_NOT_FOUND`. Ця гілка досяжна лише при гонці (задачу видалили між читанням і оновленням), тож клієнт отримав би інший код.
- `src/modules/task/service.js:69` і `:100`: повідомлення «priority: LOW, MEDIUM or HIGH», а API приймає значення нижнім регістром (`low`, `medium`, `high`).
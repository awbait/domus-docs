# i18n Audit — focus-dashboard

Дата: 2026-03-23
Статус: ~100 хардкод-строк в 10 файлах. Почти все ключи уже есть в `en.json` / `ru.json`.

---

## Файлы полностью без i18n

### `pages/LoginPage.tsx` — 11 строк

| Строка | Хардкод | Ключ i18n |
|--------|---------|-----------|
| 35 | `'Ошибка входа через OIDC'` | `login.oidcError` |
| 46 | `'Неверный email или пароль'` | `login.invalidCredentials` |
| 70 | `Фокус` | `login.title` |
| 71 | `Войдите в дашборд` | `login.subtitle` |
| 77 | `Email` | `login.email` |
| 91 | `Пароль` | `login.password` |
| 116 | `Входим...` | `login.loggingIn` |
| 119 | `Войти` | `common.login` |
| 130 | `или` | `login.or` |
| 143 | `Войти через Authentik` | `login.oidcButton` |

### `pages/SetupPage.tsx` — 20+ строк

| Строка | Хардкод | Ключ i18n |
|--------|---------|-----------|
| 13 | `'Добро пожаловать'` | `setup.welcome` |
| 14 | `'Аккаунт'` | `setup.account` |
| 15 | `'Готово'` | `common.done` |
| 32 | `'Слишком короткий пароль'` | `setup.tooShortPassword` |
| 33 | `'Минимум 8 символов'` | `setup.passwordMin` |
| 44 | `'Ошибка'` | `common.error` |
| 45 | `'Ошибка создания'` | `common.creationError` |
| 98 | `Добро пожаловать` | `setup.welcome` |
| 100 | `в` + `Фокус` | `setup.inBrand` (Trans) |
| 103 | `Персональный дашборд...` | `setup.description` |
| 107 | `Начать настройку` | `setup.startSetup` |
| 126 | `Аккаунт администратора` | `setup.adminAccount` |
| 128 | `Это будет ваша основная учётная запись` | `setup.adminAccountDesc` |
| 135 | `Ваше имя` | `setup.yourName` |
| 138 | `placeholder="Иван"` | `setup.namePlaceholder` |
| 145 | `Email` | `login.email` |
| 158 | `Пароль` | `login.password` |
| 164 | `placeholder="Минимум 8 символов"` | `setup.passwordMin` |
| 174 | `Назад` | `common.back` |
| 189 | `Создаём...` | `setup.creating` |
| 193 | `Создать аккаунт` | `setup.createAccount` |
| 219 | `Всё готово!` | `setup.allDone` |
| 221 | `Аккаунт {name} создан` | `setup.accountCreated` (Trans) |
| 225 | `Открыть дашборд` | `setup.openDashboard` |

### `pages/BoardPage.tsx` — 8 строк

| Строка | Хардкод | Ключ i18n |
|--------|---------|-----------|
| 105 | `'Борд не найден'` | `board.notFound` |
| 181 | `'Не удалось сохранить макет'` | `board.saveFailed` |
| 371 | `title="Удалить виджет"` | `board.removeWidget` |
| 426 | `Виджет` | `board.widget` |
| 430 | `Готово` | `common.done` |
| 440 | `Редактировать` | `board.edit` |
| 548 | `Добавить виджет` | `board.addWidget` |
| 564 | `Все виджеты уже добавлены` | `board.allWidgetsAdded` |

### `pill-tracker/Widget.tsx` — 14 строк

| Строка | Хардкод | Ключ i18n |
|--------|---------|-----------|
| 12 | `'Дано'` | `pillTracker.status.given` |
| 13 | `'Пропуск'` | `pillTracker.status.skipped` |
| 14 | `'Просроч'` | `pillTracker.status.overdue` |
| 15 | `'Сейчас'` | `pillTracker.status.pending` |
| 16 | `'Позже'` | `pillTracker.status.upcoming` |
| 66 | `` `✓ ${name} отмечено` `` | `pillTracker.widget.marked` |
| 66 | `'Лекарство'` (fallback) | `pillTracker.widget.medication` |
| 68 | `'Ошибка при отметке'` | `pillTracker.widget.markError` |
| 79 | `Нет пациентов` | `pillTracker.widget.noPatients` |
| 81 | `Добавьте пациента в настройках модуля` | `pillTracker.widget.addPatientHint` |
| 95 | `Сегодня` | `pillTracker.widget.today` |
| 146 | `Нет доз на сегодня` | `pillTracker.widget.noDosesToday` |
| 196 | `Дать ... в ...?` | `pillTracker.widget.confirmGive` (Trans) |
| 204 | `Отмена` | `common.cancel` |
| 207 | `Дал` | `pillTracker.widget.gave` |

### `pill-tracker/SettingsPage.tsx` — 35+ строк

| Строка | Хардкод | Ключ i18n |
|--------|---------|-----------|
| 22-29 | Дни: `'Пн'`..`'Вс'` | `pillTracker.days.*` |
| 31-33 | Типы: `'Человек'`, `'Кот'`, `'Другое'` | `pillTracker.patientTypes.*` |
| 105 | `Пациенты` | `pillTracker.settings.patients` |
| 119 | `Нет пациентов` | `pillTracker.settings.noPatients` |
| 131 | `'Пациент удалён'` | `pillTracker.settings.patientDeleted` |
| 143 | `Лекарства` | `pillTracker.settings.medications` |
| 159 | `Выберите пациента` | `pillTracker.settings.selectPatient` |
| 161 | `Нет лекарств` | `pillTracker.settings.noMedications` |
| 173 | `'Лекарство удалено'` | `pillTracker.settings.medicationDeleted` |
| 185 | `Расписание` | `pillTracker.settings.schedule` |
| 201 | `Выберите лекарство` | `pillTracker.settings.selectMedication` |
| 203 | `Нет расписания` | `pillTracker.settings.noSchedule` |
| 212 | `'Приём удалён'` | `pillTracker.settings.scheduleDeleted` |
| 267 | `Pill Tracker — Настройки` | `pillTracker.settings.title` |
| 366 | `'Каждый день'` | `pillTracker.settings.everyDay` |
| 375 | `'Активно'` / `'Пауза'` | `pillTracker.settings.active` / `paused` |
| 413 | `'Ошибка создания'` | `common.creationError` |
| 423 | `Новый пациент` | `pillTracker.settings.newPatient` |
| 427 | `Имя` | `pillTracker.settings.name` |
| 437 | `Тип` | `pillTracker.settings.type` |
| 456 | `Аватар (emoji)` | `pillTracker.settings.avatarEmoji` |
| 467 | `Отмена` | `common.cancel` |
| 470 | `Создать` | `common.create` |
| 521 | `Новое лекарство` | `pillTracker.settings.newMedication` |
| 525 | `Название` | `pillTracker.settings.medName` |
| 534 | `Дозировка` | `pillTracker.settings.dosage` |
| 536 | `placeholder="1 таблетка"` | `pillTracker.settings.dosagePlaceholder` |
| 542 | `Цвет` | `pillTracker.settings.color` |
| 559 | `Заметки` | `pillTracker.settings.notes` |
| 561 | `placeholder="Необязательно"` | `pillTracker.settings.optional` |
| 569 | `Отмена` | `common.cancel` |
| 572 | `Создать` | `common.create` |
| 614 | `Новый приём` | `pillTracker.settings.newSchedule` |
| 618 | `Время` | `pillTracker.settings.time` |
| 622 | `Дни (пусто = каждый день)` | `pillTracker.settings.daysHint` |
| 644 | `Отмена` | `common.cancel` |
| 647 | `Добавить` | `common.add` |

### `widgets/ClockWidget.tsx` — дни/месяцы

Хардкод русских дней недели и месяцев. Рекомендация: заменить на `Intl.DateTimeFormat(i18n.language, ...)`.

### `core/widgets.tsx` — 2 строки

| Строка | Хардкод | Ключ i18n |
|--------|---------|-----------|
| 22 | `label: 'Часы'` | `widgets.clock` |
| 31 | `label: 'Pill Tracker'` | `widgets.pillTracker` |

---

## Файлы с мелкими пропусками

### `admin/ModulesPanel.tsx` — 3 строки

| Строка | Хардкод | Ключ i18n |
|--------|---------|-----------|
| 319 | `core` (Badge) | **Нужен новый ключ** `admin.modules.core` |
| 323 | `by {author}` | **Нужен новый ключ** `admin.modules.byAuthor` |
| 497 | `by {author}` | то же |

### `admin/BoardsPanel.tsx` — 3 строки

| Строка | Хардкод | Ключ i18n |
|--------|---------|-----------|
| 118 | `Slug` (header) | `admin.boards.slug` (есть, но значение "Slug (URL)") |
| 272 | `placeholder="Кухня"` | **Нужен новый ключ** `admin.boards.namePlaceholder` |
| 280 | `placeholder="kitchen"` | **Нужен новый ключ** `admin.boards.slugPlaceholder` |

### `admin/UsersPanel.tsx` — 1 строка

| Строка | Хардкод | Ключ i18n |
|--------|---------|-----------|
| 267 | `placeholder="ivan@example.com"` | Опционально |

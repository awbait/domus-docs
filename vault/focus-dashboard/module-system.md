# Модульная система

Focus Dashboard построен вокруг модульной архитектуры. Каждый модуль — самостоятельная функциональная единица: свой бэкенд, фронтенд, миграции и настройки.

---

## Концепция модуля

Любой модуль — builtin или dynamic — описывается одинаково:

| Свойство | Описание |
|----------|----------|
| **ID** | Уникальный идентификатор (`clock`, `pill-tracker`) |
| **Version** | Семантическая версия |
| **Метаданные** | Название, автор, описание |
| **Миграции** | SQL-файлы для создания таблиц (конвенция: префикс `{id}_`) |
| **Маршруты** | HTTP API под `/api/modules/{id}/...` |
| **Виджеты** | Один или несколько UI-компонентов для отображения на доске |
| **Health Check** | Проверка работоспособности |

| **i18n** | Локализованные строки (название, описание, UI виджетов) |

Разница только в runtime: builtin компилируется в Go-бинарник, dynamic запускается как отдельный процесс. Подход к разработке одинаковый.

### Модуль vs виджет

Модуль — логическая единица (один бэкенд, одни миграции, один health check). Виджет — визуальное представление на доске. Один модуль может предоставлять несколько виджетов:

| Модуль | Виджеты |
|--------|---------|
| `pill-tracker` | `pill-tracker.today` (компактный), `pill-tracker.history` (широкий) |
| `clock` | `clock.analog`, `clock.digital` |
| `domovoy-control` | `domovoy-control.status`, `domovoy-control.command` |

Каждый виджет описывает свои размеры:

| Свойство | Описание | Пример |
|----------|----------|--------|
| `min` | Минимальный размер | `1x1` |
| `max` | Максимальный размер | `4x3` |
| `default` | Размер при добавлении | `2x2` |

---

## Структура модуля

### Бэкенд

```
modules/
  pill-tracker/
    module.go          # точка входа, wiring зависимостей
    model.go           # доменные типы
    repository.go      # SQL-запросы (таблицы с префиксом pt_)
    service.go         # бизнес-логика
    handler.go         # HTTP-хэндлеры
    migrations/
      001_init.sql     # SQL-миграции
```

Dynamic-модуль имеет ту же логическую структуру, но оформляется как ZIP:

```
my-module.zip
  manifest.json        # id, version, author, widgets, events
  backend              # скомпилированный бинарник
  migrations.sql       # SQL-миграции
  widget.js            # Web Component для фронтенда
  settings.js          # Web Component для UI настроек (опционально)
  locales/             # переводы (опционально)
    en.json
    ru.json
```

### Manifest

Builtin-модули описывают метаданные через Go-интерфейс `Describer`. Dynamic — через `manifest.json`. Формат эквивалентен:

```json
{
  "id": "pill-tracker",
  "version": "1.0.0",
  "author": "awbait",
  "widgets": [
    {
      "id": "today",
      "min": "1x1",
      "max": "4x3",
      "default": "2x2"
    },
    {
      "id": "history",
      "min": "2x1",
      "max": "4x3",
      "default": "4x2"
    }
  ]
}
```

```go
func (m *Module) Describe() module.Meta {
    return module.Meta{
        Author: "awbait",
        Widgets: []module.WidgetMeta{
            {ID: "today", Min: "1x1", Max: "4x3", Default: "2x2"},
            {ID: "history", Min: "2x1", Max: "4x3", Default: "4x2"},
        },
    }
}
```

---

## Интерфейс модуля (Go)

Контракт для builtin-модулей:

```go
type Module interface {
    ID() string
    Version() string
    Core() bool                          // core-модули нельзя удалить
    RegisterRoutes(r chi.Router)         // HTTP-маршруты
    Migrate(db *sql.DB) error            // миграции БД
    HealthCheck(ctx context.Context) error
}
```

Опциональный интерфейс для метаданных:

```go
type Describer interface {
    Describe() Meta
}
```

**Минимальный модуль** (clock):

```go
func (m *Module) ID() string      { return "clock" }
func (m *Module) Version() string { return "1.0.0" }
func (m *Module) Core() bool      { return true }
func (m *Module) RegisterRoutes(_ chi.Router) {}
func (m *Module) Migrate(_ *sql.DB) error     { return nil }
func (m *Module) HealthCheck(_ context.Context) error { return nil }
```

---

## Жизненный цикл

Одинаковый для обоих типов:

```
Установка → Миграции → Маршруты → Работа → Выключение/Удаление
```

### Регистрация

**Builtin:** при старте в `main.go`:

```go
registry.Register(&clock.Module{})
registry.Register(pilltracker.New(db))
```

**Dynamic:** при загрузке ZIP через `POST /api/admin/modules/upload` или `POST /api/admin/modules/install-from-url`.

Оба типа записываются в таблицу `installed_modules`.

### Миграции

`registry.MigrateAll()` запускает миграции для каждого **включённого** модуля.

- Builtin: SQL через `embed.FS`
- Dynamic: `migrations.sql` из ZIP

Конвенция: таблицы с префиксом модуля (`pt_patients`, `pt_medications`).

### Маршруты

Все модули доступны под `/api/modules/{id}/...`:

- Builtin: маршруты монтируются напрямую через `chi.Router`
- Dynamic: запросы проксируются на subprocess через reverse proxy

### Включение/выключение

`PATCH /api/admin/modules/{id}` с `{"enabled": true/false}`. Состояние в `installed_modules.enabled`.

### Удаление

`DELETE /api/admin/modules/{id}` — только для не-core модулей. Удаляет из БД, из layouts всех пользователей и из памяти.

---

## Dynamic runtime

Детали, специфичные для dynamic-модулей.

### Бэкенд-процесс

Бинарник запускается как subprocess с окружением:

| Переменная | Описание |
|-----------|----------|
| `PORT` | Назначенный порт |
| `MODULE_ID` | Идентификатор модуля |
| `DATA_DIR` | Директория данных модуля |
| `DB_PATH` | Путь к SQLite БД |

**Handshake-протокол:** бинарник пишет в stdout JSON `{"protocol": "focus-module/1", "port": N}`. ProcessManager ждёт handshake + проверяет `GET /health`, после чего начинает проксирование.

### Фронтенд

`widget.js` загружается как `<script type="module">` и рендерится как Web Component `<{module-id}-widget>`.

---

## Фронтенд-интеграция

### Widget Registry

Статический реестр builtin-виджетов в `frontend/src/core/widgets.tsx`:

```tsx
export const WIDGET_REGISTRY: Record<string, WidgetRegistryEntry> = {
  clock: { moduleId: 'clock', label: ..., icon: ..., defaultW: 2, defaultH: 2 },
  'pill-tracker': { moduleId: 'pill-tracker', ... },
}
```

`renderWidget(widgetId, modules)` выбирает рендеринг:
1. Dynamic-модуль → `<DynamicWidget moduleId={moduleId} widgetId={widgetId} />`
2. Builtin → React-компонент по widget ID
3. Неизвестный → placeholder

Widget ID в layout — составной: `{moduleId}.{widgetId}` (например `pill-tracker.today`).

Для dynamic-модулей один `widget.js` регистрирует несколько Web Components (`<pill-tracker-today>`, `<pill-tracker-history>`).

### Добавление виджета на доску

BoardPage → Widget Picker → список виджетов из всех модулей (один модуль может предоставлять несколько) → добавление в react-grid-layout.

---

## Настройки модуля

Два уровня, одинаковые для обоих типов:

| Уровень | Таблица | Ключ | Кто управляет |
|---------|---------|------|---------------|
| Глобальные | `settings` | `key` | Администратор |
| Per-user per-module | `user_module_settings` | `(user_id, module_id, widget_id)` | Пользователь |

API:
- `GET /api/settings/module?module=X&widget=Y`
- `PUT /api/settings/module?module=X&widget=Y`

---

## i18n

Модули используют общую систему i18n дашборда — i18next с JSON-файлами локалей.

### Builtin-модули

Добавляют свои ключи в существующие файлы `frontend/src/i18n/locales/{lang}.json` с namespace по ID модуля:

```json
{
  "pillTracker": {
    "widget": { "today": "Today", "history": "History" },
    "dose": { "give": "Give", "skip": "Skip" }
  }
}
```

В компонентах — стандартный `useTranslation()`:

```tsx
const { t } = useTranslation()
t('pillTracker.widget.today') // → "Сегодня"
```

### Dynamic-модули

Поставляют JSON-файлы переводов в ZIP:

```
my-module.zip
  locales/
    en.json
    ru.json
  ...
```

При установке ядро регистрирует переводы через `i18next.addResourceBundle(lang, moduleId, json)`. Виджет использует тот же `t()` API.

---

## Push-уведомления

Модули отправляют push-уведомления через Core Services API. Модуль сам решает когда и кому слать.

### Builtin

```go
// CoreServices передаётся модулю при создании
s.core.SendPush(ctx, userID, "Таблетница", "Барсику пора давать Рибоксин")
```

### Dynamic

```
POST /internal/push
{"user_id": "...", "title": "Таблетница", "body": "Барсику пора давать Рибоксин"}
```

`/internal/*` доступны только с localhost (subprocess).

---

## События (Event Bus)

Модули публикуют события, другие модули подписываются. Это основной механизм межмодульного взаимодействия без прямых зависимостей.

### Публикация

Builtin:

```go
s.core.Publish(core.Event{
    Type:    "pill-tracker.dose.missed",
    Source:  "pill-tracker",
    Payload: json.RawMessage(`{"patient":"Барсик","medication":"Рибоксин"}`),
})
```

Dynamic:

```
POST /internal/events/publish
{"type": "my-module.something.happened", "payload": {...}}
```

### Подписка

Builtin:

```go
s.core.Subscribe("pill-tracker.dose.*", func(e core.Event) {
    // реагировать на событие
})
```

Dynamic:

```
POST /internal/events/subscribe
{"pattern": "pill-tracker.dose.*", "webhook": "/on-dose-event"}
```

### Документация событий

Каждый модуль описывает свои события в manifest / `Describe()`:

```json
{
  "events": [
    {
      "type": "pill-tracker.dose.missed",
      "description": "Dose was not given within the scheduled window",
      "payload": {
        "patient_name": "string",
        "medication_name": "string",
        "scheduled_at": "ISO 8601"
      }
    }
  ]
}
```

Другие модули при подписке знают какие события существуют и что в payload.

---

## API

### Публичные

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/modules` | Список всех модулей |
| GET | `/api/modules/{id}/widget.js` | JS-бандл виджета (dynamic) |
| GET | `/api/modules/{id}/settings.js` | JS-бандл настроек (dynamic) |
| * | `/api/modules/{id}/api/*` | API модуля (dynamic, через proxy) |
| * | `/api/modules/{id}/*` | API модуля (builtin, напрямую) |

### Административные

| Метод | Путь | Описание |
|-------|------|----------|
| PATCH | `/api/admin/modules/{id}` | Включение/выключение |
| DELETE | `/api/admin/modules/{id}` | Удаление (не-core) |
| POST | `/api/admin/modules/upload` | Установка из ZIP |
| POST | `/api/admin/modules/install-from-url` | Установка по URL |
| POST | `/api/admin/modules/check-updates` | Проверка обновлений |
| GET | `/api/admin/community-modules` | Каталог модулей |

---

## Health Check

- `GET /api/health` вызывает `HealthAll()` — проверяет все включённые модули
- Builtin: вызов `HealthCheck(ctx)` в процессе
- Dynamic: `GET /health` на порту subprocess
- При ошибке любого модуля — HTTP 503

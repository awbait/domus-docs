---
title: Модульная система
description: Архитектура модульной системы Focus Dashboard
---

# Модульная система

Focus Dashboard построен вокруг модульной архитектуры. Каждый модуль -- самостоятельная функциональная единица: свой бэкенд, фронтенд, миграции и настройки.

---

## Концепция модуля

Любой модуль -- builtin или dynamic -- описывается одинаково:

| Свойство | Описание |
|----------|----------|
| **ID** | Уникальный идентификатор (`clock`, `pill-tracker`) |
| **Version** | Семантическая версия |
| **Метаданные** | Название, автор, описание, homepage |
| **Миграции** | SQL-файлы для создания таблиц (конвенция: префикс `{id}_`) |
| **Маршруты** | HTTP API под `/api/modules/{id}/...` |
| **Виджеты** | Один или несколько UI-компонентов для отображения на доске |
| **События** | Список доменных событий, которые модуль может публиковать |
| **Health Check** | Проверка работоспособности |
| **i18n** | Локализованные строки (название, описание, UI виджетов) |

Разница только в runtime: builtin компилируется в Go-бинарник, dynamic запускается как отдельный процесс. Подход к разработке одинаковый.

### Модуль vs виджет

Модуль -- логическая единица (один бэкенд, одни миграции, один health check). Виджет -- визуальное представление на доске. Один модуль может предоставлять несколько виджетов:

| Модуль | Виджеты |
|--------|---------|
| `pill-tracker` | `pill-tracker.today` (компактный), `pill-tracker.history` (широкий) |
| `clock` | `clock.analog`, `clock.digital` |
| `domovoy-control` | `domovoy-control.status`, `domovoy-control.command` |

Каждый виджет описывает свои размеры через `WidgetMeta`:

```go
// internal/module/module.go
type WidgetMeta struct {
    ID      string `json:"id"`      // e.g. "today"
    Min     string `json:"min"`     // e.g. "1x1"
    Max     string `json:"max"`     // e.g. "4x3"
    Default string `json:"default"` // e.g. "2x2"
}
```

| Свойство | Описание | Пример |
|----------|----------|--------|
| `ID` | Идентификатор виджета внутри модуля | `today` |
| `Min` | Минимальный размер | `1x1` |
| `Max` | Максимальный размер | `4x3` |
| `Default` | Размер при добавлении | `2x2` |

Widget ID в layout -- составной: `{moduleId}.{widgetId}` (например `pill-tracker.today`).

Если модуль не объявляет виджеты, Registry автоматически генерирует один виджет с `ID = moduleId`, размерами `1x1` / `4x4` / `2x2`.

---

## Интерфейс модуля (Go)

### Module interface

Контракт для builtin-модулей (`internal/module/module.go`):

```go
type Module interface {
    ID() string
    Version() string
    Core() bool                          // core-модули можно отключить, но нельзя удалить
    RegisterRoutes(r chi.Router)         // HTTP-маршруты
    Migrate(db *sql.DB) error            // миграции БД
    HealthCheck(ctx context.Context) error
}
```

### Describer interface

Опциональный интерфейс для метаданных:

```go
type Describer interface {
    Describe() Meta
}

type Meta struct {
    Name        string
    Author      string
    Description string
    Homepage    string
    Widgets     []WidgetMeta
    Events      []EventMeta
}

type EventMeta struct {
    Type        string            `json:"type"`
    Description string            `json:"description"`
    Payload     map[string]string `json:"payload,omitempty"`
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

**Модуль с метаданными** (pill-tracker):

```go
func (m *Module) Describe() module.Meta {
    return module.Meta{
        Name:   "Pill Tracker",
        Author: "awbait",
        Widgets: []module.WidgetMeta{
            {ID: "today", Min: "1x1", Max: "4x3", Default: "2x2"},
            {ID: "history", Min: "2x1", Max: "4x3", Default: "4x2"},
        },
        Events: []module.EventMeta{
            {
                Type:        "pill-tracker.dose.given",
                Description: "Dose was administered",
                Payload:     map[string]string{"patient_name": "string", "medication_name": "string"},
            },
        },
    }
}
```

### ModuleInfo (API response)

Публичное представление модуля, возвращаемое `GET /api/modules`:

```go
type ModuleInfo struct {
    ID          string       `json:"id"`
    Name        string       `json:"name"`
    Version     string       `json:"version"`
    Author      string       `json:"author,omitempty"`
    Description string       `json:"description,omitempty"`
    Homepage    string       `json:"homepage,omitempty"`
    Core        bool         `json:"core"`
    Enabled     bool         `json:"enabled"`
    Type        string       `json:"type"`       // "builtin" | "dynamic"
    HasPreview  bool         `json:"has_preview,omitempty"`
    Widgets     []WidgetMeta `json:"widgets"`
    Events      []EventMeta  `json:"events,omitempty"`
}
```

---

## CoreServices -- платформенные сервисы для модулей

Каждый builtin-модуль получает `core.Services` при конструировании. Это единственный интерфейс взаимодействия с платформой (`internal/core/services.go`):

```go
type Services interface {
    // Push-уведомление конкретному пользователю
    SendPush(ctx context.Context, userID, title, body string) error

    // WebSocket всем подключённым клиентам
    BroadcastWS(ctx context.Context, event string, payload any) error

    // WebSocket конкретному пользователю
    SendWS(ctx context.Context, userID, event string, payload any) error

    // Публикация доменного события в event bus
    Publish(ctx context.Context, event Event) error

    // Подписка на события по glob-паттерну
    // Возвращает функцию отписки
    Subscribe(pattern string, handler func(Event)) UnsubscribeFunc
}
```

`Event` -- алиас на `events.Event`:

```go
// internal/core/events/bus.go
type Event struct {
    Type      string    `json:"type"`    // e.g. "pill-tracker.dose.given"
    Source    string    `json:"source"`  // module ID
    Payload   any       `json:"payload,omitempty"`
    Timestamp time.Time `json:"timestamp"`
}
```

### Реализация: WSServices

Рабочая реализация -- `core.WSServices` (`internal/core/ws_services.go`). Связывает WebSocket Hub, push-сервис и event bus:

```go
func NewWSServices(hub WSBroadcaster, bus *events.Bus) *WSServices
func (s *WSServices) SetPushService(svc *push.Service) // wiring после создания
```

Если push не настроен (нет VAPID-ключей), `SendPush` пишет debug-лог и возвращает `nil`.

Существует `StubServices` -- no-op реализация для тестирования.

---

## Структура модуля

### Builtin

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

### Dynamic (ZIP)

```
my-module.zip
  manifest.json        # id, name, version, author, widgets, events
  backend              # (опционально) скомпилированный бинарник
  widget.js            # (опционально) Web Component для фронтенда
  settings.js          # (опционально) Web Component для UI настроек
  migrations.sql       # (опционально) SQL-миграции
  preview.png          # (опционально) превью для widget picker
  locales/             # (опционально) переводы
    en.json
    ru.json
```

ZIP должен содержать минимум `manifest.json` и либо `widget.js`, либо `backend` (или оба).

### Manifest (manifest.json)

Builtin-модули описывают метаданные через Go-интерфейс `Describer`. Dynamic -- через `manifest.json`. Формат манифеста:

```go
// internal/core/dynmodule/store.go
type Manifest struct {
    ID          string             `json:"id"`
    Name        string             `json:"name"`
    Description string             `json:"description"`
    Version     string             `json:"version"`
    Author      string             `json:"author"`
    ProxyURL    string             `json:"proxy_url,omitempty"`  // legacy
    Widgets     []module.WidgetMeta `json:"widgets,omitempty"`
    Events      []module.EventMeta  `json:"events,omitempty"`
}
```

Пример:

```json
{
  "id": "pill-tracker",
  "name": "Pill Tracker",
  "version": "1.0.0",
  "author": "awbait",
  "description": "Track medication doses for pets and family members",
  "widgets": [
    { "id": "today", "min": "1x1", "max": "4x3", "default": "2x2" },
    { "id": "history", "min": "2x1", "max": "4x3", "default": "4x2" }
  ],
  "events": [
    {
      "type": "pill-tracker.dose.missed",
      "description": "Dose was not given within the scheduled window",
      "payload": { "patient_name": "string", "medication_name": "string" }
    }
  ]
}
```

---

## Жизненный цикл

Одинаковый для обоих типов:

```
Установка -> Миграции -> Маршруты -> Работа -> Выключение/Удаление
```

### Регистрация

**Builtin:** при старте в `main.go`:

```go
registry.Register(&clock.Module{})
registry.Register(pilltracker.New(db, coreSvc))
```

`Register()` автоматически делает upsert в таблицу `installed_modules`.

**Dynamic:** при загрузке ZIP через `POST /api/admin/modules/upload` или `POST /api/admin/modules/install-from-url`. Динамические модули также загружаются из БД при старте через `registry.LoadDynamic()`.

### Миграции

`registry.MigrateAll()` запускает миграции для каждого **включённого** модуля.

- Builtin: SQL через `embed.FS`
- Dynamic: `migrations.sql` из ZIP (выполняется при `Install()`)

Конвенция: таблицы с префиксом модуля (`pt_patients`, `pt_medications`).

### Маршруты

Все модули доступны под `/api/modules/{id}/...`:

- Builtin: маршруты монтируются напрямую через `chi.Router` в `MountAll()`
- Dynamic: запросы к `/api/modules/{id}/api/*` проксируются на subprocess через reverse proxy

### Включение/выключение

`PATCH /api/admin/modules/{id}` с `{"enabled": true/false}`. Состояние в `installed_modules.enabled`.

### Удаление

`DELETE /api/admin/modules/{id}` -- только для не-core модулей. Удаляет из БД, из layouts всех пользователей и из in-memory registry.

---

## Dynamic runtime

Детали, специфичные для dynamic-модулей.

### Бэкенд-процесс

Бинарник запускается как subprocess с окружением:

| Переменная | Описание |
|-----------|----------|
| `PORT` | Назначенный порт (из пула, сохраняется в БД) |
| `MODULE_ID` | Идентификатор модуля |
| `DATA_DIR` | Директория данных модуля |
| `DB_PATH` | Путь к SQLite БД |

**Handshake-протокол:** бинарник пишет в stdout JSON:

```json
{"protocol": "focus-module/1", "port": 8081}
```

ProcessManager ждёт handshake (15 сек таймаут) + проверяет `GET /health` (ещё 15 сек), после чего начинает проксирование.

**Управление процессами:**

- `ProcessManager.StartAll(ctx)` -- запуск всех enabled dynamic-модулей с бинарниками при старте
- `ProcessManager.StartModule(id)` -- горячий запуск после `Upload`/`InstallFromURL`
- `ProcessManager.StopModule(id)` -- остановка перед обновлением (SIGTERM + 5 сек WaitDelay)
- Автоматический перезапуск при crash с exponential backoff (1s -> 30s max)
- При `Upload` -- старый процесс останавливается, бинарник записывается атомарно (tmp + rename), новый процесс запускается

### Фронтенд

`widget.js` загружается как `<script type="module">` и рендерится как Web Component. Для модуля с несколькими виджетами один `widget.js` регистрирует несколько Custom Elements.

---

## События (Event Bus)

In-memory pub/sub шина (`internal/core/events/bus.go`) -- основной механизм межмодульного взаимодействия без прямых зависимостей.

### Архитектура

```go
// internal/core/events/bus.go
type Bus struct {
    mu   sync.RWMutex
    subs map[uint64]subscriber
    seq  uint64
}

func New() *Bus
func (b *Bus) Publish(ctx context.Context, event Event) error
func (b *Bus) Subscribe(pattern string, handler func(Event)) UnsubscribeFunc
```

Ключевые свойства:
- Каждый handler запускается в отдельной горутине (fan-out)
- Паники в handler'ах перехватываются (один сбойный подписчик не ломает остальных)
- `Publish` не блокируется на выполнении handler'ов

### Паттерны подписки

Glob-стиль, точка как разделитель сегментов. `*` -- один сегмент:

| Паттерн | Событие | Совпадение |
|---------|---------|------------|
| `pill-tracker.dose.*` | `pill-tracker.dose.given` | да |
| `pill-tracker.dose.*` | `pill-tracker.dose` | нет (разное кол-во сегментов) |
| `pill-tracker.*.*` | `pill-tracker.dose.given` | да |
| `*` | `anything` | да |
| `*.*` | `a.b` | да |

`**` (multi-segment wildcard) **не поддерживается**.

### Публикация (Builtin)

```go
s.core.Publish(ctx, core.Event{
    Type:    "pill-tracker.dose.given",
    Source:  "pill-tracker",
    Payload: map[string]any{"patient": "Барсик", "medication": "Рибоксин"},
})
```

### Подписка (Builtin)

```go
unsub := s.core.Subscribe("pill-tracker.dose.*", func(e core.Event) {
    // реагировать на событие
})
// позже: unsub()
```

### Публикация (Dynamic)

```
POST /internal/events/publish
Content-Type: application/json

{"type": "my-module.data.updated", "source": "my-module", "payload": {...}}
```

Обязательные поля: `type`, `source`. Timestamp проставляется автоматически.

### Подписка (Dynamic) -- Webhook

```
POST /internal/events/subscribe
Content-Type: application/json

{"pattern": "pill-tracker.dose.*", "webhook": "http://127.0.0.1:8081/on-dose-event"}
```

Ответ:

```json
{"ok": true, "subscriber_id": "wh-0"}
```

При совпадении события `WebhookForwarder` делает `POST` на указанный URL с JSON-телом `Event`. Таймаут: 5 секунд.

---

## WebSocket (Realtime)

Модули обновляют UI в реальном времени через WebSocket Hub, без polling.

### Бэкенд -> фронтенд

**Builtin:**

```go
// Обновить виджет у всех пользователей
s.core.BroadcastWS(ctx, "pill-tracker.dose.updated", payload)

// Или конкретному пользователю
s.core.SendWS(ctx, userID, "pill-tracker.dose.updated", payload)
```

**Dynamic:**

```
POST /internal/ws/broadcast
Content-Type: application/json

{"event": "my-module.data.updated", "payload": {...}}
```

```
POST /internal/ws/send
Content-Type: application/json

{"user_id": "...", "event": "my-module.data.updated", "payload": {...}}
```

Ответ: `{"ok": true}`. Обязательные поля: `event` (для broadcast), `event` + `user_id` (для send).

### Фронтенд -- WSManager

Singleton `wsManager` (`frontend/src/lib/ws.ts`) управляет WebSocket-соединением:

```ts
class WSManager {
    connect(): void           // подключение к /api/ws
    disconnect(): void        // отключение + остановка reconnect
    on(eventType: string, listener: (payload: unknown) => void): () => void
    onAny(listener: (msg: WSMessage) => void): () => void
}

// Singleton
export const wsManager = new WSManager()
```

Автоматический reconnect с exponential backoff (1s -> 30s max). Сообщение `{"type": "ping"}` игнорируется.

Формат WS-сообщения:

```ts
interface WSMessage {
    type: string
    payload?: unknown
}
```

### Фронтенд -- React hook

```tsx
// frontend/src/hooks/useWSEvent.ts
function useWSEvent(eventType: string, callback: (payload: unknown) => void): void
```

Использует stable ref для callback, не переподписывается при каждом рендере. Отписка в cleanup.

Пример:

```tsx
useWSEvent("pill-tracker.dose.updated", (data) => {
    refetchDoses()
})
```

### Конвенция имён событий

`{module-id}.{entity}.{action}` -- например `pill-tracker.dose.updated`, `clock.tick`.

---

## Push-уведомления

Web Push через VAPID. Модули отправляют уведомления через CoreServices. Push опционален -- работает только при настроенных VAPID-ключах.

### Бэкенд

**Builtin:**

```go
s.core.SendPush(ctx, userID, "Таблетница", "Барсику пора давать Рибоксин")
```

**Dynamic:**

```
POST /internal/push
Content-Type: application/json

{"user_id": "...", "title": "Таблетница", "body": "Барсику пора давать Рибоксин"}
```

Обязательные поля: `user_id`, `title`. Ответ: `{"ok": true}`.

### Реализация

`push.Service` (`internal/core/push/service.go`):

```go
func NewService(repo *Repository, vapidPublicKey, vapidPrivateKey, vapidSubject string) *Service
func (s *Service) Send(ctx context.Context, userID, title, body string) error
func (s *Service) VAPIDPublicKey() string
```

- Возвращает `nil` из конструктора если VAPID-ключи не настроены (push отключён)
- `Send()` отправляет уведомление на **все** подписки пользователя
- Автоматически удаляет stale-подписки (HTTP 404/410 от push-сервиса)
- TTL уведомления: 60 секунд
- Библиотека: `github.com/SherClockHolmes/webpush-go`

### Публичные эндпоинты (фронтенд)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/push/vapid-key` | Получить VAPID public key (501 если push не настроен) |
| POST | `/api/push/subscribe` | Сохранить browser push subscription (auth required) |
| DELETE | `/api/push/subscribe` | Удалить subscription (auth required) |

### Фронтенд -- push registration

```ts
// frontend/src/lib/push.ts
async function registerPush(): Promise<boolean>   // после логина
async function unregisterPush(): Promise<void>    // при логауте
```

`registerPush()`:
1. Проверяет поддержку (`navigator.serviceWorker` + `PushManager`)
2. Запрашивает `Notification.requestPermission()`
3. Регистрирует Service Worker (`/sw.js`)
4. Получает VAPID key с `GET /api/push/vapid-key`
5. Подписывается через `pushManager.subscribe()`
6. Отправляет subscription на `POST /api/push/subscribe`

`unregisterPush()`:
1. Отписывается локально (`subscription.unsubscribe()`)
2. Уведомляет бэкенд через `DELETE /api/push/subscribe`

---

## Widget Bridge SDK (Dynamic-модули)

SDK для dynamic-виджетов -- глобальный объект `window.FocusSDK` (`frontend/src/lib/focus-widget-sdk.ts`).

### Инициализация

В `connectedCallback` Web Component:

```js
const focus = window.FocusSDK.create(this)
focus.ready()
```

Host-элемент должен иметь атрибуты `data-module-id` и `data-widget-id`.

### API

```ts
interface FocusInstance {
    // Сигнал готовности виджета (dispatches CustomEvent "focus-widget-ready")
    ready(): void

    // HTTP-запрос к бэкенду модуля
    // Путь автопрефиксируется: /api/modules/{moduleId}/api/{path}
    api<T>(method: string, path: string, body?: unknown): Promise<T>

    // Получить настройки виджета
    // GET /api/modules/{moduleId}/api/widget-settings/{widgetId}
    getSettings<T>(): Promise<T>

    // Получить ID виджета из data-widget-id
    getWidgetId(): string

    // Подписка на WS-событие модуля
    // Событие автопрефиксируется: "{moduleId}.{event}"
    on(event: string, callback: (payload: unknown) => void): () => void
}
```

### Глобальная типизация

```ts
interface FocusSDKGlobal {
    create(host: HTMLElement): FocusInstance
}

declare global {
    interface Window {
        FocusSDK: FocusSDKGlobal
    }
}
```

### Пример виджета

```js
class MyWidget extends HTMLElement {
    connectedCallback() {
        const focus = window.FocusSDK.create(this)
        focus.ready()

        focus.api('GET', '/data').then(data => {
            this.innerHTML = `<div>${data.value}</div>`
        })

        this.unsub = focus.on('data.updated', (payload) => {
            // реагировать на realtime-событие
        })
    }

    disconnectedCallback() {
        if (this.unsub) this.unsub()
    }
}

customElements.define('my-module-widget', MyWidget)
```

---

## Фронтенд-интеграция

### Widget Registry

Маппинг builtin widget ID -> React-компонент в `frontend/src/core/widgets.tsx`. Метаданные (размеры, список виджетов) приходят из API, не хардкодятся:

```tsx
// Маппинг ID -> компонент (поддерживает legacy и compound ID)
const BUILTIN_COMPONENTS: Record<string, ComponentType> = {
  clock: ClockWidget,
  'pill-tracker': PillTrackerWidget,
  'clock.clock': ClockWidget,
  'pill-tracker.today': PillTrackerWidget,
}

// Список доступных виджетов строится из GET /api/modules
getAvailableWidgets(modules: ModuleInfo[]): AvailableWidget[]
```

`renderWidget(widgetId, modules)` выбирает рендеринг:
1. Builtin -> React-компонент из `BUILTIN_COMPONENTS`
2. Dynamic-модуль -> `<DynamicWidget moduleId={moduleId} widgetId={widgetId} />`
3. Неизвестный -> placeholder

Для dynamic-модулей один `widget.js` регистрирует несколько Web Components (`<pill-tracker-today>`, `<pill-tracker-history>`).

### Добавление виджета на доску

BoardPage -> Widget Picker -> список виджетов из всех модулей (один модуль может предоставлять несколько) -> добавление в react-grid-layout.

### Preview images

Dynamic-модули могут включать `preview.png` в ZIP. Если файл есть, `ModuleInfo.has_preview = true` и изображение доступно по `GET /api/modules/{id}/preview.png` (Cache-Control: 24 часа). Widget Picker использует превью при отображении списка.

---

## Настройки модуля

Два уровня, одинаковые для обоих типов:

| Уровень | Таблица | Ключ | Кто управляет |
|---------|---------|------|---------------|
| Глобальные | `settings` | `key` | Администратор |
| Per-user per-module | `user_module_settings` | `(user_id, module_id, widget_id)` | Пользователь |

API:
- `GET /api/settings/module?module=X&widget=Y` (auth required)
- `PUT /api/settings/module?module=X&widget=Y` (auth required)

---

## i18n

Модули используют общую систему i18n дашборда -- i18next с JSON-файлами локалей.

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

В компонентах -- стандартный `useTranslation()`:

```tsx
const { t } = useTranslation()
t('pillTracker.widget.today') // -> "Сегодня"
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

Файлы сохраняются на диск и доступны по `GET /api/modules/{id}/locales/{lang}.json` (Cache-Control: 1 час). Фронтенд загружает их через `i18next.addResourceBundle(lang, moduleId, json)`.

---

## Internal HTTP API (для dynamic-модулей)

Эндпоинты доступны **только с loopback-адресов** (127.0.0.0/8 и ::1). Защита через middleware `LoopbackOnly` -- проверяет `r.RemoteAddr`, а не заголовки.

| Метод | Путь | Тело запроса | Ответ |
|-------|------|-------------|-------|
| POST | `/internal/ws/broadcast` | `{"event": "...", "payload": {...}}` | `{"ok": true}` |
| POST | `/internal/ws/send` | `{"user_id": "...", "event": "...", "payload": {...}}` | `{"ok": true}` |
| POST | `/internal/push` | `{"user_id": "...", "title": "...", "body": "..."}` | `{"ok": true}` |
| POST | `/internal/events/publish` | `{"type": "...", "source": "...", "payload": {...}}` | `{"ok": true}` |
| POST | `/internal/events/subscribe` | `{"pattern": "...", "webhook": "http://..."}` | `{"ok": true, "subscriber_id": "wh-0"}` |

---

## Публичные API

### Модули

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/modules` | Список всех модулей с метаданными |
| GET | `/api/modules/{id}/widget.js` | JS-бандл виджета (dynamic) |
| HEAD | `/api/modules/{id}/settings.js` | Проверка наличия settings.js |
| GET | `/api/modules/{id}/settings.js` | JS-бандл настроек (dynamic) |
| GET | `/api/modules/{id}/preview.png` | Превью модуля (dynamic) |
| GET | `/api/modules/{id}/locales/{lang}.json` | JSON переводов (dynamic) |
| * | `/api/modules/{id}/api/*` | API модуля (dynamic, через reverse proxy) |
| * | `/api/modules/{id}/*` | API модуля (builtin, напрямую) |

### Push

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/push/vapid-key` | VAPID public key (public) |
| POST | `/api/push/subscribe` | Сохранить push-подписку (auth) |
| DELETE | `/api/push/subscribe` | Удалить push-подписку (auth) |

### Административные

| Метод | Путь | Описание |
|-------|------|----------|
| PATCH | `/api/admin/modules/{id}` | Включение/выключение |
| DELETE | `/api/admin/modules/{id}` | Удаление (не-core) |
| POST | `/api/admin/modules/upload` | Установка из ZIP (multipart) |
| POST | `/api/admin/modules/install-from-url` | Установка по URL |
| POST | `/api/admin/modules/check-updates` | Проверка обновлений |
| GET | `/api/admin/community-modules` | Каталог модулей (кэш 1 час) |

---

## Health Check

- `GET /api/health` вызывает `HealthAll()` -- проверяет все включённые модули
- Builtin: вызов `HealthCheck(ctx)` в процессе
- Dynamic: `GET /health` на порту subprocess (при handshake)
- При ошибке любого модуля -- HTTP 503

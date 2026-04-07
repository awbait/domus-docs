# План: Эволюция модульной системы focus-dashboard

## Context

Модульная система focus-dashboard работает (builtin + dynamic модули), но спецификации в `module-system.md` и `module-system-analysis.md` описывают целевую архитектуру с рядом улучшений: множественные виджеты на модуль, CoreServices для push/WS/событий, Widget Bridge SDK и другие. Нужно спланировать поэтапную реализацию и создать задачи в tasks.md.

---

## Фаза 0 — CoreServices interface (фундамент)

**Зачем:** Все последующие фазы (push, WS broadcast, event bus) зависят от единого интерфейса сервисов ядра, передаваемого модулям при создании. Без него модули получают только `*sql.DB`.

### Задача 0.1: Определить CoreServices interface

**Файлы:**
- `internal/core/services.go` (новый) — интерфейс + реализация
- `internal/module/module.go` — не менять Module interface, CoreServices передаётся отдельно
- `cmd/dashboard/main.go` — создать CoreServices, передать в модули

```go
// internal/core/services.go
type Services interface {
    SendPush(ctx context.Context, userID, title, body string) error
    BroadcastWS(ctx context.Context, event string, payload any) error
    SendWS(ctx context.Context, userID, event string, payload any) error
    Publish(ctx context.Context, event Event) error
    Subscribe(pattern string, handler func(Event)) UnsubscribeFunc
}
```

**Подход:** Создать интерфейс и stub-реализацию (no-op). Модули получают `core.Services` через конструктор. Реальные реализации подключаются в следующих фазах.

**Сложность:** Низкая

### Задача 0.2: Передать CoreServices в модули

**Файлы:**
- `modules/pill-tracker/module.go` — `New(db, core)` вместо `New(db)`
- `modules/clock/module.go` — добавить core в конструктор (не использует пока)
- `cmd/dashboard/main.go` — wire

**Сложность:** Низкая

---

## Фаза 1 — Унификация DX: множественные виджеты + метаданные

**Зачем:** Один модуль (pill-tracker) сможет предоставлять несколько виджетов (today, history). Фронтенд получает список виджетов из API вместо хардкода.

### Задача 1.1: Расширить Meta и Manifest — WidgetMeta, EventMeta

**Файлы:**
- `internal/module/module.go` — добавить `WidgetMeta{ID, Min, Max, Default}`, `EventMeta{Type, Description, Payload}`, расширить `Meta` полями `Widgets []WidgetMeta`, `Events []EventMeta`
- `internal/module/loader.go` — `buildModuleInfo()` включает widgets/events из Describe()
- `internal/core/dynmodule/store.go` — парсить `widgets` и `events` из manifest.json

**Сложность:** Низкая-средняя

### Задача 1.2: Обновить GET /api/modules — отдавать виджеты

**Файлы:**
- `internal/module/loader.go` — `ModuleInfo` включает `Widgets []WidgetInfo` в JSON
- Добавить fallback: если модуль не описал виджеты, генерировать один виджет с id = moduleId (обратная совместимость)

**Сложность:** Низкая

### Задача 1.3: Обновить builtin-модули — описать виджеты

**Файлы:**
- `modules/pill-tracker/module.go` — `Describe()` возвращает Widgets: [{ID: "today", ...}, {ID: "history", ...}] и Events
- `modules/clock/module.go` — Describe() с одним виджетом

**Сложность:** Низкая

### Задача 1.4: Frontend — динамический Widget Registry из API

**Файлы:**
- `frontend/src/core/widgets.tsx` — заменить хардкод `WIDGET_REGISTRY` на данные из `GET /api/modules`. Оставить маппинг widget ID → React-компонент для builtin
- `frontend/src/hooks/useModules.ts` (новый или существующий) — fetch + cache модулей с виджетами
- `frontend/src/pages/BoardPage.tsx` — адаптировать renderWidget для составных ID (`pill-tracker.today`)
- `frontend/src/components/DynamicWidget.tsx` — принимать widgetId, рендерить `<{moduleId}-{widgetId}-widget>`

**React best practices:** React.lazy() для builtin-компонентов, useMemo для маппинга, избегать re-render при смене layout.

**Сложность:** Средняя

---

## Фаза 2 — WebSocket broadcast для модулей

**Зачем:** Модули смогут обновлять виджеты в реальном времени без polling. WS Hub уже есть, нужно только экспонировать его через CoreServices.

### Задача 2.1: Подключить WS Hub к CoreServices

**Файлы:**
- `internal/core/services.go` — реализовать BroadcastWS/SendWS через существующий Hub
- `internal/server/server.go` — передать Hub в CoreServices при создании
- `cmd/dashboard/main.go` — wire

**Сложность:** Низкая

### Задача 2.2: HTTP endpoints для dynamic модулей

**Файлы:**
- `internal/server/server.go` — добавить `POST /internal/ws/broadcast`, `POST /internal/ws/send`
- Middleware: только localhost (127.0.0.1)

**Сложность:** Низкая

### Задача 2.3: Frontend — useWSEvent hook

**Файлы:**
- `frontend/src/hooks/useWSEvent.ts` (новый) — подписка на WS-события по имени
- Использовать в pill-tracker Widget для автообновления

**React best practices:** useEffect cleanup для отписки, stable callback ref, не пересоздавать подписку при каждом ре-рендере.

**Сложность:** Низкая

---

## Фаза 3 — Push-уведомления

**Зачем:** pill-tracker push при пропущенной дозе. `internal/core/push/` пуст, VAPID ключи в конфиге.

### Задача 3.1: Backend — push service

**Файлы:**
- `internal/core/push/service.go` (новый) — Web Push API (VAPID), отправка уведомлений
- `internal/core/push/repository.go` (новый) — таблица `push_subscriptions` (user_id, endpoint, keys, created_at)
- `internal/core/push/handler.go` (новый) — `POST /api/push/subscribe`, `DELETE /api/push/subscribe`
- `internal/core/push/migrations/` — SQL миграция
- `internal/core/services.go` — подключить реальную реализацию SendPush

**Go best practices:** Интерфейс `Sender` для тестируемости, context propagation, structured logging, graceful error handling при недоступном endpoint.

**Сложность:** Средняя-высокая

### Задача 3.2: HTTP endpoint для dynamic модулей

**Файлы:**
- `internal/server/server.go` — `POST /internal/push` (localhost-only)

**Сложность:** Низкая

### Задача 3.3: Frontend — Service Worker + подписка

**Файлы:**
- `frontend/public/sw.js` (новый) — Service Worker, обработка push-событий
- `frontend/src/lib/push.ts` (новый) — регистрация SW, подписка, отправка subscription на backend
- `frontend/src/App.tsx` — инициализация push при загрузке

**Сложность:** Средняя

### Задача 3.4: pill-tracker — интеграция push

**Файлы:**
- `modules/pill-tracker/service.go` — логика: проверка пропущенных доз, вызов `core.SendPush()`
- Нужен cron/ticker для периодической проверки

**Сложность:** Средняя

---

## Фаза 4 — Event Bus

**Зачем:** Межмодульное взаимодействие. pill-tracker публикует `dose.missed`, domovoy-control подписывается и озвучивает.

### Задача 4.1: In-memory pub/sub

**Файлы:**
- `internal/core/events/bus.go` (новый) — Bus struct, Publish(), Subscribe(), pattern matching (glob `*`)
- `internal/core/events/event.go` (новый) — Event struct
- `internal/core/services.go` — подключить Bus к CoreServices

**Go best practices:** sync.RWMutex для подписчиков, fan-out в горутинах с recover, context cancellation для unsubscribe.

**Сложность:** Средняя

### Задача 4.2: HTTP endpoints для dynamic модулей

**Файлы:**
- `internal/core/events/handler.go` (новый) — `POST /internal/events/publish`, `POST /internal/events/subscribe`
- Webhook delivery: при подписке dynamic-модуль указывает callback URL, Bus делает POST при событии

**Сложность:** Средняя

### Задача 4.3: pill-tracker — публикация событий

**Файлы:**
- `modules/pill-tracker/service.go` — `core.Publish()` при give/skip/missed
- `modules/pill-tracker/module.go` — Events в Describe()

**Сложность:** Низкая

---

## Фаза 5 — Widget Bridge SDK

**Зачем:** Стандартизированный JS API для dynamic-виджетов вместо голых fetch().

### Задача 5.1: Написать focus-widget-sdk

**Файлы:**
- `frontend/src/lib/focus-widget-sdk.ts` (новый) — Focus.ready(), Focus.api(), Focus.getSettings(), Focus.on(), Focus.getWidgetId()
- Публиковать как npm-пакет или встроить в runtime dynamic-виджетов

**Сложность:** Средняя

### Задача 5.2: DynamicWidget — инжектировать SDK

**Файлы:**
- `frontend/src/components/DynamicWidget.tsx` — передавать SDK instance через window или custom event при монтировании Web Component

**Сложность:** Низкая

---

## Фаза 6 — Widget Preview + i18n dynamic

**Зачем:** Улучшение UX и DX.

### Задача 6.1: Preview endpoint + Widget Picker

**Файлы:**
- `internal/core/dynmodule/handler.go` — `GET /api/modules/{id}/preview.png`
- `internal/core/dynmodule/store.go` — извлекать preview.png из ZIP
- Frontend Widget Picker — показывать превью

**Сложность:** Низкая

### Задача 6.2: i18n для dynamic-модулей

**Файлы:**
- `internal/core/dynmodule/store.go` — извлекать `locales/*.json` из ZIP
- `internal/core/dynmodule/handler.go` — `GET /api/modules/{id}/locales/{lang}.json`
- `frontend/src/components/DynamicWidget.tsx` — при монтировании загрузить и зарегистрировать через `i18next.addResourceBundle()`

**Сложность:** Низкая-средняя

---

## Порядок и зависимости

```
Фаза 0 (CoreServices) ← фундамент для всего
  ↓
Фаза 1 (виджеты + метаданные) ← можно параллельно с Фазой 2
  ↓
Фаза 2 (WS broadcast) ← зависит от Фазы 0
  ↓
Фаза 3 (Push) ← зависит от Фазы 0
  ↓
Фаза 4 (Event Bus) ← зависит от Фазы 0
  ↓
Фаза 5 (Widget Bridge SDK) ← независима, можно параллельно с 3-4
  ↓
Фаза 6 (Preview + i18n) ← независима
  ↓
Шаблонный модуль ← после Фаз 1 + 5
```

**Параллельно можно:**
- Фазу 1 и Фазу 2
- Фазу 3 и Фазу 4
- Фазу 5 и Фазу 6

---

## Верификация

Для каждой фазы:
1. `go build ./...` — компиляция
2. `go test ./...` — тесты
3. `cd frontend && bun run build` — фронтенд билд
4. `cd frontend && bun run lint` — линтер
5. Ручная проверка: запустить dashboard, проверить Widget Picker, добавить виджет на доску
6. Для push: проверить в Chrome DevTools → Application → Service Workers
7. lefthook проверит при push

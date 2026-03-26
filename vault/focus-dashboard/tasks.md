---

kanban-plugin: board
icon: MiLayoutDashboard

---

## Ideas

- [ ] pill-tracker: push-уведомления (VAPID) #module #p1
	Перенесено в Фазу 3 модульной системы. [[module-system-analysis#Фаза 3 — Push-уведомления]]
- [ ] Модуль: Управление Домовым (domovoy-control) #module #p2
	Backend: proxy к HTTP API Домового (текстовые команды, история, hub/spoke статус). Frontend: виджет 2x2 + полноэкранный режим с логом команд и статусом нод. Зависит от наличия HTTP API в Домовом.
- [ ] Модуль: Погода #module #backlog
	Open-Meteo (бесплатный, без ключа). Виджет: температура + иконка + 5 дней. Расширенный: почасовой график, ощущается как, давление.
- [ ] Модуль: Календарь #module #backlog
	CalDAV (Nextcloud) / Google Calendar / Яндекс. Виджет: ближайшие 3-5 событий. Расширенный: неделя/месяц.
- [ ] Модуль: Задачи / To-Do #module #backlog
	Простые списки. Интеграция с Todoist / TickTick или встроенный менеджер. Повторяющиеся задачи.
- [ ] Модуль: Таймер / Помодоро #module #backlog
	Несколько одновременных таймеров, пресеты (5/10/25 мин), уведомление по окончании.
- [ ] Модуль: Трекер привычек #module #backlog
	Ежедневные привычки, streak-цепочка, визуализация.
- [ ] Модуль: Финансы #module #backlog
	Быстрое добавление расходов, категории, итоги за месяц. Опционально: Тинькофф API.
- [ ] Модуль: Медиа (Jellyfin) #module #backlog
	Текущий трек/фильм, управление воспроизведением через Jellyfin API.
- [ ] Модуль: Инвентарь + Список покупок #module #backlog
	Домашний инвентарь с целевым количеством, голосовое добавление через Домовой, список покупок на телефон.
- [ ] Модуль: Заметки (sticky notes) #module #backlog
	Быстрые заметки, семейные объявления.
- [ ] Модуль: Фото (Immich) #module #backlog
	Слайд-шоу семейных фото через Immich API.
- [ ] OIDC: маппинг групп → роли #auth #backlog
	Маппинг групп Authentik/Authelia/Keycloak → роли (owner/resident/guest). Сейчас все OIDC-юзеры получают `DefaultRole`. Нужно: claim `groups` из ID token → конфигурируемый маппинг group→role.
- [ ] Offline-режим (PWA) #pwa #backlog
	Service worker: кэш статики + последних API-ответов, дашборд работает без сети. `manifest.json` уже есть, SW нет.
- [ ] Light/dark тема: переключатель #ui #backlog
	Явный toggle в UI. Tailwind `dark:` варианты уже используются в shadcn/ui, но переключение только через OS preference. Нужен: ThemeProvider + toggle в ProfilePage/SideMenu + сохранение в localStorage/settings.


## Planned

### Модульная система — эволюция

Спецификация: [[module-system]] | Анализ: [[module-system-analysis]]

- [ ] Фаза 0: CoreServices interface #arch #p1
	Интерфейс `core.Services` (SendPush, BroadcastWS, SendWS, Publish, Subscribe) + stub-реализация (no-op). Передать в модули через конструктор: `pilltracker.New(db, core)`. Фундамент для фаз 2–4. Файлы: `internal/core/services.go`, `modules/*/module.go`, `cmd/dashboard/main.go`.
- [ ] Фаза 1: Множественные виджеты + метаданные #arch #p1
	Один модуль → несколько виджетов. `WidgetMeta{ID, Min, Max, Default}`, `EventMeta` в Describe(). Парсинг `widgets`/`events` из manifest.json. Фронтенд: заменить хардкод `WIDGET_REGISTRY` на данные из `GET /api/modules`, составные ID (`pill-tracker.today`), React.lazy(). Файлы: `internal/module/module.go`, `loader.go`, `dynmodule/store.go`, `frontend/src/core/widgets.tsx`, `BoardPage.tsx`, `DynamicWidget.tsx`.
- [ ] Фаза 2: WebSocket broadcast для модулей #arch #p1
	Подключить существующий WS Hub к CoreServices (BroadcastWS/SendWS). HTTP endpoints `POST /internal/ws/broadcast`, `/internal/ws/send` (localhost-only) для dynamic. Frontend: хук `useWSEvent()`. Файлы: `internal/core/services.go`, `internal/server/server.go`, `frontend/src/hooks/useWSEvent.ts`.
- [ ] Фаза 3: Push-уведомления #arch #p2
	Реализовать `internal/core/push/` (VAPID, Web Push API, таблица `push_subscriptions`). HTTP endpoints: `POST /api/push/subscribe`, `POST /internal/push`. Service Worker + подписка на фронтенде. pill-tracker: cron проверка пропущенных доз → `core.SendPush()`. Файлы: `internal/core/push/`, `frontend/public/sw.js`, `frontend/src/lib/push.ts`, `modules/pill-tracker/service.go`.
- [ ] Фаза 4: Event Bus #arch #p2
	In-memory pub/sub с pattern matching (`pill-tracker.dose.*`). HTTP endpoints для dynamic: `POST /internal/events/publish`, `/internal/events/subscribe` + webhook delivery. pill-tracker публикует события при give/skip/missed. Файлы: `internal/core/events/`, `modules/pill-tracker/service.go`.
- [ ] Фаза 5: Widget Bridge SDK #arch #p2
	JS-библиотека `focus-widget-sdk` для dynamic-виджетов: `Focus.ready()`, `Focus.api()`, `Focus.getSettings()`, `Focus.on()`, `Focus.getWidgetId()`. Инжектировать через DynamicWidget. Файлы: `frontend/src/lib/focus-widget-sdk.ts`, `frontend/src/components/DynamicWidget.tsx`.
- [ ] Фаза 6: Widget Preview + i18n dynamic #arch #p3
	`preview.png` в модулях, endpoint `GET /api/modules/{id}/preview.png`, Widget Picker показывает превью. Dynamic i18n: `locales/*.json` в ZIP, регистрация через `addResourceBundle()`. Файлы: `internal/core/dynmodule/handler.go`, `store.go`, `DynamicWidget.tsx`.
- [ ] Шаблонный модуль example-counter #arch #p3
	Минимальный fullstack dynamic-модуль (Go backend + Web Component) в `focus-modules/` как образец. После Фаз 1 + 5.

### Другое

- [ ] Кастомизация: фоновое изображение #ui #backlog
	Фоновое изображение для board (URL или загрузка файла). Нужно: поле `background_image` в модели board, endpoint upload, CSS background в BoardPage. Акцентный цвет уже реализован (oklch hue picker).
- [ ] Self-service PIN #auth
	Авторизированный пользователь может сам установить/сменить PIN из ProfilePage. Сейчас PIN задаёт только admin (UsersPanel). Нужно: `PUT /api/profile/pin` endpoint + форма в ProfilePage.
- [ ] Статистика ресурсов модулей #arch #backlog
	Метрики CPU/memory per module. Сейчас `HealthAll()` возвращает только pass/fail. Нужно: расширить health endpoint метриками, UI в AdminPage > Modules.


## In Progress



## Done

- [x] setup не должен открываться, если уже настроено
- [x] Swagger / OpenAPI #arch #backlog
	`swaggo/swag` аннотации в хэндлерах ядра и модулей → единый spec на `/api/swagger/`.
- [x] Backend Фаза 1: фундамент #arch
	Config (caarlos0/env + godotenv), DB (SQLite WAL + 12 миграций), Module interface + Registry (MigrateAll, MountAll, HealthAll), chi-роутер + graceful shutdown + middleware.
- [x] Backend Фаза 1: auth #auth
	Модель, репозиторий, сервис (bcrypt + JWT), middleware (Bearer + cookie), handler. Setup wizard (первый запуск → `/setup`). Роли: admin / user / viewer.
- [x] Backend: OIDC/Authentik #auth
	`internal/core/auth/oidc.go` — интеграция с Authentik. Login через OIDC, автоматическое создание пользователя.
- [x] Backend Фаза 1: pill-tracker модуль #module
	Полный fullstack-модуль: patients, medications, schedules, dose logs. CRUD API, статус доз на сегодня, история. Migrations embed.
- [x] Backend: clock модуль #module
	`modules/clock/module.go` — серверный модуль часов.
- [x] Backend Фаза 2: layout #layout
	`GET/PUT /api/layout?mode=desktop|mobile` — per-user. `GET/PUT /api/admin/layout?mode=wall&shared=true` — shared wall (user_id = NULL).
- [x] Backend Фаза 2: settings, links, backup, websocket #arch
	`GET/PATCH /api/admin/settings`, `CRUD /api/admin/links`, `GET /api/admin/backup` + `POST /api/admin/backup/restore`, gorilla/websocket Hub с Broadcast/BroadcastTo.
- [x] Backend: boards (мультидосочная система) #arch
	`internal/core/board/` — модель, репозиторий, handler. Маршруты `/b/:slug`, personal + shared доски.
- [x] Backend: dynamic modules #arch
	`internal/core/dynmodule/` — ZIP upload, process, proxy, community registry. `internal/module/loader.go` — загрузка динамических модулей.
- [x] Frontend: auth + роутинг #ui
	LoginPage, SetupPage, OIDC login, AuthContext, защищённые маршруты, authApi.
- [x] Frontend: BoardPage #ui
	Grid layout (react-grid-layout), edit mode, fullscreen, mobile swipe между досками, add/remove widgets, widget registry. Сохранение layout per-user.
- [x] Frontend: AdminPage #ui
	Sidebar навигация. Панели: пользователи, внешние ссылки (CRUD), настройки, модули (all / installed). Toggle enable/disable модуля, настройки модуля в диалоге.
- [x] Frontend: ProfilePage #ui
	Страница профиля пользователя. Accent color picker (oklch hue).
- [x] Frontend: SideMenu #ui
	Боковое меню на десктопе + нижняя панель навигации на мобильных.
- [x] Frontend: pill-tracker Widget + SettingsPage #module
	Виджет с дозами на сегодня, отметка дозы одним тапом. Страница настроек: patients, medications, schedules.
- [x] Frontend: Clock Widget #module
	`frontend/src/components/widgets/ClockWidget.tsx` — виджет часов.
- [x] Frontend: DynamicWidget #ui
	`frontend/src/components/DynamicWidget.tsx` — загрузка внешних модулей как web components.
- [x] Frontend: UI компоненты #ui
	17 shadcn/ui компонентов, toast system, accent system (oklch hue). API-клиенты для всех эндпоинтов.
- [x] Wall mode #layout
	WallPage (`/wall`): full-screen, загружает shared layout. Admin: overlay-контролы, edit/done, add/remove widgets.
- [x] PWA: manifest.json #pwa
	`frontend/public/manifest.json` — name, icons, display standalone, theme_color.
- [x] Dockerfile multi-stage + docker-compose #infra
	`Dockerfile` — multi-stage (Bun + Go + alpine). `docker-compose.yml` — dashboard + Authentik profile.
- [x] CI + Release workflows #infra
	`.github/workflows/ci.yml` — lint/test/build. `.github/workflows/release.yml` — tag + GitHub Release + Docker image.
- [x] lefthook (pre-push hooks) #infra
	`lefthook.yml` — git hooks для проверок перед push.
- [x] Resize handle для виджетов на тач-экранах #ui
	В режиме редактирования видимая кнопка растяжения виджета (мобильные + планшеты).
- [x] Админка для разных экранов #ui
	Адаптивная админ-панель под разные размеры экранов.
- [x] Wall: переключение пользователя + PIN #auth
	PIN login (5 цифр, bcrypt), user picker в SideMenu, переход на personal board.
- [x] Wall: таймаут + возврат в shared #ui
	`wall_timeout_minutes` в настройках, inactivity timer в BoardPage, авто-логаут.
- [x] Mobile layout mode #ui
	3 режима (wall/desktop/mobile), swipe между досками, адаптивная сетка, touch targets.
- [x] Визуальное отображение ячеек в режиме редактирования #ui
	12-колоночная grid-overlay с полупрозрачными ячейками, dashed-outline на виджетах, slide boundary lines на мобильных.
- [x] i18n #ui
	i18next + react-i18next, 273 ключа en/ru, language switcher в админке, все строки покрыты (PR #9).
- [x] Язык по умолчанию #ui
	DB setting `language`, admin UI, `loadLanguageFromSettings()` при загрузке.




%% kanban:settings
```
{"kanban-plugin":"board","list-collapse":[false,false,false,false]}
```
%%
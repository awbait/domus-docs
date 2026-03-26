# Homey vs Focus Dashboard — сравнение архитектур дашбордов

**Дата исследования:** 2026-03-24

---

## Общее сравнение платформ

| | Homey | Domus (Domovoy + Focus Dashboard) |
|---|---|---|
| **Фокус** | Device-centric (управление устройствами) | Voice-centric (Domovoy) + Life-centric (Focus Dashboard) |
| **Стек** | Node.js, custom Linux на IMX6 | Go + Python ML (Domovoy), Go + React (Dashboard) |
| **Облако** | Есть (STT, App Store, remote proxy, OTA) | Нет, всё локально |
| **Протоколы устройств** | Z-Wave, ZigBee, 433/868 MHz, WiFi, BT, NFC, IR | Нет (Home Assistant интеграция в планах) |
| **LLM** | Нет | Ollama (qwen2.5:3b) |

---

## Дашборд Homey

### Архитектура

- **Виджеты** — HTML/CSS/JS страницы, загружаются как webview (изолированы)
- **Layout** — column-based, адаптивный (телефон — 1 колонка, планшет — несколько)
- **Высота виджета** — фиксированная (px) или aspect ratio (%), кешируется после первого рендера
- **Kiosk mode** — планшет как постоянная панель управления
- **25+ встроенных виджетов**: lights, thermostats, media, Flows, Moods, Insights, Energy, камеры, погода, батареи
- **App-виджеты** (Homey Pro) — сторонние через App Store

### Структура виджета

```
/widgets/<widgetId>/
  widget.compose.json   ← метаданные, настройки, API endpoints
  public/index.html     ← фронтенд (HTML/CSS/JS)
  api.js                ← бэкенд (REST handlers)
  preview.png           ← превью для выбора
```

### Client-side API

```js
Homey.ready()                  // виджет готов, убрать лоадер
Homey.api('GET', '/data')      // запрос к бэкенду виджета
Homey.getSettings()            // настройки, выбранные пользователем
Homey.getWidgetInstanceId()    // уникальный ID экземпляра
Homey.setHeight(300)           // динамическая высота
Homey.on('event', callback)    // подписка на события от app
Homey.hapticFeedback()         // вибрация на тач
```

### Sandbox-модель

- Каждое приложение — изолированный процесс с запрошенными permissions
- Общается через abstraction layer с Homey Core
- Приложение не может получить доступ к системе за пределами permissions
- Homey Cloud: мульти-тенант, несколько app instances в одном Node.js процессе

---

## Дашборд Focus Dashboard

### Архитектура

- **Виджеты** — React-компоненты (встроенные) + Web Components (внешние модули)
- **Layout** — react-grid-layout, drag & drop, 3 режима (wall/desktop/mobile)
- **Realtime** — WebSocket Hub (broadcast/broadcastTo)
- **Настройки** — `GET/PUT /api/settings/module` (key-value в SQLite)

---

## Модульная система — сравнение

| | Homey | Focus Dashboard |
|---|---|---|
| **Встроенные** | 25+ built-in виджетов | Go-модули в бинарнике (pill-tracker, clock) |
| **Внешние** | App Store → sandbox процесс | ZIP → subprocess с reverse proxy |
| **Sandbox** | Да: отдельный процесс, permissions, abstraction layer | Нет изоляции |
| **Распространение** | App Store с ревью | Локальные ZIP / community registry (GitHub) |
| **Фронтенд модуля** | HTML/JS в webview (изолирован) | Web Component (widget.js), загружается runtime |
| **API модуля** | `api.js` с REST, scoped per widget instance | Бинарник слушает порт, проксируется через `/api/modules/{id}/api/*` |
| **Настройки** | `widget.compose.json` → UI генерируется автоматически | `/api/settings/module` (key-value) |

---

## Внешние модули Focus Dashboard — детали

### Структура ZIP

```
my-module/
├── manifest.json       # обязательно: {id, name, version, description, author}
├── widget.js           # опционально: Web Component
├── settings.js         # опционально: UI настроек
├── backend             # опционально: скомпилированный бинарник
└── migrations.sql      # опционально: SQL при установке
```

### Как работает загрузка

1. ZIP извлекается, `manifest.json` валидируется
2. Файлы сохраняются в `{ModulesDir}/{moduleID}/`
3. Миграции выполняются против основной БД (idempotent, `IF NOT EXISTS`)
4. Запись в таблицу `installed_modules` (type='dynamic')

### Как работает backend subprocess

1. Выделяется порт из пула (8700–8800)
2. Запускается бинарник с env: `PORT`, `MODULE_ID`, `DATA_DIR`, `DB_PATH`
3. Бинарник пишет handshake в stdout: `{"protocol":"focus-module/1","port":8700,"name":"my-module"}`
4. Health check: `GET /health` каждые 500ms до 15 сек
5. Reverse proxy: `/api/modules/{id}/api/*` → `127.0.0.1:{port}`
6. Авто-рестарт с exponential backoff (1s → 30s max)

### Отсутствие изоляции

| Аспект | Статус |
|---|---|
| **Файловая система** | Полный доступ с правами основного процесса |
| **Сеть** | Без ограничений |
| **База данных** | Получает `DB_PATH` к общей SQLite, может читать/писать любые таблицы |
| **Ресурсы** | Нет лимитов CPU/RAM/disk |
| **Секреты** | Env передаются без фильтрации |

### Модель доверия

Однопользовательская система для дома. Модули свои или из своего community registry — sandbox не критичен на текущем этапе.

### Возможные шаги усиления изоляции (если понадобится)

1. **DB isolation** — отдельный SQLite-файл на модуль вместо общего `DB_PATH`
2. **Filesystem sandbox** — ограничить `DATA_DIR` через chroot / bind mount
3. **Network namespace** — изоляция сети на Linux
4. **Docker per module** — максимальная изоляция с лимитами ресурсов

---

## Источники

- [A Technical Introduction to Homey](https://homey.app/en-us/blog/a-technical-introduction-homey/)
- [Homey Widgets SDK](https://apps.developer.homey.app/the-basics/widgets)
- [Homey Dashboards](https://homey.app/en-us/features/dashboards/)
- [Homey Apps SDK](https://apps.developer.homey.app)

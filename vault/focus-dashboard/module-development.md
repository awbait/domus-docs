# Разработка модулей

Руководство по созданию динамических модулей для focus-dashboard. Рассчитано на разработчиков (Go + React/TypeScript) и AI-агентов.

Исходный код SDK и пример модуля: [awbait/focus-modules](https://github.com/awbait/focus-modules).

---

## Быстрый старт

Скопируйте `example-counter` и переименуйте:

```bash
cp -r modules/example-counter modules/my-module
```

Замените:
1. `manifest.json` — `id`, `name`, `description`, виджеты
2. `backend/main.go` — ваша бизнес-логика
3. `frontend/src/` — ваши виджеты
4. `migrations.sql` — ваши таблицы (с уникальным префиксом)
5. `locales/` — переводы

Сборка и тест:

```bash
cd modules/my-module
bash build.sh                              # → my-module.zip
# Загрузить ZIP через Администрирование → Модули → Загрузить
```

---

## Структура модуля

```
my-module/
├── manifest.json          # обязательно — метаданные модуля
├── migrations.sql         # SQL, выполняется при установке
├── preview.png            # скриншот для маркетплейса
├── locales/
│   ├── en.json            # English
│   └── ru.json            # Русский
├── backend/
│   ├── go.mod
│   └── main.go            # HTTP-сервер (протокол focus-module/1)
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── build.ts           # Bun build script
│   └── src/
│       ├── index.ts       # entrypoint — импортирует виджеты
│       ├── env.d.ts       # Window globals
│       ├── types.ts       # типы модуля + ReactWidgetElement
│       ├── my-widget.tsx  # виджет
│       └── settings.tsx   # панель настроек
├── build.sh               # сборка (Linux/macOS)
└── build.ps1              # сборка (Windows)
```

---

## manifest.json

```json
{
  "id": "my-module",
  "name": "My Module",
  "description": "What it does",
  "version": "1.0.0",
  "author": "your-name",
  "widgets": [
    {
      "id": "main",
      "name": "Main Widget",
      "description": "Shows something useful",
      "min": "1x1",
      "max": "4x3",
      "default": "2x2"
    }
  ],
  "events": [
    {
      "type": "my-module.data.updated",
      "description": "Fired when data changes",
      "payload": { "value": "number" }
    }
  ]
}
```

| Поле | Обязательно | Описание |
|------|:-----------:|----------|
| `id` | да | Уникальный идентификатор (slug) |
| `name` | да | Отображаемое название |
| `description` | да | Краткое описание |
| `version` | да | Семантическая версия |
| `author` | да | Автор |
| `widgets` | нет | Массив виджетов (если есть frontend) |
| `events` | нет | Массив событий (для документации) |

### Размеры виджетов

Задаются в формате `WxH` (ширина × высота в grid-ячейках):

| Поле | Описание |
|------|----------|
| `min` | Минимальный размер |
| `max` | Максимальный размер |
| `default` | Размер при добавлении на доску |

---

## Backend (Go)

### Go SDK

Пакет `focusmodule` содержит все необходимые хелперы:

```go
import fm "github.com/awbait/focus-modules/sdk/go/focusmodule"
```

Для локальной разработки — `replace` directive в `go.mod`:

```
replace github.com/awbait/focus-modules/sdk/go/focusmodule => ../../../sdk/go/focusmodule
```

### Минимальный backend

```go
package main

import (
    "net/http"
    fm "github.com/awbait/focus-modules/sdk/go/focusmodule"
)

func main() {
    db := fm.OpenDB()       // SQLite с WAL, FK, MaxOpenConns=1
    defer db.Close()

    mux := http.NewServeMux()
    mux.HandleFunc("GET /health", fm.HealthHandler)
    mux.HandleFunc("GET /data", handleGetData)

    fm.ListenAndServe(mux, "My Module")  // handshake + serve
}
```

### SDK API

| Функция | Описание |
|---------|----------|
| `fm.ListenAndServe(handler, name)` | Handshake focus-module/1 + HTTP сервер |
| `fm.OpenDB()` | SQLite (DB_PATH env, WAL, FK, MaxOpenConns=1) |
| `fm.HealthHandler` | `GET /health` → `{"status":"ok"}` |
| `fm.RequireRole(w, r, "resident")` | Проверка RBAC, возвращает false + 403 при ошибке |
| `fm.UserRole(r)` | Извлечь роль из заголовка |
| `fm.JSON(w, v)` | JSON response 200 |
| `fm.HTTPError(w, status, msg)` | JSON error response |
| `fm.InternalError(w, ctx, err)` | Log + 500 JSON |
| `fm.BroadcastEvent(moduleID, event, payload)` | WebSocket + domain event |
| `fm.Getenv(key, fallback)` | Env var с дефолтом |

### Протокол focus-module/1

Бэкенд обязан:

1. Прочитать `PORT` из окружения (хост выделяет порт)
2. Слушать на `127.0.0.1:{PORT}`
3. Вывести одну JSON-строку в stdout:
   ```json
   {"protocol":"focus-module/1","port":8700,"name":"My Module"}
   ```
4. Отвечать `200` на `GET /health`

`fm.ListenAndServe()` делает всё это автоматически.

### Переменные окружения

Хост передаёт модулю:

| Переменная | Описание | Пример |
|-----------|----------|--------|
| `PORT` | Порт для HTTP-сервера | `8700` |
| `MODULE_ID` | ID модуля | `my-module` |
| `DB_PATH` | Путь к SQLite | `/data/focus.db` |
| `HOST_URL` | URL дашборда (для событий) | `http://127.0.0.1:8080` |

### Маршрутизация

Хост проксирует: `/api/modules/{id}/api/*` → `/{rest}` на бэкенд модуля.

Пример: `GET /api/modules/my-module/api/data` → `GET /data` на порт модуля.

### RBAC

Хост инжектирует заголовок `X-Focus-User-Role` в каждый запрос к модулю.

| Роль | Уровень | Описание |
|------|---------|----------|
| `guest` | 0 | Только чтение |
| `resident` | 1 | Чтение + запись |
| `owner` | 2 | Полный доступ (настройки, удаление) |

```go
func handleDelete(w http.ResponseWriter, r *http.Request) {
    if !fm.RequireRole(w, r, "owner") {
        return  // 403 уже отправлен
    }
    // ... delete logic
}
```

### События

Модуль может отправлять события через WebSocket и domain events:

```go
fm.BroadcastEvent("my-module", "data.updated", map[string]any{
    "value": 42,
})
```

Фронтенд подписывается на `data.updated` (без префикса модуля — SDK добавляет автоматически).

### Настройки

Паттерн для хранения настроек модуля:

```sql
-- migrations.sql
CREATE TABLE IF NOT EXISTS mm_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '{}'
);
INSERT OR IGNORE INTO mm_settings (key, value) VALUES ('global', '{}');
```

Эндпоинты:
- `GET /settings` — чтение
- `PUT /settings` — запись (owner only)
- `GET /widget-settings/{widgetId}` — per-widget (может наследовать от global)
- `PUT /widget-settings/{widgetId}` — per-widget

---

## Frontend (React + TypeScript)

### Зависимости

```json
{
  "devDependencies": {
    "@focus-dashboard/sdk-types": "^0.4.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

React и ReactDOM **не** устанавливаются — они предоставляются хостом через `window.React` и `window.ReactDOM`.

### Виджет

Каждый виджет — это Custom Element с React внутри:

```tsx
// src/my-widget.tsx
import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import type { WidgetProps, Styles } from './types'
import { ReactWidgetElement } from './types'

function MyWidget({ focus }: WidgetProps) {
  const [data, setData] = useState(null)

  useEffect(() => {
    // 1. Загрузить данные
    focus.api('GET', '/data').then(setData)

    // 2. Подписаться на события
    const unsub = focus.on('data.updated', (payload) => {
      setData(payload)
    })

    // 3. Сигнал готовности
    focus.ready()

    return unsub
  }, [focus])

  return <div style={styles.container}>{/* UI */}</div>
}

const styles: Styles = {
  container: {
    fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    color: 'var(--foreground)',
    height: '100%',
  },
}

// Регистрация Custom Element
class MyModuleWidget extends ReactWidgetElement {
  connectedCallback() {
    const focus = window.FocusSDK.create(this)
    this._root = createRoot(this)
    this._root.render(<MyWidget focus={focus} />)
  }
}
customElements.define('my-module-main-widget', MyModuleWidget)
```

**Важно:** имя Custom Element = `{module-id}-{widget-id}-widget`.

### FocusSDK API

`window.FocusSDK.create(element)` возвращает `FocusInstance`:

| Метод | Описание |
|-------|----------|
| `focus.ready()` | Сигнал завершения первого рендера |
| `focus.api<T>(method, path, body?)` | HTTP-запрос к бэкенду модуля |
| `focus.getSettings<T>()` | Получить настройки виджета |
| `focus.getWidgetId()` | ID виджета |
| `focus.on(event, callback)` | Подписка на WebSocket события. Возвращает `unsub()` |
| `focus.t(key, params?)` | Перевод из локалей модуля |
| `focus.getUser()` | Текущий пользователь `{id, name, role}` |
| `focus.can(action)` | Проверка прав: `'read'` / `'write'` / `'admin'` |

### Проверка прав на фронтенде

```tsx
const [canWrite, setCanWrite] = useState(false)

useEffect(() => {
  focus.can('write').then(setCanWrite)
}, [focus])

// Disable кнопки если нет прав
<button disabled={!canWrite} onClick={doAction}>
  {focus.t('action')}
</button>
```

Обработка 403 от бэкенда:

```tsx
const guardedAction = (action: () => Promise<void>) => () => {
  action().catch((err: Error) => {
    if (err.message.includes('403')) setCanWrite(false)
  })
}
```

### Панель настроек

`settings.tsx` — отдельный Custom Element, загружается в админке:

```tsx
class MyModuleSettings extends ReactWidgetElement {
  connectedCallback() {
    const focus = window.FocusSDK.create(this)
    this._root = createRoot(this)
    this._root.render(<SettingsPanel focus={focus} />)
  }
}
customElements.define('my-module-settings', MyModuleSettings)
```

### Стилизация

Используйте CSS custom properties дашборда для интеграции с темой:

| Переменная | Описание |
|-----------|----------|
| `--foreground` | Цвет текста |
| `--background` | Фон |
| `--primary` | Акцентный цвет |
| `--primary-foreground` | Текст на акцентном фоне |
| `--border` | Цвет границ |
| `--muted-foreground` | Приглушённый текст |
| `--input` | Фон полей ввода |
| `--radius` | Радиус скругления |
| `--font-sans` | Шрифт |

Стили задаются inline-объектами (не CSS-файлы):

```tsx
const styles: Styles = {
  btn: {
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    borderRadius: 'var(--radius, 0.625rem)',
    border: '1px solid transparent',
  },
}
```

### Build pipeline

`build.ts` собирает `widget.js` и `settings.js` через Bun с React shim plugin:

```ts
const reactGlobalsPlugin = {
  name: 'react-globals',
  setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({
      path: 'react', namespace: 'react-shim',
    }))
    build.onLoad({ filter: /.*/, namespace: 'react-shim' }, () => ({
      contents: `
        const React = window.React;
        const {createElement, Fragment, useState, useEffect, useCallback, useMemo, useRef} = React;
        export default React;
        export {createElement, Fragment, useState, useEffect, useCallback, useMemo, useRef};
      `,
      loader: 'js',
    }))
    // аналогично для react-dom/client → window.ReactDOM
  },
}
```

---

## Миграции (SQL)

`migrations.sql` выполняется при установке модуля. Используйте `CREATE TABLE IF NOT EXISTS` и уникальный префикс для таблиц.

```sql
-- Конвенция: префикс mm_ (my-module)
CREATE TABLE IF NOT EXISTS mm_data (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    value      TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now'))
);
```

**Правила:**
- Префикс таблиц = сокращение от module ID (избегайте конфликтов)
- `IF NOT EXISTS` — миграция может запускаться повторно
- Инициализирующие данные через `INSERT OR IGNORE`

---

## Локализация (i18n)

Файлы `locales/en.json` и `locales/ru.json`:

```json
{
  "widget": {
    "main": {
      "title": "My Widget",
      "empty": "No data"
    }
  },
  "settings": {
    "title": "Settings",
    "save": "Save",
    "saved": "Saved"
  }
}
```

Использование во фронтенде:

```tsx
<h2>{focus.t('widget.main.title')}</h2>
```

---

## Сборка

### Linux / macOS

```bash
bash build.sh    # → my-module.zip
```

### Windows

```powershell
.\build.ps1      # → my-module.zip
```

### Содержимое ZIP

| Файл | Обязательно | Описание |
|------|:-----------:|----------|
| `manifest.json` | да | Метаданные |
| `backend` | нет | Go binary (linux/amd64, 0o755) |
| `widget.js` | нет | ESM-бандл виджетов |
| `settings.js` | нет | ESM-бандл настроек |
| `migrations.sql` | нет | SQL-миграции |
| `locales/*.json` | нет | Переводы |
| `preview.png` | нет | Скриншот |

Бэкенд компилируется статически:

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o backend .
```

---

## Релизы

### Для модулей в focus-modules

Тег `{module-id}/v{version}` запускает CI:

```bash
git tag my-module/v1.0.0
git push origin my-module/v1.0.0
```

CI автоматически:
1. Собирает frontend + backend
2. Создаёт GitHub Release с ZIP
3. Обновляет `community-modules.json`

### Для модулей в отдельных репозиториях

Создайте `.github/workflows/release.yml` по образцу. Тег `v*` запускает сборку и релиз.

Для попадания в каталог — добавьте запись в `community-modules.json` в [focus-modules](https://github.com/awbait/focus-modules).

---

## Публикация в каталоге

`community-modules.json` — реестр модулей, доступных для установки из UI:

```json
{
  "id": "my-module",
  "name": "My Module",
  "author": "your-name",
  "description": "What it does",
  "version": "1.0.0",
  "repo": "your-name/my-module",
  "download_url": "https://github.com/your-name/my-module/releases/download/v1.0.0/my-module.zip",
  "homepage": "https://github.com/your-name/my-module",
  "tags": ["utility"]
}
```

Создайте PR в [awbait/focus-modules](https://github.com/awbait/focus-modules) с добавлением записи.

---

## Чеклист нового модуля

- [ ] `manifest.json` с уникальным `id`
- [ ] Backend: health endpoint, handshake (или SDK `fm.ListenAndServe`)
- [ ] Frontend: виджет как Custom Element + `focus.ready()`
- [ ] Миграции с уникальным префиксом таблиц
- [ ] Локали: минимум `en.json`
- [ ] RBAC: мутации защищены `RequireRole` / `focus.can()`
- [ ] Сборка: `build.sh` / `build.ps1` создаёт ZIP
- [ ] Тест: установка через UI, добавление виджета на доску

---
title: Аутентификация
description: Система аутентификации Focus Dashboard: PIN, пароль, OIDC
---

# Аутентификация

Focus Dashboard поддерживает три способа аутентификации:

- **Пароль** — email + пароль (setup wizard, login page)
- **PIN** — 5-значный цифровой код для wall-режима (только из локальной сети)
- **OIDC** — через внешний Identity Provider (Authentik, Keycloak и др.)

Все способы работают параллельно. После успешной авторизации выдаётся внутренний JWT (HS256) в HTTP-only cookie.

---

## Роли

| Роль | Уровень | Описание |
|------|---------|----------|
| `guest` | 0 | Только просмотр |
| `resident` | 1 | Обычный пользователь |
| `owner` | 2 | Полный доступ, админ-панель |

Проверка доступа — ординальная: `RequireRole(owner)` отклоняет guest и resident.

---

## Setup Wizard

При первом запуске (`setup.done == 0`) dashboard показывает мастер настройки:

1. Имя, email, пароль (минимум 8 символов)
2. Создаётся пользователь с ролью `owner`
3. Выдаётся JWT, создаётся персональная доска
4. `setup.done = 1` — повторный запуск мастера невозможен

**Endpoint:** `POST /api/auth/setup`

---

## Email + пароль

Дополнительных пользователей создаёт owner через Admin Panel.

**Endpoint:** `POST /api/auth/login`

- `bcrypt.DefaultCost` (10) для хэширования
- При ошибке всегда возвращается `ErrInvalidPassword` (защита от перечисления email)
- Успешный вход сбрасывает PIN-блокировку пользователя
- JWT TTL: **24 часа**

---

## PIN-код (wall mode)

5-значный цифровой PIN для быстрого переключения пользователей на настенном дисплее.

**Endpoint:** `POST /api/auth/login-pin`

### Ограничения

- **LocalOnly middleware** — PIN-вход только из локальной сети (RFC 1918 + loopback). Внешние клиенты получают `403`
- **Rate limiting** — после 5 неудачных попыток PIN блокируется (`pin_blocked_at`). Разблокировка: успешный вход по паролю или OIDC
- **Короткие сессии** — JWT TTL: **1 час** (vs 24 часа для пароля/OIDC)
- PIN устанавливает только owner через Admin Panel (`PUT /api/admin/users/{id}/pin`)

### Допустимые CIDR

```
10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
127.0.0.0/8, ::1/128, fc00::/7
```

### UI

В SideMenu (боковое меню / нижняя панель) — кнопка выбора пользователя:
1. Загружается список пользователей с PIN (`GET /api/users`)
2. Выбор пользователя → ввод PIN (5-slot OTP)
3. Успех → переход на персональную доску (`/b/user-{id}`)

Также доступна ссылка «Войти по паролю» → `/login`.

---

## OIDC

### Поток авторизации

```
Пользователь → «Войти через Authentik»
  → GET /api/auth/oidc/authorize (state + nonce в cookie, 5 мин)
    → Redirect на IdP (Authorization Code Flow)
      → Пользователь авторизуется в IdP
        → Redirect на /api/auth/oidc/callback
          → Проверка state, обмен code на токены
            → Верификация ID Token (подпись + nonce)
              → Поиск пользователя по email (или автосоздание)
                → Сброс PIN-блокировки
                  → JWT cookie → redirect на /
```

Scopes: `openid`, `profile`, `email`.

### Маппинг пользователей

- Сопоставление по **email** из ID Token
- Если пользователь не найден и **автосоздание** включено — создаётся с `DefaultRole` (по умолчанию `resident`)
- Если автосоздание выключено — вход отклоняется
- OIDC-пользователи создаются без пароля, но owner может установить им PIN

### Конфигурация

Настройки хранятся в БД (Admin Panel → Настройки → Authentik/OIDC). Env-переменные как fallback:

| Параметр | Env fallback | Описание |
|----------|-------------|----------|
| Включить OIDC | — | Показать кнопку OIDC на странице входа |
| Issuer URL | `OIDC_ISSUER` | Публичный URL провайдера (для браузера) |
| Internal URL | — | Внутренний URL для бэкенда (Docker: `http://authentik-server:9000/...`) |
| Client ID | `OIDC_CLIENT_ID` | OAuth2 client ID |
| Client Secret | `OIDC_CLIENT_SECRET` | OAuth2 client secret |
| Автосоздание | — | Создавать пользователя при первом OIDC-входе |
| Роль по умолчанию | — | Роль для автосозданных: `owner` / `resident` / `guest` |

Настройки из Admin Panel имеют приоритет над env. После сохранения провайдер переинициализируется без перезапуска.

### InternalURL

Когда бэкенд работает в Docker, он не может обратиться к IdP по `localhost`. `InternalURL` подменяет хост в запросах бэкенда к IdP через кастомный `http.RoundTripper`, сохраняя оригинальный `Host` header для виртуального хостинга.

### Быстрый старт с Docker Compose

```bash
docker compose --profile auth up -d
```

Сервисы:
- **Dashboard** — `http://localhost:8080`
- **Authentik** — `http://localhost:9000`

Настройка Authentik:

1. Создайте админа: `docker compose exec authentik-server ak create_admin_user`
2. Authentik Admin → Applications → Providers → Create:
   - Тип: **OAuth2/OpenID Provider**
   - Client type: **Confidential**
   - Redirect URI: `http://localhost:8080/api/auth/oidc/callback`
   - Scopes: `openid`, `profile`, `email`
3. Скопируйте Client ID и Client Secret
4. Applications → Applications → Create (привяжите провайдер)
5. В Focus Dashboard: Admin Panel → Настройки → OIDC → заполните поля → Сохранить

---

## JWT

| Параметр | Значение |
|----------|----------|
| Алгоритм | HS256 |
| Секрет | `JWT_SECRET` env или `JWT_SECRET_FILE` (Docker secrets) |
| TTL (пароль/OIDC) | 24 часа |
| TTL (PIN) | 1 час |

### Claims

```json
{
  "sub": "<user-id>",
  "role": "owner|resident|guest",
  "name": "<display-name>",
  "auth_method": "password|pin|oidc",
  "exp": 1234567890,
  "iat": 1234567890
}
```

Токен читается из двух источников (в порядке приоритета):
1. `Authorization: Bearer <token>` header
2. `token` HTTP-only cookie

---

## Cookie

| Параметр | Значение |
|----------|----------|
| Name | `token` |
| Path | `/` |
| HttpOnly | `true` |
| SameSite | `Lax` (для OIDC redirect) |
| Secure | Не выставляется сервером — настраивать на reverse proxy |

OIDC state cookie: `oidc_state`, path `/api/auth/oidc`, MaxAge 300s, HttpOnly, SameSite Lax.

---

## API Endpoints

### Публичные (без авторизации)

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/auth/setup-status` | `{"setup_required": bool}` |
| `POST` | `/api/auth/setup` | Setup wizard (блокируется после завершения) |
| `POST` | `/api/auth/login` | Email + пароль |
| `POST` | `/api/auth/login-pin` | User ID + PIN (LocalOnly) |
| `POST` | `/api/auth/logout` | Очистка cookie, 204 |
| `GET` | `/api/auth/oidc/config` | `{"enabled": bool}` |
| `GET` | `/api/auth/oidc/authorize` | Redirect на IdP |
| `GET` | `/api/auth/oidc/callback` | Обмен code → JWT |
| `GET` | `/api/users` | Список пользователей (id, name, avatar, has_pin) |

### Авторизованные

| Метод | Путь | Роль | Описание |
|-------|------|------|----------|
| `GET` | `/api/auth/me` | any | Профиль текущего пользователя |

### Owner-only

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/admin/users` | Полный список с email и ролями |
| `POST` | `/api/admin/users` | Создание пользователя |
| `PUT` | `/api/admin/users/{id}/pin` | Установка PIN |
| `DELETE` | `/api/admin/users/{id}/pin` | Удаление PIN |
| `POST` | `/api/admin/oidc/configure` | Перезагрузка OIDC из БД |

---

## Безопасность

| Аспект | Реализация |
|--------|------------|
| Хэширование паролей | bcrypt, cost 10 |
| Хэширование PIN | bcrypt, cost 10 |
| PIN brute-force | Блокировка после 5 попыток |
| PIN сеть | Только LAN (LocalOnly middleware) |
| Email enumeration | Единый ответ `ErrInvalidPassword` |
| OIDC state/nonce | 32 байта crypto/rand, scoped cookie |
| OIDC client type | Confidential (secret на сервере) |
| Rate limiting | Нет на уровне приложения — настраивать на reverse proxy |
| Secure cookie | Не выставляется — настраивать TLS termination на reverse proxy |

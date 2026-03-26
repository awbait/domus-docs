# Аутентификация

Focus Dashboard поддерживает два способа аутентификации:

- **Локальная** — email + пароль, PIN-код (для wall-режима)
- **OIDC** — через внешний Identity Provider (Authentik, Keycloak и др.)

Оба способа работают параллельно. На странице входа отображается форма пароля и кнопка OIDC (если включён).

---

## Локальная аутентификация

### Email + пароль

При первом запуске Setup Wizard создаёт администратора с email и паролем (минимум 8 символов). Дополнительных пользователей создаёт администратор через Admin Panel.

### PIN-код (wall mode)

5-значный цифровой PIN для быстрого входа на настенном дисплее. Администратор устанавливает PIN каждому пользователю через Admin Panel.

---

## OIDC (Authentik)

### Быстрый старт с Docker Compose

Authentik включён в `docker-compose.yml` как опциональный профиль `auth`.

**1. Запустите всё вместе:**

```bash
docker compose --profile auth up -d
```

Сервисы:
- **Dashboard** — `http://localhost:8080`
- **Authentik** — `http://localhost:9000`

**2. Создайте админа Authentik:**

```bash
docker compose exec authentik-server ak create_admin_user
```

Или откройте `http://localhost:9000/if/flow/initial-setup/` — Authentik покажет мастер создания первого пользователя.

**3. Настройте OAuth2-приложение в Authentik:**

1. Войдите в Authentik Admin: `http://localhost:9000/if/admin/`
2. **Applications → Providers → Create**
   - Тип: **OAuth2/OpenID Provider**
   - Name: `focus-dashboard`
   - Authorization flow: `default-provider-authorization-explicit-consent`
   - Client type: **Confidential**
   - Redirect URIs: `http://localhost:8080/api/auth/oidc/callback`
   - Scopes: оставьте по умолчанию (`openid`, `profile`, `email`)
   - Signing Key: выберите любой ключ из списка (или создайте новый)
3. Скопируйте **Client ID** и **Client Secret** со страницы провайдера
4. **Applications → Applications → Create**
   - Name: `Focus Dashboard`
   - Slug: `focus-dashboard`
   - Provider: выберите созданный `focus-dashboard`
5. Запомните **Issuer URL**: `http://localhost:9000/application/o/focus-dashboard/`

**4. Настройте Focus Dashboard:**

1. Откройте `http://localhost:8080`, пройдите Setup Wizard (создайте локального админа)
2. Откройте **Admin Panel → Настройки → Authentik (OIDC)**
3. Заполните:
   - **Включить OIDC**: вкл
   - **Issuer URL**: `http://localhost:9000/application/o/focus-dashboard/`
   - **Internal URL**: `http://authentik-server:9000/application/o/focus-dashboard/`
   - **Client ID**: скопированный из Authentik
   - **Client Secret**: скопированный из Authentik
   - **Автосоздание пользователей**: вкл
   - **Роль по умолчанию**: Пользователь
4. Нажмите **Сохранить**

**5. Проверьте:**

Откройте `http://localhost:8080/login` — под формой пароля появится кнопка **«Войти через Authentik»**.

### Настройка Authentik (production)

1. Откройте Authentik Admin → Applications → Create
2. Создайте **OAuth2/OpenID Provider**:
   - **Client type**: Confidential
   - **Redirect URI**: `https://your-dashboard-host/api/auth/oidc/callback`
   - **Scopes**: `openid`, `profile`, `email`
3. Скопируйте **Client ID** и **Client Secret**
4. Запомните **Issuer URL** — обычно `https://auth.example.com/application/o/your-app/`

### Настройка в Focus Dashboard

Откройте **Admin Panel → Настройки → Authentik (OIDC)**:

| Параметр | Описание |
|----------|----------|
| Включить OIDC | Активирует кнопку «Войти через Authentik» на странице входа |
| Issuer URL | Публичный URL провайдера — используется браузером для редиректа |
| Internal URL | Внутренний URL для обращений бэкенда (Docker: `http://authentik-server:9000/...`). Оставьте пустым если бэкенд может обратиться по Issuer URL напрямую |
| Client ID | Идентификатор OAuth2-клиента |
| Client Secret | Секрет клиента |
| Автосоздание пользователей | Создавать учётную запись при первом входе через OIDC |
| Роль по умолчанию | Роль для автосозданных пользователей: `admin`, `user` или `viewer` |

После сохранения настроек провайдер переинициализируется автоматически.

> **Docker / Kubernetes**: Контейнер dashboard не может обратиться к Authentik по `localhost:9000` —
> это адрес хоста, а не контейнера. Укажите в **Internal URL** имя Docker-сервиса
> (например `http://authentik-server:9000/application/o/focus-dashboard/`).
> В Kubernetes используйте внутренний DNS сервиса (`http://authentik.namespace.svc:9000/...`).

### Переменные окружения (fallback)

Если настройки в базе данных пусты, используются переменные окружения:

```env
OIDC_ISSUER=https://auth.example.com/application/o/focus/
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
```

Настройки из Admin Panel имеют приоритет над переменными окружения.

### Как работает вход

```
Пользователь → «Войти через Authentik»
  → Redirect на Authentik (Authorization Code Flow)
    → Пользователь вводит логин/пароль в Authentik
      → Redirect назад на /api/auth/oidc/callback
        → Сервер обменивает code на токены
          → Проверяет ID Token (подпись, nonce)
            → Ищет пользователя по email (или создаёт)
              → Выдаёт внутренний JWT → cookie → dashboard
```

### Маппинг пользователей

- Пользователь сопоставляется по **email** из ID Token
- Если пользователь не найден и **автосоздание** включено — создаётся новый с указанной ролью
- Если автосоздание выключено — вход отклоняется (пользователь должен быть создан заранее через Admin Panel)
- OIDC-пользователи создаются без пароля (password = NULL), но администратор может установить им PIN

### Безопасность

- **State + Nonce**: защита от CSRF и replay-атак, хранятся в HTTP-only cookie
- **Confidential Client**: Client Secret не передаётся в браузер, code exchange происходит на сервере
- **Внутренний JWT**: после OIDC-авторизации выдаётся собственный JWT (HS256, 24 часа), как и при обычном входе
- **SameSite=Lax**: JWT cookie использует SameSite=Lax для корректной работы с OIDC redirect-цепочкой

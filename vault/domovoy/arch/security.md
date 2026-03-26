# Архитектура — Безопасность

> Обновлять при: реализации mTLS, шифрования логов, secrets management, hub-spoke.

---

## Текущее состояние

| Аспект | Статус | Комментарий |
|--------|--------|-------------|
| gRPC шифрование | ❌ Plaintext | Все соединения insecure (localhost/Docker bridge) |
| Логи диалогов | ❌ Plaintext | `dialog.jsonl` — весь текст разговоров |
| Secrets | ⚠️ env vars | `.env` в `.gitignore`, но не Docker secrets |
| Docker сеть | ✅ ml_internal | ML-сервисы изолированы; dev — 127.0.0.1 override |
| Ollama | ⚠️ localhost | Только `127.0.0.1`, без аутентификации |

**Для standalone (одна машина)** — текущий уровень допустим: трафик не покидает localhost/Docker bridge.
**Для hub-spoke** — критично, нужно всё из раздела «Запланировано».

---

## Запланировано

### ✅ P1 — Сетевая изоляция Docker

`expose` вместо `ports`, сеть `ml_internal: internal: true`. `domovoy` dockerized (Dockerfile).

**Dev (Windows):** `docker-compose.override.yml` добавляет `ports: 127.0.0.1:PORT:PORT` для Go на хосте.
**Production (Linux):** `docker compose --profile production up -d` — полная изоляция, domovoy в контейнере.

```yaml
networks:
  ml_internal:
    internal: true  # нет выхода в интернет
  external:

services:
  stt:
    expose: ["50051"]
    networks: [ml_internal]
  domovoy:
    profiles: [production]
    networks: [ml_internal, external]
    devices: ["/dev/snd:/dev/snd"]
```

### P1 — Secrets management

Паттерн `_FILE` — приоритет файла над env var. Docker secrets монтируются как файлы в `/run/secrets/`.

```go
// Dev:  HA_TOKEN=xxx в .env
// Prod: HA_TOKEN_FILE=/run/secrets/ha_token
func (c *Config) GetHAToken() (string, error) {
    if c.HATokenFile != "" {
        data, _ := os.ReadFile(c.HATokenFile)
        return strings.TrimSpace(string(data)), nil
    }
    return c.HAToken, nil
}
```

### P1 — Шифрование логов диалогов

AES-256-GCM record-by-record (append-only). Ключ — отдельный Docker secret.

```
DIALOG_ENCRYPT_KEY_FILE=/run/secrets/dialog_key  (32 байта)
```

При пустом ключе → plaintext (dev режим).

### P2 — mTLS между hub и spoke

Только для hub ↔ spoke через Wi-Fi (не для локальных контейнеров).

**Что даёт:**
- Шифрование трафика по сети
- Идентификация spoke по CN сертификата
- Канал для OTA-обновлений
- Мгновенный отзыв доступа конкретного spoke

**Параметры:**
- TLS 1.3, без fallback
- Серты 90 дней, CA — 1 год
- Ротация через OTA updater (проверка раз в сутки, перегенерация за 14 дней до истечения)

```go
// internal/security/tls.go
func LoadClientCreds(caFile, certFile, keyFile string) (credentials.TransportCredentials, error)
func LoadServerCreds(caFile, certFile, keyFile string) (credentials.TransportCredentials, error)
```

### P3 — Rate limiting

Защита hub от зациклившегося или скомпрометированного spoke.
Spoke ID — из CN mTLS-сертификата, не из заголовков.

```
RATE_LIMIT_RPS=10
RATE_LIMIT_BURST=20
```

### Spoke — безопасность устройства

- Read-only rootfs (`overlayfs`), запись только в tmpfs
- LUKS-шифрование раздела с ключами и сертификатами
- Минимальный образ: аудио + gRPC клиент + mTLS. Нет Python, компилятора, пакетного менеджера
- Без доступа в интернет: обновления только через hub

---

## Запрещённые паттерны

| Паттерн | Риск |
|---------|------|
| Хардкод секретов в коде | Утечка в git |
| `math/rand` для крипто | Предсказуемые nonce |
| `InsecureSkipVerify: true` | MITM |
| Секреты в логах | Утечка через log aggregation |
| `ports:` для ML-сервисов | Доступ снаружи Docker |
| Shared secrets между spoke | Компрометация одного = компрометация всех |

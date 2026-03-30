---
title: План реализации
description: Полное описание задач: архитектура, код, зависимости
---

# Домовой — План реализации

> Статус задач и прогресс — в (Kanban). Здесь полное описание каждой задачи.

---

## P1 — Фундамент (без блокеров)

Задачи без зависимостей. Минимальные изменения в архитектуре, максимальный эффект.

---

### Сетевая изоляция Docker

**Теги:** #infra #security #p1

**Изменения:** только `docker-compose.yml`, нулевые изменения в Go-коде.

ML-сервисы не должны быть доступны снаружи Docker-сети. Сейчас `ports:` публикует их на хост-интерфейсе.

```yaml
services:
  stt:
    expose: ["50051"]        # НЕ ports: — только внутри Docker
    networks: [ml_internal]

  domovoy:
    networks: [ml_internal, external]

networks:
  ml_internal:
    internal: true           # нет выхода в интернет
  external:
```

Адреса сервисов не меняются (`stt:50051` и т.д.) — DNS внутри Docker.
Ollama биндится на `127.0.0.1:11434`, доступен только через LLM gRPC proxy.

---

### Secrets management

**Теги:** #security #p1

**Изменения:** `internal/config/config.go`, `cmd/domovoy/main.go`.

Секреты (HA_TOKEN, ключ шифрования логов) — не в env vars для продакшена. Монтируются как Docker secrets в `/run/secrets/`.

Паттерн `_FILE` — приоритет над env:

```go
type Config struct {
    HAToken     string `env:"HA_TOKEN"`
    HATokenFile string `env:"HA_TOKEN_FILE"` // /run/secrets/ha_token
}

func (c *Config) GetHAToken() (string, error) {
    if c.HATokenFile != "" {
        data, _ := os.ReadFile(c.HATokenFile)
        return strings.TrimSpace(string(data)), nil
    }
    return c.HAToken, nil
}
```

Dev: `HA_TOKEN=xxx` в `.env`. Prod: Docker secret → `HA_TOKEN_FILE=/run/secrets/ha_token`.

---

### Шифрование логов диалогов

**Теги:** #security #p1

**Изменения:** новый `internal/dialog/crypto.go`, `internal/app/dialog_logger.go`, `cmd/domovoy/main.go`, `internal/config/config.go`.

`dialog.jsonl` хранит весь текст разговоров в plaintext. Шифрование AES-256-GCM record-by-record (append-only).

```go
// internal/dialog/crypto.go
type EncryptedWriter struct {
    key []byte // 32 байта из Docker Secret
    w   io.Writer
}

func (e *EncryptedWriter) WriteRecord(record []byte) error {
    block, _ := aes.NewCipher(e.key)
    gcm, _ := cipher.NewGCM(block)
    nonce := make([]byte, gcm.NonceSize())
    io.ReadFull(rand.Reader, nonce)
    encrypted := gcm.Seal(nonce, nonce, record, nil)
    // формат: [4 байта длины][nonce+ciphertext]
}
```

Конфиг: `DIALOG_ENCRYPT_KEY_FILE=/run/secrets/dialog_key` (32 байта). При пустом ключе — запись в plaintext (dev режим).

---

### Стоп-слова + Повтори

**Теги:** #pipeline #p1

**Изменения:** `internal/app/orchestrator.go`, `internal/config/config.go`, `internal/app/dialog_logger.go`. Новый: `internal/intent/stop_words.go`.

**⚠️ Архитектура:** реализовать как первые handler'ы в `IntentRouter` (типы: `cancel`, `repeat`), а не хардкод — чтобы потом HA-команды и другие интенты легли в ту же цепочку.

**Стоп-слова** — «стоп», «хватит», «замолчи», «достаточно»:
- Проверка текста после STT, до отправки в LLM
- Сброс сессии, возврат в режим ожидания wake word
- Запись в dialog log с `reason: "stop_word"`

**Повтори** — «повтори», «что ты сказал», «ещё раз»:
- Кеш последнего TTS-ответа (WAV + текст) в `SessionState`
- Воспроизведение из кеша без обращения к LLM/TTS
- Кеш очищается при новой сессии

```go
// internal/intent/stop_words.go
type IntentRouter struct {
    stopWords   []string
    repeatWords []string
    lastReply   []byte // WAV кеш
}

func (r *IntentRouter) Route(text string) (IntentType, error) {
    if containsAny(text, r.stopWords)  { return IntentCancel, nil }
    if containsAny(text, r.repeatWords) { return IntentRepeat, nil }
    return IntentLLM, nil
}
```

Конфиг: `STOP_WORDS=стоп,хватит,замолчи,достаточно` (CSV).

---

### Рефакторинг: соответствие go-practices

**Теги:** #arch #p1

**Изменения:** множественные файлы, не ломает поведение.

Два конкретных нарушения go-practices:

1. **`llm/client.go`** — `llmpb.Message` (proto-тип) используется напрямую в сервисном слое. Добавить доменную модель:
```go
// internal/app/message.go
type Message struct {
    Role    string
    Content string
}
```
LLM-клиент конвертирует `Message` ↔ `llmpb.Message` внутри себя.

2. **`audio/capture_test.go:77`** — `time.Sleep(200ms)` вместо channel + select:
```go
// ПЛОХО
time.Sleep(200 * time.Millisecond)

// ХОРОШО
select {
case <-done:
case <-time.After(5 * time.Second):
    t.Fatal("timeout")
}
```

---

## P2 — После фундамента P1

---

### Web Dashboard

**Теги:** #ui #p2

**Изменения:** новый `internal/http/`, `cmd/domovoy/main.go`. Параллельно оркестратору, не затрагивает пайплайн.

HTTP-сервер в Go. CQRS: прямые чтения из dialog log, без прохода через бизнес-логику.

Страницы:
- `/` — статус устройства, uptime, latency графики
- `/sessions` — список сессий диалогов
- `/sessions/{id}` — расшифрованный диалог сессии
- `/health` — gRPC health статусы всех сервисов
- `/spoke` — статус spoke-устройств (версия, heartbeat)

Конфиг: `DASHBOARD_ADDR=:8080`, `DASHBOARD_ENABLED=false` по умолчанию.

---

### mTLS между hub и spoke

**Теги:** #security #p2

**Изменения:** `internal/security/tls.go` (новый), все gRPC клиенты, `cmd/domovoy/main.go`, `internal/config/config.go`.

mTLS только для hub ↔ spoke (разные физические устройства по Wi-Fi). Локальные Docker-контейнеры — через network isolation.

Что даёт:
- Шифрование трафика между устройствами
- Идентификация spoke по CN сертификата
- Канал для OTA-обновлений (spoke не нужен интернет)
- Отзыв конкретного spoke без влияния на остальных

```go
// internal/security/tls.go
func LoadClientCreds(caFile, certFile, keyFile string) (credentials.TransportCredentials, error) {
    cert, _ := tls.LoadX509KeyPair(certFile, keyFile)
    caCert, _ := os.ReadFile(caFile)
    pool := x509.NewCertPool()
    pool.AppendCertsFromPEM(caCert)
    return credentials.NewTLS(&tls.Config{
        Certificates: []tls.Certificate{cert},
        RootCAs:      pool,
        MinVersion:   tls.VersionTLS13,
    }), nil
}
```

Конфиг: `TLS_ENABLED=false` (dev), `TLS_CA_FILE`, `TLS_CERT_FILE`, `TLS_KEY_FILE`.
Серты: 90 дней, CA — 1 год. Ротация через OTA updater (проверка раз в сутки, перегенерация за 14 дней до истечения).

---

### Speaker Recognition (Voice ID)

**Теги:** #ml #p2

**Изменения:** новый Python gRPC сервис, `internal/speaker/client.go`, `internal/app/orchestrator.go`, `internal/app/session.go`.

gRPC сервис: d-vector/x-vector эмбеддинги, регистрация 3-5 фразами, идентификация по аудио.

Новый шаг в пайплайне: Wake word → **Speaker ID** → Record → STT → LLM (с контекстом пользователя) → TTS.

```go
// internal/app/session.go
type SessionState struct {
    ID        string
    Turn      int
    Speaker   string        // "" = unknown
    LastReply []byte        // WAV кеш для "повтори"
    StartedAt time.Time
}
```

LLM получает имя пользователя в system prompt для персонализации.
Зависимость: при включённом Speaker Recognition добавляется health check нового сервиса.

---

## P3 — Hub-Spoke (после P2)

---

### Hub-Spoke архитектура

**Теги:** #arch #infra #p3

**Зависимость:** mTLS (P2).

**Изменения:** новые пакеты `internal/hub/`, `internal/spoke/`, рефакторинг `main.go`.

**⚠️ Архитектура:** при проектировании spoke-протокола предусмотреть аудио-маршрутизацию между нодами (для будущего Multi-room Audio), иначе breaking change.

Spoke — минимальный Go-бинарник:
- Аудио capture + wake word (локально)
- gRPC клиент к hub (STT, TTS, LLM)
- mTLS к hub
- Без доступа в интернет (обновления только через hub)

Hub-конфиг через `HUB_MODE=true`. Spoke указывает `STT_ADDR=hub:50051` вместо `localhost`.

Образ spoke: read-only rootfs (`overlayfs`), запись только в tmpfs, LUKS для раздела с ключами.

---

### Rate limiting

**Теги:** #security #p3

**Зависимость:** mTLS (Spoke ID извлекается из CN сертификата).

**Изменения:** `internal/security/ratelimit.go` (новый), gRPC interceptor в hub.

```go
func RateLimitInterceptor(rl *RateLimiter) grpc.UnaryServerInterceptor {
    return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
        spokeID := getSpokeIDFromCert(ctx) // из mTLS CN
        if !rl.Allow(spokeID) {
            return nil, status.Error(codes.ResourceExhausted, "rate limit exceeded")
        }
        return handler(ctx, req)
    }
}
```

Дефолт: 10 req/s, burst 20. Настройка: `RATE_LIMIT_RPS`, `RATE_LIMIT_BURST`.
Логировать превышения как WARN с spokeID.

---

### OTA Update система

**Теги:** #infra #p3

**Зависимость:** Hub-Spoke архитектура.

**Изменения:** новый `cmd/updater`, `internal/hub/updater/`, `internal/spoke/updater/`, `internal/security/signature.go`.

Hub раздаёт обновления, spoke забирает:

```
Spoke:  GET /api/update/check   → { version, hash }
        GET /api/update/download → подписанный образ
        Verify Ed25519 signature
        Apply + reboot
```

Hub-сервис `cmd/updater` под systemd:
1. Poll GHCR на новые теги образов
2. Merge конфига: `.env.defaults` → `.env`
3. `docker compose pull && docker compose up -d`
4. Health check через gRPC Health
5. Rollback если health check не прошёл за 60s
6. Self-update: скачать новый бинарник, `systemctl restart domovoy-updater`

Проверка срока сертов: раз в сутки, перегенерация при <14 дней. Перезапуск сервисов после ротации.
Heartbeat от spoke: версия прошивки, uptime, аудио-статус.

---

## Backlog — Идеи

Без приоритета, без конкретных сроков. Для ориентира при проектировании.

---

### Two-stage LLM routing

Лёгкая модель (`qwen2.5:0.5b`) для простых запросов (<1с), тяжёлая (`qwen2.5:7b`) для сложных. IntentRouter решает маршрут: regex → без LLM, простой вопрос → лёгкая, неуверенность → тяжёлая.

Сложность: определение "сложного" запроса. Обе модели в RAM — на Orange Pi 5 (8GB) tight. Если лёгкая ответила неуверенно и переключились на тяжёлую — суммарная латентность хуже, чем сразу тяжёлая.

---

### Home Assistant интеграция

Intent parser (regex + LLM fallback), HA REST API клиент, маршрутизация команд.
Новые пакеты: `internal/homeassistant`, `internal/intent`.
ACL-адаптер: HA-сущности конвертируются в доменные модели (не проникают в бизнес-логику).

---

### Wake Word «Домовой» v2

Дообучение модели с реальными записями:
- 5-10 человек × ~40 произнесений
- Voice conversion (FreeVC × FLEURS speakers)
- Больше фонового шума реальной среды

---

### Контекстная память (20 сек)

«Сделай потемнее» в течение 20 сек после «включи свет».
**⚠️ Архитектура:** `SessionState` с таймерами закладывается при реализации стоп-слов.

---

### Speaker Recognition → Детский режим

На базе Speaker Recognition: отдельный профиль для ребёнка. Безопасный system prompt, ограниченные команды, озвучка сказок.

---

### Multi-room Audio

Синхронное воспроизведение на всех spoke.
**⚠️ Архитектура:** spoke-протокол должен предусматривать аудио-маршрутизацию — зависит от Hub-Spoke.

---

### Kokoro TTS — кастомный голос

Датасет RUSLAN (31 час, мужской), обучение в Colab, экспорт ONNX. Piper Irina как fallback.

---

### NPU оптимизация (RK3588S)

**Статус:** исследовательская задача, результат не гарантирован.

GigaAM уже поставляется как ONNX. Конвертация через RKNN-Toolkit2 на x86, деплой `.rknn` на Orange Pi 5.

```python
# На x86 машине
rknn.load_onnx('gigaam-v3-e2e-ctc.onnx')
rknn.build(do_quantization=True, dataset='calibration_audio.txt')  # INT8
rknn.export_rknn('gigaam.rknn')
```

**Риски:**
- Не все ONNX ops conformer-архитектуры поддерживаются RKNN NPU — часть модели может упасть на CPU
- Динамические формы (переменная длина аудио) плохо работают на NPU, нужен padding или чанкование
- INT8 квантизация может деградировать WER, FP16 — компромисс
- Готовой публичной RKNN-конвертации GigaAM нет, нужно экспериментировать

**Потенциал:** STT 6-8с (CPU) → 2-3с (NPU). Требует Orange Pi 5 (RK3588S).

---

### Деплой на Orange Pi 5

Автономный пайплайн на ARM-устройстве. Зависит от OTA Update.

---

### Прочие идеи

- **Wi-Fi Onboarding через звук** — SSID/пароль через акустический модем
- **Media: Jellyfin + Lidarr** — голосовое воспроизведение локальной музыки
- **Адаптивная громкость** — тихие ответы ночью (RMS входного сигнала)
- **Бипы вместо TTS** — короткие сигналы для подтверждений
- **Гибрид regex/embeddings + LLM** — кастомная embedding model для 99% команд
- **Omni-модели** — Qwen Omni, Voxtral без STT
- **ReSpeaker USB Mic Array** — микрофонный массив с шумоподавлением

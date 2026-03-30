---
title: Архитектура — Hub-Spoke
description: Hub-Spoke архитектура для распределённого развёртывания
---

# Архитектура — Hub-Spoke

> Обновлять при: реализации hub-spoke, добавлении новых spoke-конфигураций.
> Статус: **Планируется (P3)**. Зависит от mTLS (P2).

---

## Концепция

Один и тот же Go-бинарник, разные `.env`. Все ML-сервисы за gRPC — spoke просто указывает адреса hub вместо localhost.

```
Комната 1               Комната 2               Hub (мощная машина)
┌──────────────┐        ┌──────────────┐        ┌──────────────────────┐
│ Spoke        │        │ Spoke        │        │                      │
│ - Аудио I/O  │──mTLS──│ - Аудио I/O  │──mTLS──│ STT :50051           │
│ - VAD (локал)│        │ - VAD (локал)│        │ TTS :50052           │
│ - Go client  │        │ - Go client  │        │ LLM :50054           │
└──────────────┘        └──────────────┘        │ OTA updater          │
                                                 │ Web Dashboard        │
                                                 └──────────────────────┘
```

## Конфигурации

### A — Standalone (текущая)
Всё на одном устройстве. ML-сервисы в Docker на той же машине.

```bash
STT_ADDR=stt:50051
TTS_ADDR=tts:50052
WW_ADDR=ww:50053
LLM_ADDR=llm:50054
```

### B — Hub + Spoke
Hub держит тяжёлые ML, spoke — только аудио + VAD.

```bash
# Spoke .env
STT_ADDR=hub.local:50051
TTS_ADDR=hub.local:50052
LLM_ADDR=hub.local:50054
WW_ADDR=localhost:50053   # VAD локально на spoke
TLS_ENABLED=true
TLS_CA_FILE=/run/secrets/ca.crt
TLS_CERT_FILE=/run/secrets/spoke.crt
TLS_KEY_FILE=/run/secrets/spoke.key
ROOM=bedroom              # для HA: "включи свет" → в какой комнате
```

### C — Толстый Spoke
Spoke держит VAD + TTS локально (низкая латентность на бипах/подтверждениях), STT и LLM — на hub.

## Железо

| Роль | Устройство | RAM | Цена |
|------|-----------|-----|------|
| Hub | Orange Pi 5 8GB | 8GB | ~$75 |
| Spoke | Orange Pi Zero 3 1GB | 1GB | ~$16 |
| Spoke | Raspberry Pi 3B 1GB | 1GB | ~$25 |

**Бюджет multi-room (hub + 3 spoke):** ~$123

## Spoke — образ

Минимальный Docker-образ:
- Go-оркестратор (один бинарник)
- Python-сервис VAD (только wakeword контейнер)
- mTLS клиент

**Нет:** STT, TTS, LLM, пакетного менеджера, компилятора.

**Rootfs:** read-only (`overlayfs`), запись только в tmpfs. Перезагрузка = чистое состояние.

**Ключи:** LUKS-зашифрованный раздел для mTLS сертификатов.

## OTA обновления

Spoke не имеет доступа в интернет. Обновляется только через hub:

```
Spoke:  GET /api/update/check    → { version: "v1.2.3", hash: "sha256:..." }
        GET /api/update/download → подписанный образ (Ed25519)
        Verify signature
        Apply + reboot
```

Hub опрашивает GHCR, раздаёт подписанные образы spoke.

## Мониторинг spoke

- Heartbeat каждые 30с: версия, uptime, аудио-статус
- Hub не ответил 3 раза → алерт
- Hub знает актуальную версию каждого spoke
- Аномалии трафика → WARN

## ⚠️ Архитектурные требования

**Предусмотреть при проектировании spoke-протокола:**

1. **Аудио-маршрутизация** — протокол должен поддерживать routing аудио между нодами для Multi-room Audio. Иначе breaking change.

2. **Room context** — `ROOM=bedroom` передаётся как контекст в LLM/intent для HA («включи свет» → в какой комнате).

3. **Spoke identity** — CN mTLS-сертификата = уникальный идентификатор spoke. Используется для rate limiting и routing.

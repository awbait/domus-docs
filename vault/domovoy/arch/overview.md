---
title: Архитектура — Обзор
description: Схема системы, компоненты, протоколы, deployment
---

# Архитектура — Обзор

> Обновлять при: добавлении/удалении сервисов, смене протоколов, изменении deployment-модели.

---

## Схема системы

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
│                                                         │
│   Микрофон → [Go Orchestrator] → Динамик               │
│                    │                                    │
│         ┌──────────┼──────────┐                         │
│         │          │          │                         │
│    gRPC │     gRPC │     gRPC │                         │
│         ▼          ▼          ▼                         │
│   [WW/VAD:50053] [STT:50051] [TTS:50052]               │
│   [LLM:50054]                                          │
│                                                         │
│   Сеть: ml_internal (internal: true)                   │
└─────────────────────────────────────────────────────────┘
```

## Компоненты

| Компонент   | Язык   | Технология            | Порт  |
|-------------|--------|-----------------------|-------|
| Оркестратор | Go     | malgo (CGo аудио)     | —     |
| STT         | Python | GigaAM                | 50051 |
| TTS         | Python | Silero v5 (xenia)     | 50052 |
| Wake Word   | Python | OpenWakeWord + domovoy.onnx | 50053 |
| LLM         | Python | Ollama qwen2.5:3b     | 50054 |

## Протоколы

- **gRPC + protobuf** — между Go-ядром и всеми ML-сервисами
- **HTTP** — Go → Open-Meteo (погода), Go → Home Assistant (планируется)
- **malgo (CGo)** — аудио I/O (микрофон, динамик)

## Deployment

Сейчас: **Docker Compose** на одной машине.
Планируется: **Hub-Spoke** — hub (тяжёлые ML) + spoke (аудио I/O) в разных комнатах.

Подробнее → [[hub-spoke]]

## Файлы

- `cmd/domovoy/main.go` — точка входа, wiring, readiness check
- `docker-compose.yml` — все сервисы + healthchecks + сети
- `.env` — локальная конфигурация
- `scripts/load-env.ps1` — загрузка .env в PowerShell

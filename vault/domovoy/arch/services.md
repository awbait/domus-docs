---
title: Архитектура — ML-сервисы
description: ML-сервисы: модели, конфиги, gRPC контракты
---

# Архитектура — ML-сервисы

> Обновлять при: смене моделей, изменении gRPC контрактов, добавлении новых сервисов.

---

## STT — Speech-to-Text

**Порт:** 50051
**Модель:** GigaAM (onnx-asr, gigaam-v3-e2e-ctc)

| Параметр | Значение |
|----------|----------|
| WER (русский) | 8.4% |
| RAM | ~500 MB |
| Латентность | 5-8с |
| Пунктуация | Из коробки |
| Галлюцинации на тишине | Нет |

**Конфиг:**
- `PREBAKE_MODEL=small` — модель зашивается в образ при сборке
- `STT_TIMEOUT=15s` в Go клиенте

**gRPC контракт:** `proto/stt.proto`

---

## TTS — Text-to-Speech

**Порт:** 50052
**Модель:** Silero TTS v5, голос `xenia`

**Нормализация текста** (`services/tts-silero/normalize.py`):
- `°C` → «градусов»
- `HH:MM` → время с ведущим нулём
- `км/ч`, `м/с` → словами
- `%` → «процентов»
- Даты → ординалы («одиннадцатое марта»)
- 45 pytest кейсов

**Конфиг:**
- `TTS_TIMEOUT=5s` в Go клиенте

**gRPC контракт:** `proto/tts.proto`

---

## Wake Word

**Порт:** 50053
**Модель:** кастомная `domovoy.onnx` (OpenWakeWord)

**Параметры:**
- `WW_MODEL=/app/domovoy.onnx`
- `WW_THRESHOLD=0.5` — порог уверенности
- Onset: 3 кадра подряд > порога
- Cooldown: 30 чанков после срабатывания

**Модель v1:**
- Архитектура: Flatten→Linear(N,32)→LN→ReLU→Linear(32,32)→LN→ReLU→Linear(32,1)→Sigmoid (~350KB ONNX)
- Данные: 350 positive, 407 adversarial negative, 1552 FLEURS negative
- Тест: 9/10 positive >0.5, все negative <0.05
- Статус: работает, нестабильна на живом микрофоне → нужен v2

**Async gRPC клиент** (Go):
- Source-drain горутина стартует ДО открытия gRPC stream
- Буфер 100 слотов (~10с) на время подключения Docker
- `conn.Connect()` в `New()` для pre-warm

**gRPC контракт:** `proto/wakeword.proto`

---

## LLM

**Порт:** 50054
**Модель:** Ollama qwen2.5:3b

**Go gRPC proxy** (`services/llm/server.py`):
- Проксирует Ollama через gRPC
- Передаёт tool definitions и tool results

**Tool Calling** (Go, `internal/tools/`):
- Agent loop до 5 итераций
- Инструменты: `get_time`, `get_date`, `get_weather` (Open-Meteo)
- Registry pattern: `tools.Registry` → `Tool` interface

**История диалога:**
- Кольцевой буфер `LLM_MAX_HISTORY=10`
- TTL сброс при длинных паузах
- `ClearHistory()` при новой сессии (wake word)

**gRPC контракт:** `proto/llm.proto`

---

## Health Checks

Все сервисы реализуют gRPC Health protocol (`grpc_health.v1`).

**docker-compose.yml:** healthcheck через Python one-liner, `start_period=60s`.

**Go readiness** (`internal/app/readiness.go`): `WaitForServices()` опрашивает health каждые 2с перед запуском пайплайна.

---

## Запуск

```powershell
docker compose up --build -d
. .\scripts\load-env.ps1; go run ./cmd/domovoy
```

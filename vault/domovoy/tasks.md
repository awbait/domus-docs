---
kanban-plugin: board
icon: MiAddTask
---

## Ideas

- [ ] Two-stage LLM routing #ml #backlog
	Лёгкая модель (qwen2.5:0.5b) для простых запросов (<1с), тяжёлая (qwen2.5:7b) для сложных. IntentRouter решает маршрут: regex → без LLM, простой вопрос → лёгкая, неуверенность/сложный → тяжёлая. [[implementation-plan#Two-stage LLM routing]]
- [ ] Home Assistant интеграция #pipeline #backlog
	Intent parser (regex + LLM fallback), HA REST API клиент, роутинг команд. ⚠️ **Архитектура**: интерфейс `IntentRouter` должен быть заложен при реализации стоп-слов. [[implementation-plan#Home Assistant интеграция]]
- [ ] Wake Word «Домовой» v2 #ml #backlog
	Дообучение с реальными записями: 5-10 человек, voice conversion, больше шума. [[implementation-plan#Wake Word «Домовой» v2]]
- [ ] Контекстная память (20 сек) #pipeline #backlog
	«Сделай потемнее» в течение 20 сек после «включи свет». ⚠️ **Архитектура**: `SessionState` с таймерами закладывается при реализации стоп-слов. [[implementation-plan#Контекстная память (20 сек)]]
- [ ] Multi-room Audio #infra #backlog
	Синхронизированное воспроизведение по всем колонкам. ⚠️ **Архитектура**: зависит от Hub-Spoke — spoke-протокол должен поддерживать аудио-маршрутизацию. [[implementation-plan#Multi-room Audio]]
- [ ] Kokoro TTS — кастомный голос #ml #backlog
	Датасет RUSLAN (31 час, мужской), обучение в Colab, экспорт ONNX. [[implementation-plan#Kokoro TTS — кастомный голос]]
- [ ] NPU оптимизация (RK3588S) #ml #research #backlog
	Исследовательская задача. Конвертация GigaAM ONNX → RKNN через RKNN-Toolkit2. Основной риск: не все ops conformer-архитектуры поддерживаются NPU, динамические формы (переменная длина аудио) проблематичны. Часть модели может остаться на CPU. Потенциал: STT 6-8с → 2-3с. Требует Orange Pi 5. [[implementation-plan#NPU оптимизация (RK3588S)]]
- [ ] Деплой на Orange Pi 5 #infra #backlog
	Автономный пайплайн на ARM-устройстве. [[implementation-plan#Деплой на Orange Pi 5]]
- [ ] Детский режим #pipeline #backlog
	На базе Speaker Recognition. Безопасный system prompt, ограниченные команды, озвучка сказок. [[implementation-plan#Speaker Recognition → Детский режим]]
- [ ] Wi-Fi Onboarding через звук #infra #backlog
	Кодировать SSID/пароль в аудиосигнале (акустический модем).
- [ ] Media: Jellyfin + Lidarr #backlog
	Голосовое управление локальным воспроизведением музыки.
- [ ] Адаптивная громкость #backlog
	Тихие ответы ночью на основе RMS входного сигнала.
- [ ] Бипы вместо TTS #backlog
	Короткие аудиосигналы для подтверждений вместо полного TTS.
- [ ] Гибрид regex/embeddings + LLM #ml #backlog
	Кастомная модель эмбеддингов для 99% команд, LLM как fallback.
- [ ] Omni-модели #ml #backlog
	Прямые голосовые модели (Qwen Omni, Voxtral) без STT.
- [ ] ReSpeaker USB Mic Array #backlog
	Микрофонный массив с шумоподавлением и beamforming.


## Planned
- [ ] Шифрование логов диалогов #security #p1
	AES-256-GCM record-by-record для dialog.jsonl. Новый `internal/dialog/crypto.go`. [[implementation-plan#Шифрование логов диалогов]]
- [ ] Web Dashboard #ui #p2
	HTTP-сервер: статус сервисов, история диалогов, spoke-устройства. CQRS — прямые чтения из dialog log. [[implementation-plan#Web Dashboard]]
- [ ] mTLS между hub и spoke #security #p2
	TLS 1.3, все gRPC клиенты, `internal/security/tls.go`. Только hub↔spoke (не локальные контейнеры). Ротация сертов через OTA updater. [[implementation-plan#mTLS между hub и spoke]]
- [ ] Speaker Recognition (Voice ID) #ml #p2
	gRPC сервис, d-vector/x-vector, регистрация 3-5 фразами. Новый шаг в пайплайне после wake word. [[implementation-plan#Speaker Recognition (Voice ID)]]
- [ ] Hub-Spoke архитектура #arch #infra #p3
	Spoke — минимальный образ, read-only rootfs, LUKS для ключей, обновления через hub. ⚠️ Предусмотреть аудио-маршрутизацию в протоколе. Зависит от mTLS. [[implementation-plan#Hub-Spoke архитектура]]
- [ ] Rate limiting #security #p3
	gRPC interceptor, spoke ID из mTLS сертификата (CN). Зависит от mTLS. [[implementation-plan#Rate limiting]]
- [ ] OTA Update система #infra #p3
	Hub раздаёт обновления spoke, ротация сертов, heartbeat, rollback. Зависит от Hub-Spoke. [[implementation-plan#OTA Update система]]


## In Progress



## Done

- [x] Сетевая изоляция Docker #infra #security #p1
	`expose` + `ml_internal: internal: true`. `Dockerfile` для domovoy. Dev override для localhost. [[implementation-plan#Сетевая изоляция Docker]]
- [x] Стоп-слова + Повтори #pipeline #p1
	`internal/intent/router.go` — IntentRouter (cancel/repeat/llm). `Session.LastSpeech` кеш. `LogStop` в dialog log. [[implementation-plan#Стоп-слова + Повтори]]
- [x] Рефакторинг: соответствие go-practices #arch #p1
	1. `app.Message` домен-модель вместо `llmpb.Message` в `llm/client.go`. 2. `time.Sleep` → `context.WithTimeout` в `audio/capture_test.go`. [[implementation-plan#Рефакторинг: соответствие go-practices]]



%% kanban:settings
```
{"kanban-plugin":"board","list-collapse":[false,false,false,false]}
```
%%

# Subagent Template

Каркас для нового subagent definition в `.claude/agents/<role>.md`.

## Структура файла

```markdown
---
name: <role-name>
description: <Когда Claude должен делегировать. Краткое описание триггеров и scope.>
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
skills:
  - <skill-1>
  - <skill-2>
mcpServers:
  - gitea
isolation: worktree
color: blue
---

# <Role Display Name>

Ты — <роль> в проекте Domus.

## Scope (где пишешь код)

- `repos/<repo>/<path>/` — описание

## Проектная документация (читать перед работой)

- `repos/domus-docs/vault/<repo>/<file>.md` — что там
- `repos/domus-docs/vault/<repo>/<file>.md` — что там

## Контракт

**Обязательно** соблюдай контракт: `repos/domus-docs/vault/agents-workflow/agent-contract.md`

Перед работой выполни шаги 0-A контракта (чтение проектной доки + валидация issue).

## Стек (быстрый референс)

- ...

## Стоп-сигналы

- <ситуация> → передать <другая роль>
- <ситуация> → спросить пользователя
```

## Поля frontmatter (обязательные)

- **`name`** — lowercase + дефисы, уникально
- **`description`** — Claude использует это для автоматического делегирования. Должно описывать **когда** звать этого агента (триггеры, типы задач), а не **как** он работает. Пример: "Implements Go code in domovoy and focus-dashboard backend. Use for backend tasks: chi router, sqlite, gRPC."

## Поля frontmatter (опциональные)

- **`tools`** — allowlist. Если опущено — наследует все. Для агентов, которые НЕ пишут код, ограничить до Read/Glob/Grep/Bash.
- **`disallowedTools`** — denylist (полезно если агент должен иметь почти всё, но не Write/Edit).
- **`model`**:
  - `sonnet` — по умолчанию для большинства
  - `opus` — для analyzer (нужно глубокое понимание) и сложных задач
  - `haiku` — для простых рутинных операций
- **`skills`** — preload скиллов в системный промпт. **Skills не наследуются** от родительской сессии — нужно явно перечислить.
- **`mcpServers`** — `[gitea]` для всех агентов, которые работают с задачами.
- **`isolation: worktree`** — для всех implementer-агентов (пишут код). НЕ ставить для analyzer/triager (они read-only).
- **`color`** — для визуального различения в task list. Доступны: red, blue, green, yellow, purple, orange, pink, cyan.
- **`memory: project`** — если хочешь чтобы агент копил knowledge между сессиями в `.claude/agent-memory/<name>/`.

## Body (системный промпт)

Минимальная структура:

1. **Кто ты** — одна строка
2. **Scope** — где пишешь код (пути)
3. **Проектная дока** — что прочитать перед работой (ссылки на vault)
4. **Контракт** — ссылка на agent-contract.md
5. **Стек** — короткий референс по технологиям
6. **Стоп-сигналы** — когда передать другому или спросить

**Что НЕ дублировать в body:**
- Полный текст контракта (он в agent-contract.md, агент сам прочитает)
- Полный список labels (в labels.md)
- Описания других ролей (в agents.md)

Body должен быть **компактным** — 30-60 строк. Длинный системный промпт жрёт
контекст и хуже работает.

## Как обновить существующего агента

1. Отредактировать `.claude/agents/<role>.md`
2. **Restart Claude Code сессию** или `/agents` — subagents загружаются при старте
3. Проверить через `claude agents` (CLI)

## Создание нового агента

1. Скопировать этот template
2. Заполнить frontmatter
3. Написать body (компактно)
4. Сохранить в `.claude/agents/<name>.md`
5. Restart сессию
6. Добавить роль в `agents.md` (этот же каталог)
7. Если нужны новые labels — добавить в `labels.md`

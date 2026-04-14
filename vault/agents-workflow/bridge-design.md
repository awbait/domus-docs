# Agent Bridge — дизайн

Go-сервис, который слушает webhooks Gitea и автоматически запускает агентов
на смену labels. **Пилот завершён (2026-04-14), ручной режим работает. Bridge — следующий шаг.**

## Текущее состояние (без bridge)

Сейчас pipeline работает полностью вручную:
1. Ты говоришь "возьми #N go-developer'ом"
2. Главный Claude пишет pointer-file: `echo <repo> > .claude/.next-worktree-target`
3. Спаунит агента с `isolation: worktree`
4. Кастомный хук `worktree-create.sh` создаёт worktree в `.worktrees/<repo>-agents-<agent-name>/`
5. Агент работает, создаёт PR, ставит `status:review` → СТОП
6. Ты ревьюишь и мержишь

Bridge автоматизирует шаги 1-3: Gitea webhook → bridge → Claude Code spawn.

## Назначение

- Реактивный pipeline: смена label → автозапуск нужного агента
- Маппинг событие → агент по типу/scope задачи
- Без polling — чистые webhooks
- Pointer-file протокол для worktree isolation
- Логирование всех запусков
- Очередь на sqlite (dedup, rate-limit, история)

## Архитектура

```
┌────────────┐                                  ┌──────────────┐
│   Gitea    │ ──── webhook (issue/label) ────▶ │ agent-bridge │
└────────────┘                                  │   (Go svc)   │
                                                └──────┬───────┘
                                                       │
                                          1. write pointer-file
                                          2. exec claude --agent <role>
                                                       │
                                                       ▼
                                          Claude Code + worktree hooks
                                                       │
                                                       ▼
                                          (worktree, code, PR, labels)
                                                       │
                                                       ▼
                                          ─── back to Gitea via MCP ───
```

## Ключевое отличие от черновика

Изначально предполагалось, что `isolation: worktree` работает "из коробки".
На практике корень `d:/projects/domus/` — **не git-репо**, и встроенная
изоляция Claude Code не работает. Решение — кастомные хуки
`WorktreeCreate`/`WorktreeRemove` в `.claude/hooks/` с pointer-file протоколом.

Bridge должен:
1. **Перед** запуском Claude Code записать имя репо в
   `.claude/.next-worktree-target`
2. Запустить `claude` с нужным агентом
3. Хук прочитает pointer, создаст worktree, вернёт путь агенту
4. **Последовательно** — нельзя спаунить двух агентов в разные репо
   одновременно (pointer-file одноразовый)

Подробности протокола: [worktree-hooks.md](worktree-hooks.md).

## Расположение

```
d:/projects/domus/agent-bridge/         ← отдельная директория в корне (не в repos/)
├── cmd/agent-bridge/main.go
├── internal/
│   ├── webhook/                — приём Gitea webhooks (HTTP server)
│   ├── router/                 — маппинг событие → агент
│   ├── runner/                 — exec.Command("claude", ...)
│   │                             + pointer-file + sequential lock
│   ├── queue/                  — durable очередь (sqlite)
│   ├── config/                 — YAML с правилами роутинга
│   └── log/                    — структурированные логи (slog)
├── config.yaml                 — правила
├── Dockerfile
└── README.md
```

## Маппинг событий → агенты

```yaml
# config.yaml
gitea:
  url: http://localhost:3000
  webhook_secret: <secret>
  token: <gitea token>

claude:
  binary: claude
  project_dir: "d:/projects/domus"     # CLAUDE_PROJECT_DIR для хуков
  pointer_file: ".claude/.next-worktree-target"

models:
  analyzer: opus          # глубокий анализ
  default: sonnet         # всё остальное

routes:
  # Новое issue без labels → triager
  - on: issues
    action: opened
    agent: triager
    repo_from: event      # определяется из webhook payload

  # status:needs-analysis → analyzer
  - on: issues
    action: label_updated
    label_added: status:needs-analysis
    skip_if_label: human-only
    agent: analyzer

  # status:ready → routing по типу/файлам
  - on: issues
    action: label_updated
    label_added: status:ready
    skip_if_label: human-only
    route_by:
      - if: "type:docs in labels"
        agent: doc-writer
      - if: "refactor in labels"
        agent: refactor
      - if: "'services/' in body"
        agent: python-ml
      - if: "'web/' in body"
        agent: react-developer
      - if: "'Dockerfile' in body or 'docker-compose' in body"
        agent: devops
      - default: go-developer

  # Комментарий с @claude → resume/continue
  - on: issue_comment
    action: created
    body_contains: "@claude"
    agent: <determine from current status/labels>
```

## Запуск Claude Code

```go
// runner/runner.go
func (r *Runner) RunAgent(ctx context.Context, job Job) error {
    // Sequential lock — один агент за раз (pointer-file ограничение)
    r.mu.Lock()
    defer r.mu.Unlock()

    // 1. Записать pointer-file
    pointerPath := filepath.Join(r.projectDir, ".claude", ".next-worktree-target")
    if err := os.WriteFile(pointerPath, []byte(job.Repo+"\n"), 0644); err != nil {
        return fmt.Errorf("write pointer: %w", err)
    }

    // 2. Запустить Claude Code
    cmd := exec.CommandContext(ctx, "claude",
        "--agent", job.Agent,
        "--print",
        job.Prompt,
    )
    cmd.Dir = r.projectDir
    cmd.Env = append(os.Environ(),
        "CLAUDE_PROJECT_DIR="+r.projectDir,
    )

    out, err := cmd.CombinedOutput()
    slog.Info("agent finished",
        "agent", job.Agent,
        "repo", job.Repo,
        "issue", job.IssueNumber,
        "exit", cmd.ProcessState.ExitCode(),
        "duration", time.Since(job.StartedAt),
    )
    return err
}
```

**Открытые вопросы по runner:**
- Точный синтаксис CLI для headless agent spawn (`claude --agent <role>`)
  нужно проверить экспериментально — API может отличаться от интерактивного режима.
- Нужен ли `--model` флаг, или модель берётся из frontmatter `.claude/agents/<role>.md`?
  Текущее предположение: frontmatter определяет модель, дополнительный флаг не нужен.

## Очередь (sqlite)

Простая очередь, чтобы:
- Не терять события при перезапуске bridge
- Dedup (одно событие не запускает агента дважды)
- Rate limit (sequential lock на runner + max queue depth)
- История запусков (debug, метрики)

```sql
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  event_id TEXT UNIQUE,         -- идемпотентность (delivery UUID от Gitea)
  repo TEXT,
  issue_number INTEGER,
  agent TEXT,
  status TEXT,                  -- pending, running, done, failed
  prompt TEXT,
  worktree_path TEXT,
  created_at TIMESTAMP,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  exit_code INTEGER,
  log_path TEXT
);
```

## Cleanup worktrees

Два механизма:

1. **Автоматический** — хук `WorktreeRemove` срабатывает при завершении
   агентской сессии Claude Code. Удаляет worktree и ветку `agents/<name>`.

2. **По merge PR** — webhook `pull_request.closed` с `merged: true`:
   - Найти feature-ветку PR
   - `git -C repos/<repo> branch -d <branch>` (если не удалилась автоматически)
   - Worktree к этому моменту уже должен быть удалён хуком. Если нет — `git worktree prune`.

3. **GC** — раз в день: `git worktree prune` по всем `repos/*/`.

## Запреты для bridge

- **Никогда не мержит PR** — это всегда человек
- **Никогда не закрывает issue** — только через merge с `fixes #N`
- **Никогда не пушит в main**
- **Не запускает агента на `human-only` issue**
- **Не запускает агента без явного trigger-label** (`status:ready`, `status:needs-analysis`, etc.)
- **Не запускает approval** (`status:needs-approval → status:ready`) — только человек

## Логирование

- slog JSON — структурированные логи bridge
- Каждый запуск агента → лог в sqlite (exit code, duration, repo, issue)
- Опционально: отдельный файл `.worktrees/<id>/agent.log` для debug

## Развёртывание

Локально на том же хосте, где Gitea:

```yaml
# docker-compose.yml
agent-bridge:
  build: ./agent-bridge
  ports:
    - "127.0.0.1:9090:9090"
  volumes:
    - ./repos:/app/repos:rw
    - ./.worktrees:/app/.worktrees:rw
    - ./.claude:/app/.claude:rw           # pointer-file + hooks + agents
    - claude-home:/root/.claude           # Claude Code config + MCP
  environment:
    GITEA_URL: http://gitea:3000
    GITEA_TOKEN: ${GITEA_TOKEN}
    WEBHOOK_SECRET: ${WEBHOOK_SECRET}
    CLAUDE_PROJECT_DIR: /app
```

Webhook URL в Gitea: `http://agent-bridge:9090/webhook`.

## Что НЕ делает bridge

- **Approval** (`needs-approval → ready`) — твой клик
- **Merge PR** — твой клик
- **Создание задач** — ты или triager
- **Архитектурные решения** — bridge только dispatch

## Этапы реализации

1. **MVP:** webhook HTTP server + один маршрут (`status:needs-analysis → analyzer`),
   pointer-file + sequential lock, без очереди
2. **+ routing:** маппинг `status:ready` → нужный implementer по labels/body
3. **+ очередь:** sqlite jobs table, idempotency, retry
4. **+ cleanup:** автоматический GC worktrees после merge
5. **+ observability:** метрики (запуски, длительность, fail rate), health endpoint

## Открытые вопросы

- [ ] Точный CLI синтаксис headless agent spawn — проверить экспериментально
- [ ] Где хранить Gitea token — env достаточно для single-host, secret manager для production
- [ ] Нужен ли `--model` флаг или frontmatter хватает
- [ ] Webhook secret validation — обязательно (HMAC-SHA256)
- [ ] Как bridge узнаёт, в каком репо issue? Из webhook payload `repository.name`
- [ ] Таймаут на agent run — сколько ждать? 10 минут? 30? Конфигурируемо?

## Уроки из пилота (2026-04-14)

Полный pipeline протестирован вручную на `domus/sandbox`:
- triager (sonnet) → 33 сек, корректная разметка
- analyzer (opus) → 1 мин, качественный план
- go-developer (sonnet) → 1.5-3.5 мин, рабочий код + тесты + PR

**Что bridge должен учесть:**
- Pointer-file consume'ится при успехе, но **сохраняется при ошибке** (retry-safe)
- Worktree remove может флакать на Windows (file locking) — fallback rm+prune работает
- MCP gitea иногда корраптит UTF-8 в длинных комментариях (баг gitea-mcp)
- Агенты на sonnet справляются с implementation tasks — opus нужен только analyzer'у

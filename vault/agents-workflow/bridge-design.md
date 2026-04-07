# Agent Bridge — дизайн

Go-сервис, который слушает webhooks Gitea и автоматически запускает агентов
на смену labels. **Внедряется после пилота с ручным режимом.**

## Назначение

- Реактивный pipeline: `status:ready` → автозапуск нужного агента
- Маппинг событие → агент по типу/scope задачи
- Без жёсткого polling
- Логирование всех запусков
- Опционально: dedup, очередь, rate-limit

## Архитектура

```
┌────────────┐                                  ┌──────────────┐
│   Gitea    │ ──── webhook (issue/PR/label) ──▶│  agent-bridge│
└────────────┘                                  │   (Go svc)   │
                                                └──────┬───────┘
                                                       │
                                              spawn (exec.Command)
                                                       │
                                                       ▼
                                          claude --print --agent <role>
                                                       │
                                                       ▼
                                          (worktree, code, PR, label)
                                                       │
                                                       ▼
                                          ─── back to Gitea ───
```

## Расположение

```
d:/projects/domus/agent-bridge/
├── cmd/agent-bridge/main.go
├── internal/
│   ├── webhook/                — приём Gitea webhooks (HTTP server)
│   ├── router/                 — мэппинг событие → агент
│   ├── runner/                 — exec.Command("claude", "--print", ...)
│   ├── queue/                  — durable очередь (sqlite)
│   ├── worktree/               — управление .worktrees/* (cleanup)
│   ├── config/                 — TOML/YAML с правилами роутинга
│   └── log/                    — структурированные логи (slog)
├── config.yaml                 — правила
├── Dockerfile
└── README.md
```

## Маппинг событий → агенты

```yaml
# config.yaml (черновик)
gitea:
  url: http://localhost:3000
  webhook_secret: <secret>
  token: <gitea token для tea CLI>

claude:
  binary: claude
  default_args: ["--print"]
  workdir_template: ".worktrees/{repo}-issue-{number}"

routes:
  # Новое issue → triager
  - on: issues
    action: opened
    agent: triager
    prompt: "Размечай новый issue: {repo.full_name}#{issue.number}. Прочитай содержимое и выстави type/priority labels."

  # status:needs-analysis → analyzer
  - on: issues
    action: label_updated
    label_added: status:needs-analysis
    skip_if_label: human-only
    agent: analyzer
    prompt: "Проанализируй задачу {repo.full_name}#{issue.number}. Прочитай контракт и проектную доку."

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
      - if: "repo == 'domovoy' and 'services/' in body"
        agent: python-ml
      - if: "repo == 'focus-dashboard' and 'web/' in body"
        agent: react-developer
      - if: "Dockerfile or docker-compose in body"
        agent: devops
      - default: go-developer
    prompt: "Возьми задачу {repo.full_name}#{issue.number}. Прочитай контракт и acceptance criteria."

  # Комментарий @claude
  - on: issue_comment
    action: created
    body_contains: "@claude"
    agent: <determine from current status>
    prompt: "Продолжи работу по issue {repo.full_name}#{issue.number}. Прочитай последний комментарий пользователя."
```

## Запуск Claude Code в headless

```go
// runner/runner.go (псевдокод)
func RunAgent(ctx context.Context, role string, prompt string, cwd string) error {
    cmd := exec.CommandContext(ctx, "claude",
        "--print",
        "--agent", role,
        prompt,
    )
    cmd.Dir = cwd
    cmd.Env = append(os.Environ(),
        "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1",
    )

    out, err := cmd.CombinedOutput()
    log.Info("agent run", "role", role, "exit", cmd.ProcessState.ExitCode())
    return err
}
```

**Открытый вопрос:** работает ли `isolation: worktree` из subagent frontmatter,
если subagent запускается **напрямую** через `claude --agent X` (не через
Agent tool родительского агента)? Нужно проверить экспериментально. Если не
работает — bridge сам делает `git worktree add` перед запуском и `git worktree
remove` после.

## Очередь

Простая очередь на sqlite, чтобы:
- Не терять события если bridge перезапустился
- Dedup (одно и то же событие не запускает дважды)
- Rate limit (не более N агентов одновременно)
- История запусков (debug)

Схема:
```sql
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  event_id TEXT UNIQUE,         -- идемпотентность
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

После того как PR смержен (webhook `pull_request.closed` с `merged: true`):
```go
git -C repos/<repo> worktree remove .worktrees/<repo>-issue-<N>
```

Или периодический GC: раз в день удалять worktrees, чьи ветки уже смержены или удалены.

## Запреты для bridge

- **Никогда не мержит PR** — это всегда человек
- **Никогда не закрывает issue вручную** — только через merge с `fixes #N`
- **Никогда не пушит в main**
- **Не запускает агента без `status:ready` или явной команды**

Это дублирование запретов из agent-contract.md, но bridge отдельный
исполнитель — должны быть свои защитные ограничения на уровне роутинга.

## Логирование

- Структурированные логи (slog JSON)
- Каждый запуск агента → отдельный лог-файл `.worktrees/<repo>-issue-<N>/agent.log`
- Метрики: количество запусков по агентам, длительность, exit codes

## Развёртывание

Локально на том же хосте, где Gitea:
```yaml
# docker-compose.yml фрагмент
agent-bridge:
  build: ./agent-bridge
  ports:
    - "127.0.0.1:8080:8080"
  volumes:
    - ./repos:/repos
    - ./.worktrees:/.worktrees
    - claude-config:/root/.claude
  environment:
    GITEA_URL: http://gitea:3000
    GITEA_TOKEN: ${GITEA_TOKEN}
    WEBHOOK_SECRET: ${WEBHOOK_SECRET}
```

Webhook URL в Gitea: `http://localhost:8080/webhook/gitea`.

## Что НЕ делает bridge (умышленно)

- **Approval `status:needs-approval → status:ready`** — это твой клик, не автомат
- **Merge** — твой клик
- **Создание задач** — задачи создаёшь ты или triager на новых issue
- **Принятие архитектурных решений** — bridge только запускает агента

## Этапы реализации

1. MVP: webhook + один маршрут (`status:needs-analysis → analyzer`), без очереди
2. + routing по типам задач для `status:ready`
3. + sqlite очередь, idempotency
4. + автоматический cleanup worktrees после merge
5. + метрики и UI (опционально)

## Открытые вопросы

- Как именно работает `isolation: worktree` в headless mode? Нужен эксперимент.
- Где хранить Gitea token — env, файл, secret manager?
- Нужна ли interactive approval через Gitea PR review для критичных изменений?
- Webhook secret validation — обязательно

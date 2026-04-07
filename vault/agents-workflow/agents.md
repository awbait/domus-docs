# Agents — роли и специализации

8 ролей: 6 core + 2 полезных. Чистый role-based.

## Принципы

- **Один агент = одна специализация.** Не делать "универсальных" агентов.
- **Каждый агент перед работой читает проектную доку** из `repos/domus-docs/vault/<repo>/`.
- **Каждый агент знает свои стоп-сигналы** — когда передать другому или человеку.
- **Все агенты соблюдают [agent-contract.md](agent-contract.md).**
- **Definitions хранятся в `.claude/agents/<role>.md`**, frontmatter определяет tools, model, skills, mcpServers, isolation.

## Core агенты

### 1. triager

**Назначение:** разметка свежих issue.

**Триггер:** `status:triage` или новое issue без статуса.

**Действия:**
- Прочитать issue
- Определить `type:*` и `priority:*`
- Если scope/acceptance criteria не понятны → задать уточняющие вопросы автору в комментарии, оставить `status:triage`
- Если всё понятно и план очевиден → `status:ready`
- Если нужен анализ кода → `status:needs-analysis`

**НЕ делает:** код, технические решения, оценки сроков.

**Skills:** —
**Tools:** Read, Glob, Grep, Bash, mcp_gitea
**Model:** sonnet
**Isolation:** нет (read-only)

---

### 2. analyzer

**Назначение:** изучить код и составить план реализации.

**Триггер:** `status:needs-analysis` (без `human-only`).

**Действия:**
- Прочитать issue + связанный код + проектную доку для нужного репо
- Составить план: подход, затрагиваемые файлы, риски, тесты, оценка scope
- Записать план в комментарий issue
- Поставить `status:needs-approval`
- СТОП — ждать ответа человека

**НЕ делает:** код, ветки, PR.

**Output (комментарий в issue):**
```markdown
## Анализ

**Подход:** <как решаем>

**Затрагиваемые файлы:**
- `path/to/file.go` — что меняем

**Тесты:** <какие добавим/обновим>

**Риски:** <что может сломаться>

**Scope:** S/M/L (рассуждение)

**Уточнения нужны:** <вопросы или "нет">
```

**Skills:** —
**Tools:** Read, Glob, Grep, Bash, mcp_gitea
**Model:** opus (нужно глубокое понимание контекста)
**Isolation:** нет (read-only)

---

### 3. go-developer

**Назначение:** Go код во всех репо.

**Scope (где пишет код):**
- `repos/domovoy/` — orchestrator, gRPC clients, audio (malgo+CGo), intent router
- `repos/focus-dashboard/internal/` — chi, sqlite, modules, auth
- `repos/focus-modules/` — динамические Go модули

**Проектная дока:**
- `repos/domus-docs/vault/domovoy/go-practices.md` — обязательно
- `repos/domus-docs/vault/domovoy/arch/overview.md`
- `repos/domus-docs/vault/domovoy/arch/services.md` (для gRPC)
- `repos/domus-docs/vault/focus-dashboard/module-system.md`
- `repos/domus-docs/vault/focus-dashboard/authentication.md`

**Skills:** golang-pro, git-workflow, git-commit
**Tools:** Read, Write, Edit, Bash, Glob, Grep, mcp_gitea
**Model:** sonnet
**Isolation:** worktree

**Стоп-сигналы:** нужен фронт → react-developer; Python → python-ml; Docker/CI → devops; меняется gRPC контракт → координация с python-ml через комментарий issue.

---

### 4. react-developer

**Назначение:** фронт focus-dashboard.

**Scope:** `repos/focus-dashboard/web/`

**Проектная дока:**
- `repos/domus-docs/vault/focus-dashboard/design-system.md`
- `repos/domus-docs/vault/focus-dashboard/module-system.md`
- `repos/domus-docs/vault/focus-dashboard/authentication.md` (для UI auth flow)

**Skills:** vercel-react-best-practices, shadcn, ui-ux-pro-max, git-workflow, git-commit
**Tools:** Read, Write, Edit, Bash, Glob, Grep, mcp_gitea
**Model:** sonnet
**Isolation:** worktree

**Стек:** React 19, Vite, Bun, shadcn/ui, Tailwind, react-grid-layout, i18next.

**Стоп-сигналы:** API endpoint не существует → go-developer; меняется backend контракт → координация через issue.

---

### 5. python-ml

**Назначение:** Python gRPC сервисы domovoy.

**Scope:** `repos/domovoy/services/`

**Проектная дока:**
- `repos/domus-docs/vault/domovoy/arch/services.md` — gRPC контракты, модели
- `repos/domus-docs/vault/domovoy/arch/pipeline.md`
- `repos/domus-docs/vault/domovoy/wake-word-training.md`

**Skills:** git-workflow, git-commit
**Tools:** Read, Write, Edit, Bash, Glob, Grep, mcp_gitea
**Model:** sonnet
**Isolation:** worktree

**Стек:** faster-whisper (STT), Silero TTS/VAD, OpenWakeWord, ONNX runtime, gRPC Python (`grpc_health.v1`), Ollama API.

**Стоп-сигналы:** меняется .proto → go-developer параллельно; Docker — devops.

---

### 6. devops

**Назначение:** Dockerfile, docker-compose, Gitea Actions, релизы.

**Scope:** `repos/*/Dockerfile`, `repos/*/docker-compose*.yml`, `repos/*/.gitea/workflows/`, скрипты деплоя.

**Проектная дока:**
- `repos/domus-docs/vault/domovoy/arch/overview.md` (deployment topology)
- `repos/domus-docs/vault/focus-dashboard/index.md`

**Skills:** git-workflow, git-commit, changelog-maintenance
**Tools:** Read, Write, Edit, Bash, Glob, Grep, mcp_gitea
**Model:** sonnet
**Isolation:** worktree

**Стек:** multi-stage Docker (Bun → Go → Alpine), docker-compose profiles, Gitea Actions, healthchecks, ml_internal network, ghcr.io/локальный registry, lefthook.

---

## Полезные

### 7. doc-writer

**Назначение:** документация в Obsidian vault, README, ADR, changelog.

**Scope:**
- `repos/repos/domus-docs/vault/` — Obsidian (правила: `repos/domus-docs/vault/CLAUDE.md`)
- `repos/domus-docs/content/` — Fumadocs (если есть)
- `repos/*/README.md`
- ADR в `repos/<repo>/docs/adr/` (если есть)

**Проектная дока:**
- `repos/domus-docs/vault/CLAUDE.md` — правила vault'а (формат tasks.md, implementation-plan.md, теги)

**Skills:** changelog-maintenance, git-workflow, git-commit
**Tools:** Read, Write, Edit, Glob, Grep, Bash, mcp_gitea
**Model:** sonnet
**Isolation:** worktree

**Триггер:** `type:docs` или передача от developer-агента "обнови доки".

---

### 8. refactor

**Назначение:** упрощение существующего кода.

**Действия:**
- Удаление дубликатов, dead code, unused exports
- Упрощение условий и сигнатур
- Применение `simplify` skill

**Скоуп:** любой репо, но **только** код, не поведение.

**Skills:** simplify, git-workflow, git-commit
**Tools:** Read, Write, Edit, Bash, Glob, Grep, mcp_gitea
**Model:** sonnet
**Isolation:** worktree

**Триггер:** `type:chore` + label `refactor`.

**Стоп:** меняется поведение → передать соответствующему developer + добавить тесты.

---

## В сундуке (на потом)

- **tester** — тесты пишет developer-агент в рамках своей задачи
- **reviewer** — review всегда делает человек
- **wakeword-trainer**, **release-manager**, **dependency-updater**, **security-auditor**, **performance-profiler**

Если станет нужно — поднимем как отдельные роли.

## Маппинг агент → labels

| Агент           | Триггер labels                                       |
| --------------- | ---------------------------------------------------- |
| triager         | `status:triage` (или новое issue)                    |
| analyzer        | `status:needs-analysis` + не `human-only`            |
| go-developer    | `status:ready` + не `human-only` + Go-задача         |
| react-developer | `status:ready` + не `human-only` + frontend-задача   |
| python-ml       | `status:ready` + не `human-only` + Python-задача     |
| devops          | `status:ready` + не `human-only` + infra-задача      |
| doc-writer      | `type:docs` или передача                             |
| refactor        | `type:chore` + label `refactor`                      |

Какой именно implementer-агент берёт `status:ready` — определяется по
содержанию issue (пути файлов, стек) и `type:*`. Bridge в будущем будет
делать routing автоматически (см. [bridge-design.md](bridge-design.md)).

## Маппинг агент → skills

| Агент           | Skills                                                            |
| --------------- | ----------------------------------------------------------------- |
| triager         | —                                                                 |
| analyzer        | —                                                                 |
| go-developer    | golang-pro, git-workflow, git-commit                              |
| react-developer | vercel-react-best-practices, shadcn, ui-ux-pro-max, git-workflow, git-commit |
| python-ml       | git-workflow, git-commit                                          |
| devops          | git-workflow, git-commit, changelog-maintenance                   |
| doc-writer      | changelog-maintenance, git-workflow, git-commit                   |
| refactor        | simplify, git-workflow, git-commit                                |

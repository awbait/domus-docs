# Agents Workflow

Описание системы делегирования задач AI-агентам в проекте Domus.

**Статус:** Внедрено и в работе. Pilot пройден на `domus/focus-dashboard#112` (sec: uploads path traversal): задача прошла полный pipeline triage → analysis → approval → ready → go-developer в worktree → PR #114 → `status:review`. PR ожидает merge человеком, процесс отработан end-to-end.

## Файлы

- [pipeline.md](pipeline.md) — жизненный цикл задачи от issue до merge
- [agents.md](agents.md) — 8 ролей агентов, маппинг на labels и skills
- [labels.md](labels.md) — labels для Gitea Issues
- [agent-contract.md](agent-contract.md) — обязательный контракт поведения для всех агентов
- [subagent-template.md](subagent-template.md) — шаблон для нового subagent definition
- [migration-plan.md](migration-plan.md) — план переноса репо в `repos/` и `.worktrees/` (DONE 2026-04-07)
- [worktree-hooks.md](worktree-hooks.md) — реализация worktree-isolation через кастомные хуки в монорепо без git-корня
- [bridge-design.md](bridge-design.md) — архитектура Go bridge для webhooks Gitea (планируется, не реализовано)

## TL;DR

```
Issue (template) → triage → [analysis → approval] → ready
  → agent claim в worktree → код → PR (fixes #N) → review (human) → merge → done
```

Issue в Gitea — единственный источник истины. Все агенты работают через
labels и комментарии. Approval и merge — всегда человек.

## Стек

- **Gitea** (локальный self-hosted) — issues + код
- **tea CLI** + **gitea-mcp** — интерфейс агента к Gitea
- **Claude Code** — исполнитель агентов (subagents в `.claude/agents/`)
- **isolation: worktree** — изоляция через кастомные хуки `WorktreeCreate`/`WorktreeRemove` (корень `d:/projects/domus/` не git-репо, встроенная Claude Code изоляция не работает). Подробности — [worktree-hooks.md](worktree-hooks.md).
- **Go bridge** (позже) — webhooks Gitea → headless `claude --print --agent`

## Принципы

1. Issue — единственный контракт между человеком и агентом
2. Issue должен быть self-contained (агент не помнит прошлых разговоров)
3. Состояние = labels + комментарии (audit trail)
4. Один issue = одна ветка = один PR
5. Approval и merge — всегда человек
6. Проектная документация лежит в `repos/domus-docs/vault/<repo>/`, агенты её читают перед работой
7. Чистый role-based: каждый агент — узкая специализация (Go, React, Python, DevOps...)

## Структура

```
d:/projects/domus/
├── .claude/
│   ├── agents/                            ← 8 subagent definitions (canonical)
│   │   ├── triager.md
│   │   ├── analyzer.md
│   │   ├── go-developer.md
│   │   ├── react-developer.md
│   │   ├── python-ml.md
│   │   ├── devops.md
│   │   ├── doc-writer.md
│   │   ├── refactor.md
│   │   └── _archive/                      ← старые scope-агенты
│   ├── skills/                            ← canonical skills
│   ├── hooks/                             ← worktree hooks
│   │   ├── worktree-create.sh             ← создаёт worktree для агента
│   │   └── worktree-remove.sh             ← удаляет при остановке сессии
│   ├── settings.json                      ← canonical: env + hooks (этот файл читается Claude Code)
│   └── .next-worktree-target              ← одноразовый pointer-файл (gitignored)
├── .agents/skills/                        ← legacy source (не трогаем)
├── .worktrees/                            ← временные worktrees от агентов
├── repos/                                 ← все sub-репо здесь
│   ├── domovoy/
│   ├── focus-dashboard/
│   ├── focus-modules/
│   ├── domus-docs/
│   └── wakeword-training/
├── archive/                               ← мёртвые/legacy репо
├── agent-bridge/                          ← (планируется, не создан) Go bridge
├── settings.json                          ← legacy, не читается Claude Code (canonical — .claude/settings.json)
└── CLAUDE.md
```

## План внедрения

- [x] Согласовать список агентов и labels
- [x] Создать описание pipeline, contract, labels
- [x] Создать 8 subagent definitions
- [x] Архивировать старые scope-агенты (`focus-dashboard.md`, `domus-docs.md`)
- [x] Обновить корневой `CLAUDE.md`
- [x] **Миграция структуры:** репо перенесены в `repos/`, legacy в `archive/`
- [x] Обновить пути в файлах после миграции (см. [migration-plan.md](migration-plan.md))
- [x] Подключить `gitea-mcp` в user scope (`mcp__gitea__*` tools работают, агенты их используют)
- [x] Создать labels в Gitea (используются на боевых issue, например #112: `priority:p0`, `status:ready`, `type:bug`)
- [x] Issue templates (`.gitea/issue_template/task.md`, `.gitea/issue_template/bug.md` — PR #113 в focus-dashboard)
- [x] Кастомные worktree hooks для монорепо без git-корня (см. [worktree-hooks.md](worktree-hooks.md))
- [x] Pilot: одна реальная задача через analyzer → developer (`domus/focus-dashboard#112` → PR #114, `status:review`)
- [ ] Go bridge для webhooks (см. [bridge-design.md](bridge-design.md))
- [ ] Опционально: Agent Teams для исследовательских задач

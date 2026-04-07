# Migration Plan — переезд структуры

> **Статус: DONE (2026-04-07).** Миграция выполнена. Файл оставлен как историческая справка.
>
> Live-репо в `repos/` (5 шт), legacy в `archive/` (debug-toolbox, domovoy-control, refs),
> `.worktrees/` создаётся при первом запуске агента с `isolation: worktree`.

План переноса репозиториев в `repos/` и создания служебных папок.

## Целевая структура

```
d:/projects/domus/
├── .claude/                    ← (как есть)
├── .agents/                    ← (как есть, legacy skills source)
├── .obsidian/                  ← (как есть)
├── .worktrees/                 ← НОВАЯ: временные worktrees от агентов
├── repos/                      ← НОВАЯ: все живые репо здесь
│   ├── domovoy/
│   ├── focus-dashboard/
│   ├── focus-modules/
│   ├── domus-docs/
│   └── wakeword-training/
├── archive/                    ← НОВАЯ: legacy/dead репо (требует решения)
│   ├── domovoy-control/        (?)
│   ├── debug-toolbox/          (?)
│   └── refs/                   (?)
├── agent-bridge/               ← НОВАЯ: позже, Go bridge
├── settings.json               ← (как есть)
├── skills-lock.json            ← (как есть)
└── CLAUDE.md                   ← (обновить пути)
```

## Что переносим

| Из                        | В                                | Тип    |
| ------------------------- | -------------------------------- | ------ |
| `domovoy/`                | `repos/domovoy/`                 | live   |
| `focus-dashboard/`        | `repos/focus-dashboard/`         | live   |
| `focus-modules/`          | `repos/focus-modules/`           | live   |
| `domus-docs/`             | `repos/domus-docs/`              | live   |
| `wakeword-training/`      | `repos/wakeword-training/`       | live   |
| `domovoy-control/`        | `archive/domovoy-control/` ?     | TBD    |
| `debug-toolbox/`          | `archive/debug-toolbox/` ?       | TBD    |
| `refs/`                   | `archive/refs/` ?                | TBD    |

**Открытый вопрос:** что такое `domovoy-control`, `debug-toolbox`, `refs`? Если используются — оставить в `repos/`, если мёртвые — в `archive/`.

## Команды миграции

> ⚠️ Перед запуском убедись что:
> - Все Claude Code сессии закрыты
> - VSCode/IDE workspace закрыт
> - Все uncommitted changes закоммичены или закстешены в каждом репо
> - Сделан backup (хотя бы `git bundle create` каждого репо)

```bash
cd d:/projects/domus

# 1. Создать новые папки
mkdir -p repos archive .worktrees

# 2. Перенести живые репо
mv domovoy repos/
mv focus-dashboard repos/
mv focus-modules repos/
mv domus-docs repos/
mv wakeword-training repos/

# 3. Перенести (или удалить) мёртвые
mv domovoy-control archive/   # или rm -rf если уверен
mv debug-toolbox archive/
mv refs archive/

# 4. Проверить
ls repos/
ls archive/
```

## Что обновить после переноса

### Файлы

| Файл                                            | Что обновить                                                |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `CLAUDE.md`                                     | Все пути `domovoy/` → `repos/domovoy/` и т.д.               |
| `.claude/agents/*.md`                           | Пути в системных промптах агентов                           |
| `repos/domus-docs/vault/agents-workflow/*.md`         | Пути в pipeline.md, agents.md                               |
| `.vscode/settings.json` (если есть)             | Workspace folders                                           |
| `*.code-workspace` (если есть)                  | Workspace folders                                           |

### Команды для проверки путей в файлах

```bash
# Найти все упоминания старых путей
grep -rln "d:/projects/domus/domovoy" .claude/ domus-docs/ CLAUDE.md
grep -rln "domus/focus-dashboard" .claude/ domus-docs/ CLAUDE.md
grep -rln "domus/focus-modules" .claude/ domus-docs/ CLAUDE.md
grep -rln "domus/domus-docs" .claude/ domus-docs/ CLAUDE.md
grep -rln "domus/wakeword-training" .claude/ domus-docs/ CLAUDE.md
```

### Git remotes

Внутри каждого репо `.git/config` остаётся как был — git mv папки с `.git` внутри безопасен, remotes не ломаются.

### Обновить .gitignore корня (если есть)

```gitignore
.worktrees/
archive/
```

## Откат

Если что-то пошло не так:

```bash
cd d:/projects/domus
mv repos/domovoy ./
mv repos/focus-dashboard ./
mv repos/focus-modules ./
mv repos/domus-docs ./
mv repos/wakeword-training ./
rmdir repos
```

`.git/` папки внутри переносятся вместе с папкой, всё восстанавливается.

## Чек-лист

- [x] Уточнить статус `domovoy-control`, `debug-toolbox`, `refs` (мёртвые → `archive/`)
- [x] Закоммитить все uncommitted в каждом репо
- [x] Закрыть IDE и Claude Code сессии
- [x] Создать `repos/`, `archive/`, `.worktrees/`
- [x] Перенести live-репо в `repos/`
- [x] Перенести/удалить мёртвые
- [x] Обновить пути в `CLAUDE.md`
- [x] Обновить пути в `.claude/agents/*.md`
- [x] Обновить пути в `repos/domus-docs/vault/agents-workflow/*.md`
- [x] Открыть Claude Code в новой структуре, проверить что субагенты находятся
- [x] Запустить smoke test — pilot задача `domus/focus-dashboard#112` прошла полный pipeline до `status:review`
- [x] Обновить IDE workspace
- [x] Обновить `.gitignore` корня

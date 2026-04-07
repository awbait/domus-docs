# Pipeline — жизненный цикл задачи

## Роли

| Роль            | Кто          | Что делает                                 |
| --------------- | ------------ | ------------------------------------------ |
| **Author**      | Ты           | Создаёт issue, формулирует проблему        |
| **Triager**     | Агент или ты | Размечает labels, направляет в нужный поток |
| **Analyst**     | Агент или ты | Изучает код, пишет план, оценивает scope   |
| **Approver**    | Только ты    | Подтверждает план перед реализацией        |
| **Implementer** | Агент или ты | Пишет код, тесты, PR                       |
| **Reviewer**    | Только ты    | Review PR, merge                           |

Approver и Reviewer — **всегда человек**.

## Жизненный цикл

```
[1] CREATE        author создаёт issue по template
       │
       ▼
[2] TRIAGE        triager размечает type/priority
       │          status:triage → status:needs-analysis | status:ready
       │
       ├──── план в issue полный? ──► status:ready ────────┐
       │                                                    │
       ▼ нет                                                │
[3] ANALYSIS      analyzer берёт status:needs-analysis      │
       │          читает код + проектную доку               │
       │          пишет план в комментарий                  │
       │          → status:needs-approval                   │
       │                                                    │
       ▼                                                    │
[4] APPROVAL      ты читаешь план, отвечаешь:               │
       │          ок → status:ready                         │
       │          правки → analyzer дорабатывает            │
       │          отмена → close issue                      │
       │                                                    │
       ▼                                                    │
[5] PICKUP        implementer (go/react/python/devops)  ◄───┘
       │          берёт status:ready
       │          claim: label + assign + комментарий
       │
       ▼
[6] WORK          Кастомный хук WorktreeCreate создаёт worktree
       │          (встроенная Claude Code изоляция не работает —
       │          корень `d:/projects/domus/` не git-репо)
       │          implementer работает в .worktrees/<repo>-agents-<agent-name>/
       │          → branch → код → тесты → коммиты
       │          промежуточные комментарии в issue по милстоунам
       │
       ▼
[7] PR            tea pr create с "fixes #N" в body
       │          status:in-progress → status:review
       │
       ▼
[8] REVIEW        ты review PR (всегда человек)
       │          merge → issue закрывается автоматически
       │
       ▼
[9] CLEANUP       worktree удаляется автоматически через WorktreeRemove
                  хук при полной остановке агентской сессии (не сразу
                  после возврата результата — агент остаётся доступен
                  через SendMessage пока жив родительский Claude)
                  финальный комментарий "Итого: ..." в issue
```

## Передачи между агентами

Один issue может пройти через нескольких агентов:

```
triager → analyzer → [approval] → go-developer → [human review] → merge
                                 ↘ react-developer (если нужен фронт) ↗
```

Передача = смена `status:*` label + handoff-комментарий в issue. Контекст
не перетекает напрямую — следующий агент читает issue целиком и восстанавливает
картину из комментариев. См. [agent-contract.md](agent-contract.md) раздел
"Передача другому агенту".

## Worktree isolation

Implementer-агенты (go-developer, react-developer, python-ml, devops, refactor)
имеют `isolation: worktree` в frontmatter. Полное описание реализации —
в [worktree-hooks.md](worktree-hooks.md). Краткая суть:

**Проблема.** Корень `d:/projects/domus/` — НЕ git-репо (это контейнер для
монорепо). Поэтому встроенная worktree-isolation Claude Code, которая работает
от текущего проектного git-репо, в монорепо не применима — каждый агент должен
получить worktree в своём конкретном целевом репо (`repos/<name>/`).

**Решение — кастомные хуки.**

- `.claude/hooks/worktree-create.sh` — регистрируется как `WorktreeCreate`
- `.claude/hooks/worktree-remove.sh` — регистрируется как `WorktreeRemove`
- `.claude/settings.json` — canonical файл, в котором эти хуки зарегистрированы

**Pointer-file протокол.** Перед каждым `Agent`-вызовом с
`isolation: "worktree"` главный Claude **обязан** записать имя целевого репо в
одноразовый pointer-файл:

```bash
echo focus-dashboard > .claude/.next-worktree-target
```

Допустимые значения: `domovoy`, `focus-dashboard`, `focus-modules`,
`domus-docs`, `wakeword-training`.

**Что делает create-хук:**

1. Читает `.claude/.next-worktree-target` и удаляет его (одноразовый).
2. Делает `git fetch origin` в `repos/<repo>/`.
3. Создаёт ветку `agents/<agent-name>` от `origin/main`.
4. Делает `git worktree add .worktrees/<repo>-agents-<agent-name>/ agents/<agent-name>`.
5. Возвращает абсолютный Windows-путь worktree на stdout — субагент стартует там.

Агент дальше делает свою рабочую ветку поверх:
```bash
git fetch origin
git checkout -b <type>/<N>-<slug> origin/main
```

**Параллелизм.** Pointer-файл одноразовый → **параллельный запуск двух
worktree-агентов в разные репо в одном сообщении НЕ поддерживается**.
Только последовательные спауны. Один агент в одном репо — ок.

**`.env` файлы** не копируются в worktree (хук этим не занимается). Решение:
ручное копирование при необходимости — см. [agent-contract.md](agent-contract.md) шаг C.

**Cleanup.** `WorktreeRemove` срабатывает автоматически — но **только при
полной остановке агентской сессии** (после возврата результата агент остаётся
доступен через SendMessage и его worktree жив до закрытия родительской
сессии). Ручной фоллбек, если что-то застряло:

```bash
git worktree list                                          # посмотреть все
git worktree remove .worktrees/<repo>-agents-<agent-name>  # удалить конкретный
git worktree prune                                         # подмести мёртвые ссылки
```

## Resume протокол

Если сессия упала / сеть пропала / агент остановился на полпути:

1. `tea issues show <N>` → проверить статус и assignee
2. Если `status:in-progress` и assignee == себя → resume mode
3. `git fetch && git checkout <branch из последнего комментария claim>`
4. `git log --oneline -20` → понять что уже сделано
5. Прочитать **все** комментарии issue с момента claim
6. `git diff main...HEAD` → текущее состояние ветки
7. Комментарий "🔄 Resume после <причина>. Продолжаю с <шаг>"
8. Продолжать

Чтобы resume работал — **коммитить минимум каждые 30 минут** или после
каждого подзавершённого шага. WIP-коммиты допустимы (`wip: backend handler done`),
squash при merge.

## Bridge integration (позже)

После пилота поднимаем Go bridge, который слушает webhooks Gitea и автоматически
запускает агентов на смену labels. См. [bridge-design.md](bridge-design.md).

До bridge — все переходы вручную: ты говоришь "продолжи #42" в чат, агент
выполняет контракт.

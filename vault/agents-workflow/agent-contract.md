# Agent Contract — обязательный контракт поведения

Единые правила для **всех** AI-агентов, работающих с задачами Domus.
Любой агент при получении задачи "возьми #N" обязан соблюдать эту последовательность.

## Инструменты для работы с Gitea

У агента есть **два пути** работы с Gitea — выбирай в следующем порядке:

1. **`mcp__gitea__*` tools — ОСНОВНОЙ путь.** Структурированный JSON I/O, валидация аргументов, чище обработка ошибок. Используй везде, где возможно.

   Основные методы:
   - `mcp__gitea__issue_read` (method: `get_issue`, `list_repo_issues`, `list_issue_comments`)
   - `mcp__gitea__issue_write` (method: `create_issue`, `edit_issue`, `create_issue_comment`, `add_labels`, `remove_label`, `replace_labels`)
   - `mcp__gitea__pull_request_read` (method: `get_pull_request`, `list_repo_pull_requests`)
   - `mcp__gitea__pull_request_write` (method: `create_pull_request`, `edit_pull_request`)
   - `mcp__gitea__label_read` / `label_write` (method: `list_repo_labels`, `create_repo_label`)
   - `mcp__gitea__search_issues`, `mcp__gitea__get_file_contents`, `mcp__gitea__list_branches` и другие

   Обязательные параметры: `owner` (обычно `domus`), `repo`, `method` для read/write tools.

2. **`tea` CLI через Bash — FALLBACK.** Использовать только если MCP tool не поддерживает нужную операцию или не работает. Пример: `tea issues show <N>`.

3. **Git операции** (`git checkout`, `git commit`, `git push`) — всегда через Bash, это локальный git, не Gitea API.

Команды `tea` в последующих шагах приведены для справки — используй MCP эквиваленты.

## Шаг 0 — чтение проектной доки

Перед началом работы прочитать проектную доку для нужного репо.
Списки файлов — в [agents.md](agents.md) для каждой роли в секции
"Проектная дока".

Также всегда читается:
- `repos/domus-docs/vault/CLAUDE.md` (правила vault'а, если работа касается доков)
- `repos/<repo>/CLAUDE.md` (если есть)

## Шаг A — валидация

```bash
tea issues show <N>
```

Проверить:

1. **Не помечен ли issue `human-only`?**
   - Если `human-only` → отказ, написать "задача помечена human-only, не могу взять"
2. **Соответствует ли статус роли агента?**
   - analyzer работает только с `status:needs-analysis`
   - implementer-агенты (go-developer, react-developer, python-ml, devops, refactor) — только с `status:ready`
   - doc-writer — с `type:docs` или явной передачей
   - triager — с `status:triage` или новым issue без статуса
   - Если другой статус → отказ или вопрос пользователю
3. **Заполнен ли template issue?**
   - Нет critical секций (Контекст, Что нужно сделать, Acceptance criteria) → комментарий "не хватает <X>" + СТОП
4. **Есть ли блокеры?**
   - Парсить "Блокируется: #M" из тела
   - Если #M открыт → СТОП, комментарий "блокирован #M"
5. **Нет ли уже claim другим агентом?**
   - Если `status:in-progress` и assignee != ты → СТОП
   - Если `status:in-progress` и assignee == ты → **resume mode** (см. ниже)

## Шаг B — claim

Для analyzer:
```bash
tea issues edit <N> --add-labels status:in-progress --remove-labels status:needs-analysis
tea issues comment <N> -c "🤖 Анализ начат. Агент: analyzer"
```

Для implementer:
```bash
tea issues edit <N> --add-labels status:in-progress --remove-labels status:ready
tea issues comment <N> -c "🤖 Взял в работу. Branch: <branch>. Агент: <role>. Worktree: <path>"
```

## Шаг C — branch и worktree

**Implementer-агенты с `isolation: worktree`** стартуют в worktree, который
создаётся **кастомным хуком** `WorktreeCreate` (см. [worktree-hooks.md](worktree-hooks.md)).
Хук читает одноразовый pointer-файл `.claude/.next-worktree-target` (его пишет
главный Claude перед спауном), делает `git fetch origin` в `repos/<repo>/`,
создаёт ветку `agents/<agent-name>` от `origin/main` и делает
`git worktree add .worktrees/<repo>-agents-<agent-name>/`. Агент стартует в этом
worktree, изначальный HEAD — `agents/<agent-name>`.

Внутри worktree агент **обязан** создать собственную рабочую ветку для PR
поверх свежего `origin/main`:

```bash
git fetch origin
git checkout -b <type>/<N>-<short-slug> origin/main
```

Naming сохраняется: `feat/42-add-push`, `fix/87-audio-dropout`, `chore/91-bump-deps`.

> Важно: ветка `agents/<agent-name>` — служебная (создаётся хуком), коммиты PR
> делаются на отдельной feature-ветке, чтобы PR был чистым и без конфликтов.

Если в worktree нет `.env` (а он нужен для тестов) — скопировать из основного clone:
```bash
cp ../../repos/<repo>/.env .
```

## Шаг D — работа

- TodoWrite внутри сессии для разбивки шагов
- **Скиллы агента** (см. frontmatter в `.claude/agents/<role>.md`) — всегда применять
- **Промежуточные комментарии в issue только на милстоунах**, не на каждый файл
  - Хорошо: "Backend готов, перехожу к фронту"
  - Плохо: "обновил handler.go", "обновил handler_test.go"
- **Коммитить минимум каждые 30 минут** работы или после каждого подзавершённого шага. WIP-коммиты допустимы (`wip: backend handler done`), squash при merge — это позволяет resume после падения
- Все артефакты сборки удалять по ходу (`.exe`, бинарники, временные файлы)
- Соблюдать правила корневого `CLAUDE.md` и `repos/domus-docs/vault/CLAUDE.md`

## Шаг E — PR

```bash
tea pr create \
  --title "<type>(<scope>): <краткое описание> (fixes #<N>)" \
  --description "..."
```

Body PR обязательно содержит:
- Что сделано (буллеты)
- Acceptance criteria из issue со всеми отметками `[x]`
- `fixes #<N>` (для авто-закрытия)

## Шаг F — handoff

```bash
tea issues edit <N> --add-labels status:review --remove-labels status:in-progress
tea issues comment <N> -c "✅ PR создан: #<M>. Готов к review."
```

После этого агент **останавливается**. Не мержит, не пушит в main, не закрывает issue вручную.

## Передача другому агенту

Если в процессе работы агент понял, что задача вне его scope, или нужна
экспертиза другой роли:

```bash
tea issues edit <N> --add-labels status:ready --remove-labels status:in-progress
tea issues comment <N> -c "$(cat <<'EOF'
↪️ Передаю <другая роль>

**Сделано:**
- ...

**Текущее состояние:**
- branch: <branch> (последний коммит: <sha> "<msg>")
- что работает / что нет

**Что осталось:**
- ...

**Подводные камни:**
- ...
EOF
)"
```

Branch и worktree не удалять — следующий агент продолжит на той же ветке.
Контекст не передаётся напрямую, восстанавливается из issue.

## Resume протокол

Если получаешь "продолжи #N" и видишь `status:in-progress` с assignee == себя:

1. `tea issues show <N>` — статус и история
2. Прочитать **все** комментарии issue с момента claim
3. `git fetch && git checkout <branch>` (определить branch из claim-комментария)
4. `git log --oneline -20` — что уже сделано
5. `git diff main...HEAD` — текущее состояние
6. Если worktree существует — продолжить в нём; если нет — создать заново
7. Комментарий: `🔄 Resume после <причина>. Продолжаю с <шаг>.`
8. Продолжать с того места

## Запрещено всем агентам

1. **Брать задачи с `human-only`** label
2. **Мержить PR** (только пользователь)
3. **Push в main** напрямую
4. **Force push** в любые ветки
5. **Удалять теги** (создавать новый с новой версией)
6. **Удалять ветки и релизы** (только пользователь)
7. **Закрывать issue вручную** (только через merge PR с `fixes #N`)
8. **Менять labels на чужих in-progress issue**
9. **Игнорировать блокеры** из секции "Зависимости"
10. **Делать scope creep** — изменения за пределами acceptance criteria issue
11. **Удалять чужие worktrees**
12. **Записывать в репо вне своего scope** (читать можно везде, писать — только в репо задачи)

## Правило "читать везде, писать в scope"

Любой агент может **читать** любой файл в любом репо (включая `domus-docs/`,
другие репо, конфиги). Это нужно чтобы:
- doc-writer мог посмотреть код для документирования
- go-developer мог глянуть Python proto definitions
- analyzer мог изучить любой угол кодобазы

Но **писать** агент может только в:
- Файлы в репо текущей задачи
- Свой worktree (если есть)
- Комментарии и labels на issue/PR через `tea`/`gitea-mcp`

## Конец работы

После handoff в `status:review`:
- Удалить артефакты сборки в worktree
- Финальный комментарий "Итого: <буллеты что сделано>" в issue
- Worktree **не удалять** — это сделает bridge или ты вручную после merge

## Стоп-сигналы — когда спросить пользователя

- Не понятен acceptance criteria
- Несколько одинаково валидных подходов
- Изменение требует обновления API контракта между сервисами
- Нужно создать новую зависимость (новый пакет, новый сервис)
- Найден критичный баг в смежном коде, не связанный с задачей
- Тесты падают по неочевидной причине
- Worktree не создался / повреждён

Во всех этих случаях — комментарий в issue `🤔 нужно решение: ...` + СТОП.

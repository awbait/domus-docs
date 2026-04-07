# Worktree Hooks — изоляция агентов в монорепо без git-корня

Документ описывает реализацию `isolation: worktree` для implementer-агентов
в проекте Domus. Это техническая привязка pipeline'а к реальной механике
Claude Code.

## Проблема

Корень `d:/projects/domus/` — **НЕ git-репозиторий**. Это контейнер для пяти
независимых git-репо в `repos/` (см. [migration-plan.md](migration-plan.md)).

Встроенная worktree-isolation Claude Code предполагает, что текущий
проектный каталог сам является git-репо и от его HEAD создаётся worktree.
В монорепо без git-корня этого не происходит — Claude Code не знает,
**в каком из репо** агенту нужен worktree.

Также агентам нужны разные репо: `go-developer` в `domovoy`, `react-developer`
в `focus-dashboard`, `doc-writer` в `domus-docs` и т.д.

## Решение — кастомные хуки

Worktree создаёт и удаляет внешний bash-скрипт, зарегистрированный
через хук-механизм Claude Code.

**Файлы:**

- `.claude/hooks/worktree-create.sh` — создаёт worktree
- `.claude/hooks/worktree-remove.sh` — удаляет worktree
- `.claude/settings.json` — canonical settings, в нём регистрация хуков
  (`hooks.WorktreeCreate`, `hooks.WorktreeRemove` — массивы записей с
  `type: command`). Корневой `settings.json` в `d:/projects/domus/` Claude
  Code **не читает** — это legacy.

## Контракт хука (важно: реальный, не из доков)

Контракт хуков `WorktreeCreate`/`WorktreeRemove` задокументирован в Claude Code
неточно. Следующее проверено боевым тестом (v2026.04):

**stdin** — JSON:

```json
{
  "session_id": "...",
  "transcript_path": "...",
  "cwd": "...",
  "hook_event_name": "WorktreeCreate",
  "name": "<agent-name>"
}
```

В stdin **НЕТ** полей `branch_name` и `worktree_path` — несмотря на то, что
официальные доки их упоминают. Имя ветки и путь хук должен сгенерировать сам.

**stdout** — абсолютный путь worktree (одна строка). Claude Code использует
этот путь как cwd для запускаемого субагента.

**env** — переменная `CLAUDE_PROJECT_DIR` указывает на корень проекта
(`d:/projects/domus/`).

## Pointer-file протокол

Хук не получает имя целевого репо ни из stdin, ни из аргументов. Поэтому
используется одноразовый pointer-файл:

```bash
echo <repo-name> > .claude/.next-worktree-target
```

Допустимые значения:

- `domovoy`
- `focus-dashboard`
- `focus-modules`
- `domus-docs`
- `wakeword-training`

**Главный Claude обязан** записать pointer-файл **перед каждым** Agent-вызовом
с `isolation: "worktree"`. Хук читает файл и **удаляет его** (одноразовый —
чтобы случайные повторные спауны не уехали в неправильный репо).

Файл `.claude/.next-worktree-target` добавлен в `.gitignore`.

## Что делает create-хук пошагово

См. актуальную реализацию в `.claude/hooks/worktree-create.sh`. Ключевые шаги:

1. Парсит stdin JSON, забирает `name` (имя агента).
2. Читает `.claude/.next-worktree-target`, удаляет файл.
3. Валидирует имя репо (whitelist из 5 значений).
4. Заходит в `repos/<repo>/`, делает `git fetch origin`.
5. Создаёт служебную ветку `agents/<agent-name>` от `origin/main`
   (если ветка уже есть — пересоздаёт от свежего origin/main).
6. Делает `git worktree add .worktrees/<repo>-agents-<agent-name>/ agents/<agent-name>`.
7. Печатает на stdout абсолютный Windows-путь созданного worktree.

Агент получает этот путь как cwd. Дальше **сам** делает рабочую feature-ветку
для PR поверх свежего main:

```bash
git fetch origin
git checkout -b <type>/<N>-<slug> origin/main
```

Служебная `agents/<agent-name>` остаётся как технический корень worktree, но
коммиты PR идут в feature-ветку. Это позволяет переиспользовать worktree между
последовательными задачами агента, не загрязняя историю.

## Что делает remove-хук

См. `.claude/hooks/worktree-remove.sh`. Кратко:

1. Парсит stdin JSON.
2. Находит worktree по имени агента (`.worktrees/*-agents-<agent-name>/`).
3. Делает `git worktree remove --force` в соответствующем `repos/<repo>/`.
4. Опционально удаляет служебную ветку `agents/<agent-name>`, если на ней нет
   несмёрженных коммитов.

## Когда remove реально срабатывает

Это самая контринтуитивная часть. `WorktreeRemove` хук **не запускается** сразу
после того, как агент вернул результат вызвавшему его Claude. После возврата
результата агент остаётся доступен через `SendMessage` (можно продолжить
диалог), и его worktree должен быть жив.

**WorktreeRemove срабатывает только при полной остановке агентской сессии** —
когда родительский Claude закрывается или явно завершает агента. До этого
момента worktree остаётся на диске.

Практический вывод: после merge PR worktree, скорее всего, всё ещё жив, и его
надо чистить вручную при следующем запуске агента — либо ждать конца сессии.

## Известные ограничения

1. **Только последовательные спауны.** Pointer-файл одноразовый. Если в одном
   сообщении главный Claude хочет запустить, например, `go-developer` в
   `domovoy` и `react-developer` в `focus-dashboard` параллельно — второй
   pointer не успеет записаться, оба агента уедут в одно репо или второй
   получит ошибку. Решение: спаунить агентов **по одному**.

2. **Параллелизм в одно репо одним агентом** допустим, но запуск второй копии
   того же агента вторым окажется на той же служебной ветке `agents/<name>` и
   получит конфликт worktree.

3. **`.env` файлы** хук не копирует. Если тесты требуют `.env`, агент сам
   делает `cp ../../repos/<repo>/.env .` (см. [agent-contract.md](agent-contract.md)
   шаг C).

4. **Cleanup отложенный.** См. предыдущий раздел — worktree после возврата
   результата может жить долго.

## Ручная чистка

Если что-то застряло — сломалась ветка, остался мёртвый worktree, нужен
форсированный сброс:

```bash
cd repos/<repo>

# посмотреть все worktrees этого репо
git worktree list

# удалить конкретный
git worktree remove --force ../../.worktrees/<repo>-agents-<agent-name>

# подмести битые ссылки
git worktree prune

# удалить служебную ветку, если она больше не нужна
git branch -D agents/<agent-name>
```

## Ссылки

- Реализация хуков: `.claude/hooks/worktree-create.sh`, `.claude/hooks/worktree-remove.sh`
- Регистрация: `.claude/settings.json`
- Pipeline-секция Worktree isolation: [pipeline.md](pipeline.md)
- Шаг C в контракте агента: [agent-contract.md](agent-contract.md)

# Admin New — Design System

## Layout

Центрированный контейнер по центру экрана. Страница НЕ занимает всю ширину.

```
┌─────────────────────────────────────────────────────────┐
│                      background                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │  ┌──────────┐  ┌────────────────────────────┐   │   │
│   │  │ Sidebar  │  │       Content Area         │   │   │
│   │  │          │  │                            │   │   │
│   │  │ Manage   │  │  Section Title             │   │   │
│   │  │  Users   │  │  ┌──────────────────────┐  │   │   │
│   │  │  Links   │  │  │  Panel content       │  │   │   │
│   │  │  Boards  │  │  │                      │  │   │   │
│   │  │          │  │  └──────────────────────┘  │   │   │
│   │  │ Settings │  │                            │   │   │
│   │  │  General │  │                            │   │   │
│   │  │  Theme   │  │                            │   │   │
│   │  │  Auth    │  │                            │   │   │
│   │  │          │  │                            │   │   │
│   │  │ System   │  │                            │   │   │
│   │  │  Modules │  │                            │   │   │
│   │  │  Monitor │  │                            │   │   │
│   │  │          │  │                            │   │   │
│   │  │ ← Back   │  │                            │   │   │
│   │  └──────────┘  └────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Контейнер

- **max-width:** `max-w-6xl` (1152px)
- **Центрирование:** `mx-auto`
- **Отступы:** `px-4 py-6` на десктопе, `px-3 py-4` на мобилке
- **min-height:** `min-h-screen`
- **Фон:** `bg-background` (основной фон страницы)

### Внутренний блок (sidebar + content)

- **border-radius:** `rounded-2xl`
- **Фон:** `bg-card`
- **Бордер:** `border`
- **Тень:** `shadow-sm`
- **overflow:** `hidden`
- **min-height:** `min-h-[calc(100vh-3rem)]`

---

## Sidebar

### Desktop (≥1024px)

- **Ширина:** 240px фиксированная
- **Фон:** прозрачный (наследует от card)
- **Правая граница:** `border-r`
- **Padding:** `p-3`
- **Sticky:** `sticky top-0 h-screen overflow-y-auto`

### Tablet (768–1023px)

- **Ширина:** 56px (только иконки)
- **Tooltip** при наведении на иконки
- **Кнопка expand** в header для раскрытия в overlay

### Mobile (<768px)

- **Сайдбар скрыт** по умолчанию
- **Sheet (drawer)** открывается по кнопке-гамбургеру в header
- Header фиксированный сверху с названием секции и hamburger

---

## Структура сайдбара

### Header
- Иконка Settings + "Admin" текст
- На tablet: только иконка

### Группы навигации

**Manage** (не сворачиваемая):
- Users — `UserIcon`
- Links — `Link04Icon`
- Boards — `GridViewIcon`

**Settings** (сворачиваемая, default open):
- General — `Settings01Icon`
- Appearance — `PaintBoardIcon`
- Auth — `GlobeIcon`

**System** (не сворачиваемая):
- Modules — `Package01Icon`
- Resources — `ActivityIcon`

### Footer
- Кнопка "Back" — `ArrowLeft01Icon`, navigate('/')

### Состояния элементов

- **Default:** `text-muted-foreground hover:bg-accent/50 hover:text-foreground`
- **Active:** `bg-primary/10 text-primary font-medium`
- **Group label:** `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60`

---

## Typography (Inter)

| Элемент             | Size   | Weight     | Line-height | Класс Tailwind                          |
|---------------------|--------|------------|-------------|------------------------------------------|
| Page title (header) | 16px   | semibold   | 1.5         | `text-base font-semibold`                |
| Group label         | 11px   | semibold   | 1.4         | `text-[11px] font-semibold uppercase tracking-wider` |
| Nav item            | 13px   | medium     | 1.5         | `text-[13px] font-medium`               |
| Section title (h2)  | 18px   | semibold   | 1.4         | `text-lg font-semibold`                  |
| Section desc        | 13px   | normal     | 1.6         | `text-[13px] text-muted-foreground`      |
| Body text           | 14px   | normal     | 1.6         | `text-sm`                                |
| Label               | 13px   | medium     | 1.5         | `text-[13px] font-medium`               |
| Small / caption     | 12px   | normal     | 1.5         | `text-xs`                                |
| Mono (slug, url)    | 12px   | normal     | 1.5         | `text-xs font-mono`                     |

**Шрифт:** Inter Variable (уже подключен через `@fontsource-variable/inter`).

---

## Цветовая схема

### Темы

Используется существующая система CSS-переменных (oklch). Класс `.dark` на `<html>`.

- **По умолчанию:** dark theme
- **Переключение:** через admin settings (Appearance)

### Семантические цвета

| Назначение            | Light                  | Dark                    |
|----------------------|------------------------|-------------------------|
| Page bg              | `--background`         | `--background`          |
| Card bg              | `--card`               | `--card`                |
| Text primary         | `--foreground`         | `--foreground`          |
| Text secondary       | `--muted-foreground`   | `--muted-foreground`    |
| Accent bg            | `--primary` @ 10%      | `--primary` @ 10%       |
| Accent text          | `--primary`            | `--primary`             |
| Border               | `--border`             | `--border`              |
| Destructive          | `--destructive`        | `--destructive`         |

### Акцентный цвет

Система из `core/accent.tsx`. Функция `applyAccentHue(hue)` устанавливает:
- `--primary`, `--primary-foreground`
- `--ring`, `--accent`, `--accent-foreground`
- `--sidebar-primary`, `--sidebar-ring`
- `--chart-1`

Пресеты: Blue (250), Emerald (160), Violet (295), Amber (80), Rose (10).

Всё UI использует `text-primary`, `bg-primary/10` и т.д. — автоматически подхватывает hue.

---

## Адаптивность

### Breakpoints (Tailwind defaults)

| Breakpoint | Min width | Название |
|------------|-----------|----------|
| sm         | 640px     | Mobile+  |
| md         | 768px     | Tablet   |
| lg         | 1024px    | Desktop  |
| xl         | 1280px    | Wide     |

### Desktop (≥1024px)
- Sidebar 240px + Content (flex-1)
- Контейнер max-w-6xl mx-auto
- Padding: p-6
- Content panels: max-w-2xl (users, links, boards, settings) / auto (resources)

### Tablet (768–1023px)
- Sidebar 56px (icon-only) + Content (flex-1)
- Контейнер full-width с px-4
- Content panels: max-w-2xl

### Mobile (<768px)
- Sidebar → Sheet (slide from left)
- Header bar сверху: hamburger + section name + back
- Контейнер full-width с px-3
- Таблицы → карточки (уже реализовано в панелях)
- Content panels: full-width

---

## Иконки

**Библиотека:** `@hugeicons/react` + `@hugeicons/core-free-icons`

**Использование:**
```tsx
import { UserIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

<HugeiconsIcon icon={UserIcon} size={18} />
```

### Размеры иконок

| Контекст       | Size |
|----------------|------|
| Nav item       | 18   |
| Group label    | 14   |
| Header icon    | 18   |
| Button icon    | 14   |
| Action icon    | 12   |

---

## Компоненты

### Nav Item
```
┌──────────────────────────────┐
│ [icon 18px]  Label text      │  height: 36px
└──────────────────────────────┘   border-radius: 8px (rounded-lg)
                                   padding: 0 12px
```

### Collapsible Group
```
  GROUP LABEL  [chevron ▼]
  ├─ Nav Item
  ├─ Nav Item
  └─ Nav Item
```
Chevron вращается при collapse. Label + chevron кликабельны.

### Mobile Header
```
┌─────────────────────────────────────┐
│ [☰]  Section Name      [← Back]    │  height: 48px
└─────────────────────────────────────┘   border-bottom
```

---

## Секции контента

Каждая секция рендерит существующий Panel-компонент:

| Section             | Component            | Max width |
|---------------------|----------------------|-----------|
| users               | UsersPanel           | max-w-2xl |
| links               | LinksPanel           | max-w-2xl |
| boards              | BoardsPanel          | max-w-2xl |
| settings-general    | SettingsGeneral      | max-w-lg  |
| settings-appearance | SettingsAppearance   | max-w-lg  |
| settings-auth       | SettingsAuth         | max-w-lg  |
| modules             | ModulesPanel         | max-w-2xl |
| resources           | ResourcesPanel       | auto      |

Content area padding: `p-6` desktop, `p-4` tablet, `p-3` mobile.

---

## Анимации и переходы

- Sidebar nav hover: `transition-colors duration-150`
- Collapsible: CSS transition on height (через Radix Collapsible)
- Sheet (mobile): slide-in from left, 200ms ease
- Active indicator: мгновенная смена (без анимации)
- Content switch: без анимации (моментальная замена)

---

## Файловая структура

```
frontend/src/
  pages/
    AdminNewPage.tsx                    ← главная страница, layout + routing панелей
  components/
    admin-new/
      AdminNewSidebar.tsx               ← сайдбар (desktop full + tablet icon-only)
      AdminNewMobileHeader.tsx          ← мобильный fixed header + Sheet drawer
      panels/
        UsersPanel.tsx                  ← карточная сетка пользователей
        LinksPanel.tsx                  ← список ссылок с hover-actions
        BoardsPanel.tsx                 ← карточная сетка досок с gradient header
        SettingsPanel.tsx               ← General + Appearance + Auth (card-based fields)
        ModulesPanel.tsx                ← карточки модулей с toggle + community modal
        ResourcesPanel.tsx              ← circular gauge + stacked bar ресурсы
```

## Ключевые дизайн-решения по панелям

### UsersPanel
- **Grid sm:grid-cols-2** — карточки вместо таблицы
- Аватар + имя + role badge (цветной: owner=primary, resident=emerald, guest=muted)
- Email и PIN-статус с иконками (Mail01, ShieldKey)
- Actions в dashed border-t: Change PIN / Reset PIN
- Create dialog: radio-style role selector (cards с radio dot)

### LinksPanel
- **Список** карточек (не сетка) — удобнее для URL
- Каждая карточка: icon-box (40x40, primary/8 bg) + name + badge mode + mono URL
- Actions (edit/delete) **opacity-0 → group-hover:opacity-100**
- Dialog: mode selector как grid-cols-2 buttons

### BoardsPanel
- **Grid sm:grid-cols-2 lg:grid-cols-3** — компактные карточки
- Каждая карточка: gradient header bar (from-primary/8 to-primary/3) с иконкой
- Имя + slug (как кликабельная ссылка)
- Actions: Edit / Layout / Delete в ряд

### SettingsPanel (все 3)
- Общие утилиты: SettingsSection (icon + title + desc), FieldRow (card с label + input), ToggleRow (card с switch), SaveBar
- **General:** card-based fields (dashboard_name, timezone, wall_timeout, language)
- **Appearance:** AccentPicker + live preview (primary button, soft, outline, circle)
- **Auth:** master toggle card + expandable OIDC fields с border-l-2 indent

### ModulesPanel
- Header с icon-box + title
- Collapsible sections (Built-in / Third-party) со стрелками
- Каждый модуль = карточка rounded-xl с: emoji icon, info, controls (homepage/settings/delete), Switch toggle справа
- Disabled modules: opacity-50
- Empty state: icon circle + text
- Community + Updates modals: без изменений (уже хороший дизайн)

### ResourcesPanel
- **Circular gauge** (SVG) вместо большого % числа — визуально показывает заполненность
- Цвет gauge: green (<60%), amber (60-85%), red (>85%)
- Stacked bar тоньше (h-2.5 вместо h-4)
- Legend items компактнее (h-2.5 dots)
- Grid 1 → lg:2 columns

# Focus Dashboard — Design System

> Этот документ описывает дизайн-систему проекта Focus Dashboard.
> Предназначен для разработчиков (людей и AI-агентов), работающих над фронтендом.

---

## 1. Стек и зависимости

| Категория | Технология | Версия |
|-----------|-----------|--------|
| UI-фреймворк | React | 19 |
| Сборка | Vite | 6 |
| Стилизация | Tailwind CSS | 4 |
| Компоненты | shadcn/ui (стиль `radix-maia`, base color `mauve`) | 4 |
| Иконки | lucide-react | 0.475+ |
| Анимации | Framer Motion | 12 |
| Грид-дашборд | react-grid-layout | 1.5 |
| Шрифты | Inter Variable, Outfit, JetBrains Mono | — |
| Утилиты | class-variance-authority, tailwind-merge, clsx | — |

**Пакетный менеджер:** Bun

---

## 2. Цветовая система

### Цветовое пространство

Все цвета определены в **OKLCH** — перцептуально-однородное пространство. Это позволяет менять hue акцента без потери воспринимаемой яркости.

Формат: `oklch(lightness chroma hue)`

### Семантические токены

Цвета заданы CSS-переменными в `src/styles/globals.css` и маппятся на Tailwind через `@theme inline`.

| Токен (CSS var) | Tailwind-класс | Назначение |
|----------------|----------------|------------|
| `--background` | `bg-background` | Фон страницы |
| `--foreground` | `text-foreground` | Основной текст |
| `--card` | `bg-card` | Фон карточек |
| `--card-foreground` | `text-card-foreground` | Текст на карточках |
| `--primary` | `bg-primary`, `text-primary` | Основной акцент (кнопки, ссылки) |
| `--primary-foreground` | `text-primary-foreground` | Текст на primary-фоне |
| `--secondary` | `bg-secondary` | Вторичный фон |
| `--muted` | `bg-muted` | Приглушённый фон |
| `--muted-foreground` | `text-muted-foreground` | Вспомогательный текст |
| `--accent` | `bg-accent` | Hover-фон, активные элементы |
| `--destructive` | `bg-destructive` | Ошибки, удаление |
| `--border` | `border-border` | Границы |
| `--input` | `bg-input` | Фон полей ввода |
| `--ring` | `ring-ring` | Focus-кольцо |

Sidebar-токены (`--sidebar-*`) повторяют структуру, но для боковой панели.

### Значения (Dark Mode — основной)

```
background:      oklch(0.13 0.005 285)   — почти чёрный с синим подтоном
foreground:      oklch(0.97 0 0)          — почти белый
card:            oklch(0.17 0.008 285)    — чуть светлее фона
primary:         oklch(0.65 0.2 {hue})    — яркий акцент (hue динамический!)
secondary:       oklch(0.22 0.01 285)     — тёмно-серый
muted:           oklch(0.22 0.01 285)     — совпадает с secondary
muted-foreground:oklch(0.55 0.015 285)   — приглушённый текст
accent:          oklch(0.25 0.03 {hue})   — тёмный вариант акцента
border:          oklch(0.25 0.01 285)     — едва заметная граница
destructive:     oklch(0.65 0.2 25)       — оранжево-красный
```

### Значения (Light Mode)

```
background:      oklch(0.98 0.002 285)
foreground:      oklch(0.15 0.01 285)
card:            oklch(1 0 0)             — чисто белый
primary:         oklch(0.65 0.2 {hue})    — тот же акцент
secondary:       oklch(0.95 0.003 285)
muted-foreground:oklch(0.45 0.015 285)
border:          oklch(0.91 0.005 285)
destructive:     oklch(0.55 0.22 25)
```

### Динамический акцент

Пользователь может выбрать цветовой акцент. Меняется **только hue** в oklch, сохраняя lightness и chroma:

| Пресет | Hue |
|--------|-----|
| Blue (default) | 250 |
| Emerald | 160 |
| Violet | 295 |
| Amber | 80 |
| Rose | 10 |

Механизм: `AccentProvider` (React Context) + inline-скрипт в `<head>` для предотвращения flash.

При смене акцента обновляются: `--primary`, `--ring`, `--accent`, `--sidebar-primary`, `--sidebar-ring`, `--chart-1`.

Хранение: `localStorage['focus-accent-hue']`

---

## 3. Типографика

### Шрифты

| Роль | Шрифт | Загрузка | Назначение |
|------|-------|----------|------------|
| **Sans (body)** | Inter Variable | `@fontsource-variable/inter` (npm) | Весь текст интерфейса |
| **Display** | Outfit (300–800) | Google Fonts | Заголовки, акцентные числа |
| **Mono** | JetBrains Mono (400, 500, 700) | Google Fonts | Код, PIN-ввод, технические значения |

CSS-переменные:
```css
--font-sans-preset: 'Inter Variable';
--font-mono-preset: ui-monospace;
```

### Размеры (стандартные Tailwind)

| Класс | Размер | Назначение |
|-------|--------|------------|
| `text-xs` | 12px | Метки, бейджи |
| `text-sm` | 14px | Вторичный текст, пункты меню |
| `text-base` | 16px | Основной текст |
| `text-lg` | 18px | Подзаголовки |
| `text-xl` | 20px | Заголовки секций |
| `text-2xl` | 24px | Заголовки страниц |
| `text-3xl`–`text-5xl` | 30–48px | Крупные числа в виджетах |

### Начертания

- `font-normal` (400) — обычный текст
- `font-medium` (500) — пункты меню, метки
- `font-semibold` (600) — заголовки карточек
- `font-bold` (700) — акцентные значения

---

## 4. Скругления

Базовый радиус: `--radius: 0.625rem` (10px)

| Токен | Формула | ~px | Применение |
|-------|---------|-----|------------|
| `rounded-sm` | `calc(var(--radius) - 4px)` | 6px | Мелкие элементы (бейджи) |
| `rounded-md` | `calc(var(--radius) - 2px)` | 8px | Кнопки (sm), инпуты |
| `rounded-lg` | `var(--radius)` | 10px | Карточки, диалоги |
| `rounded-xl` | `calc(var(--radius) + 4px)` | 14px | Боковое меню, мобильная навигация |
| `rounded-4xl` | — | pill | Кнопки (default), бейджи, инпуты |

Кнопки и бейджи по умолчанию `rounded-4xl` (pill-форма).

---

## 5. Компоненты (shadcn/ui)

Конфигурация: `components.json` → стиль `radix-maia`, base color `mauve`.

### Установленные компоненты

| Компонент | Файл | Варианты |
|-----------|------|----------|
| **Button** | `ui/button.tsx` | `default`, `outline`, `secondary`, `ghost`, `destructive`, `link` |
| **Badge** | `ui/badge.tsx` | `default`, `secondary`, `destructive`, `outline`, `ghost`, `link` |
| **Card** | `ui/card.tsx` | Header, Title, Description, Content, Footer, Action |
| **Dialog** | `ui/dialog.tsx` | Модальные окна |
| **Input** | `ui/input.tsx` | Rounded-4xl, h-9 |
| **InputOTP** | `ui/input-otp.tsx` | 5-значный PIN |
| **Label** | `ui/label.tsx` | — |
| **Popover** | `ui/popover.tsx` | — |
| **ScrollArea** | `ui/scroll-area.tsx` | — |
| **Separator** | `ui/separator.tsx` | — |
| **Switch** | `ui/switch.tsx` | — |
| **Tabs** | `ui/tabs.tsx` | — |
| **Toast** | `ui/toast.tsx` | — |
| **Tooltip** | `ui/tooltip.tsx` | — |
| **Avatar** | `ui/avatar.tsx` | — |

### Размеры кнопок

| Size | Высота | Паддинги | Применение |
|------|--------|----------|------------|
| `xs` | h-6 (24px) | px-2.5 | Компактные действия |
| `sm` | h-8 (32px) | px-3 | Вторичные действия |
| `default` | h-9 (36px) | px-3 | Основные действия |
| `lg` | h-10 (40px) | px-4 | Крупные CTA |
| `icon` | 36×36 | — | Иконка без текста |
| `icon-xs` | 24×24 | — | Мелкая иконка |
| `icon-sm` | 32×32 | — | — |
| `icon-lg` | 40×40 | — | — |

### Паттерн создания компонента

```tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const myVariants = cva("base-classes", {
  variants: { variant: { ... }, size: { ... } },
  defaultVariants: { variant: "default", size: "default" },
})

function MyComponent({ className, variant, size, ...props }) {
  return <div className={cn(myVariants({ variant, size, className }))} {...props} />
}
```

---

## 6. Иконки

**Библиотека:** `lucide-react`

**Размеры (конвенция проекта):**

| Контекст | Класс | Пиксели |
|----------|-------|---------|
| Внутри текста, мелкие кнопки | `h-3.5 w-3.5` | 14px |
| Внутри кнопок, пункты меню | `h-4 w-4` | 16px |
| Навигация, действия | `h-5 w-5` | 20px |
| Крупные акценты | `h-6 w-6`+ | 24px+ |

**Компонент-обёртка:** `LucideIcon` — принимает `name: string` (kebab-case), конвертирует в PascalCase и рендерит.

**Иконки для бордов** (curated set): `layout-grid`, `home`, `monitor`, `tv`, `sofa`, `bed-double`, `cooking-pot`, `utensils`, `bath`, `baby`, `cat`, `dog`, `music`, `gamepad-2`, `dumbbell`, `heart-pulse`, `sun`, `moon`, `cloud`, `thermometer`, `car`, `bike`, `tree-pine`, `flower-2`, `camera`, `book-open`, `calendar`, `clock`, `wifi`, `server`, `hard-drive`, `shield`, `star`, `zap`, `flame`, `droplets`

---

## 7. Сетка дашборда

### Конфигурация react-grid-layout

| Параметр | Desktop | Mobile |
|----------|---------|--------|
| Колонки | 12 | 4 (visible) |
| Высота строки | 120px | 80px |
| Отступы (margin) | [12, 12]px | [8, 8]px |
| Drag/Resize | В edit-mode | В edit-mode (горизонтальный скролл) |

### Брейкпоинт

**Единственный брейкпоинт:** `768px`
- `< 768px` → Mobile (нижняя панель, 3 слайда с горизонтальным свайпом)
- `>= 768px` → Desktop (боковая панель, полная сетка)

### Стили грида (globals.css)

- Переходы: `all 200ms ease` (left, top, width, height)
- При перетаскивании: `opacity: 0.9`, `scale: 1.02`, `z-index: 10`
- Placeholder: `--primary` с 8% opacity, dashed border с 30% opacity
- Resize handle: скрыт по умолчанию, появляется при hover в edit-mode
- Класс `no-grid-transition` подавляет все переходы (при переключении edit-mode)

---

## 8. Навигация

### Desktop: Боковая панель (SideMenu)

- Фиксированная, слева, вертикально по центру (`top-1/2 -translate-y-1/2`)
- Скрыта за пределами экрана (`-translate-x-[36px]`), выезжает при hover
- Может быть закреплена (Pin/Unpin)
- Фон: `bg-background/90 backdrop-blur`, скруглённые углы справа
- Ширина: 56px
- Кнопки: 40×40px, `rounded-lg`, с Tooltip справа

### Mobile: Нижняя панель

- Фиксированная, `bottom-2`, горизонтально по центру
- `bg-background/90 backdrop-blur`, `rounded-xl`
- Те же иконки, но горизонтально
- Разделители: `border-l` вместо `border-t`
- Hover-стили заменены на `active:bg-accent`

### Состояния навигационных кнопок

| Состояние | Стиль |
|-----------|-------|
| Обычное | `text-muted-foreground` |
| Hover (desktop) | `hover:bg-accent hover:text-foreground` |
| Active/tap (mobile) | `active:bg-accent` |
| Текущая страница | `bg-primary/15 text-primary` |
| Disabled | `text-muted-foreground/30 cursor-not-allowed` |

---

## 9. Анимации и переходы

### Библиотека: Framer Motion

Используется для:
- Переходы между шагами Setup-визарда
- Появление/исчезновение элементов
- Плавные layout-переходы

### CSS-переходы (конвенция)

| Длительность | Применение |
|-------------|------------|
| 100ms | Placeholder грида |
| 200ms | Hover-состояния, цвет, тень, грид-элементы, SideMenu |
| 300ms | Layout-переходы |

Easing: `ease` (по умолчанию)

### Правила

- Использовать `transform` и `opacity` для анимаций (GPU-ускорение)
- Уважать `prefers-reduced-motion`
- Не анимировать `width`/`height` напрямую (кроме react-grid-layout)
- Hover-эффекты: только изменение цвета/opacity, **не scale** (чтобы не сдвигать layout)

---

## 10. Паттерны и конвенции

### Именование файлов

| Тип | Пример | Формат |
|-----|--------|--------|
| Страницы | `BoardPage.tsx` | PascalCase |
| Компоненты UI | `button.tsx` | kebab-case (shadcn convention) |
| Кастомные компоненты | `SideMenu.tsx` | PascalCase |
| Хуки | `use-toast.ts` | kebab-case с `use-` |
| API | `boards.ts` | kebab-case |
| Контексты | `AuthContext.tsx` | PascalCase |

### Импорты

Алиасы:
- `@/components` → `src/components`
- `@/components/ui` → `src/components/ui`
- `@/lib` → `src/lib`
- `@/hooks` → `src/hooks`
- `@/core` → `src/core`
- `@/api` → `src/api`
- `@/modules` → `src/modules`

### State management

- **Глобальный:** React Context (`AuthContext`, `AccentContext`)
- **Серверный:** fetch + useState/useEffect (нет react-query)
- **Локальный:** useState, useRef
- **Персистентный:** localStorage (акцент, пиннинг меню)

### Утилита cn()

Все className формируются через `cn()` из `@/lib/utils` (clsx + tailwind-merge).

```tsx
className={cn(
  'base-classes',
  condition && 'conditional-classes',
  className  // пробрасываемый извне
)}
```

### data-атрибуты

shadcn-компоненты используют `data-slot` для стилевых хуков:
- `data-slot="button"`
- `data-slot="badge"`
- `data-variant="default"`, `data-size="sm"` и т.д.

---

## 11. Виджеты (модульная система)

### Встроенные модули

| Модуль | ID | Описание |
|--------|----|----------|
| Clock | `clock` | Часы с датой |
| Pill Tracker | `pill-tracker` | Трекер приёма лекарств |
| Domovoy Control | `domovoy-control` | Управление голосовым ассистентом |

### Динамические модули (ZIP)

Загружаются через Admin → Modules → Upload. Бэкенд запускается автоматически.

Фронтенд модуля подключается как **web component** через `DynamicWidget.tsx`.

### Паттерн виджета

```
src/modules/{name}/
├── Widget.tsx        — React-компонент виджета
├── Settings.tsx      — (опционально) компонент настроек
└── index.ts          — экспорт
```

Регистрация в `src/core/widgets.tsx`:
```tsx
const WIDGET_REGISTRY = {
  'clock': { component: ClockWidget, name: 'Часы' },
  'pill-tracker': { component: PillWidget, name: 'Pill Tracker' },
}
```

---

## 12. Темы и адаптивность

### Dark Mode

- **По умолчанию:** всегда `class="dark"` на `<html>`
- Custom variant: `@custom-variant dark (&:where(.dark, .dark *))`
- Light mode токены определены в `:root`, но UI запускается в dark
- Планируется переключение light/dark (токены уже подготовлены)

### PWA

- `manifest.json` в `/public/`
- Theme color: `#08080f`
- Язык: `ru`

### Responsive подход

- **Mobile-first:** нет. Desktop — основной, mobile — адаптация
- Единственный брейкпоинт: `768px`
- JS-detection: `window.innerWidth < 768` + resize listener
- Условный рендеринг: разные компоненты для mobile/desktop (не CSS media queries)

---

## 13. Правила для AI-агентов

### При добавлении нового компонента:

1. Проверь, есть ли подходящий компонент в shadcn/ui. Если да — используй `bunx --bun shadcn@latest add <name>`
2. Стилизуй через Tailwind-классы и CSS-переменные проекта. **Никогда не хардкодь цвета** (`bg-blue-500`), используй семантические токены (`bg-primary`)
3. Используй `cn()` для всех className
4. Иконки — только `lucide-react`
5. Анимации — Framer Motion для JS, Tailwind transitions для CSS

### При добавлении нового виджета:

1. Создай папку в `src/modules/{name}/`
2. Зарегистрируй в `src/core/widgets.tsx`
3. Виджет должен работать в разных размерах грида (1×1, 2×1, 2×2 и т.д.)
4. Используй `bg-card` как фон, `rounded-lg` для скругления

### Запрещено:

- Использовать эмодзи как иконки
- Хардкодить цвета (hex/rgb/oklch) в компонентах
- Добавлять новые CSS-файлы (всё в `globals.css` или Tailwind)
- Использовать `!important` (кроме grid-transition override)
- Менять базовые shadcn-компоненты без необходимости
- Использовать inline styles (кроме динамических значений вроде grid positions)

### Контраст и доступность:

- Минимальный контраст: 4.5:1 (WCAG AA)
- Focus-кольцо: `focus-visible:ring-ring/50` (уже в базовых компонентах)
- Touch targets: минимум 40×40px (в проекте используется 40×40)
- `aria-label` на всех icon-only кнопках
- Keyboard navigation через Radix UI primitives

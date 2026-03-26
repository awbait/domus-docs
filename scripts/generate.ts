import { fromVault } from 'fumadocs-obsidian';
import fs from 'node:fs/promises';

// Очищаем генерируемые папки перед каждым запуском
await fs.rm('./content/docs/domovoy', { recursive: true, force: true });
await fs.rm('./content/docs/focus-dashboard', { recursive: true, force: true });

// Корневые файлы content/docs/ (не из vault)
await fs.mkdir('./content/docs', { recursive: true });

await fs.writeFile(
  './content/docs/meta.json',
  JSON.stringify({ title: 'Domus', pages: ['index', 'domovoy', 'focus-dashboard'] }, null, 2),
);

await fs.writeFile(
  './content/docs/index.mdx',
  `---
title: Введение
description: Документация по проекту Domus
---

Документация по проекту **Domus** — локальный голосовой ассистент и персональный дашборд.

<Cards>
  <Card title="Домовой" href="/docs/domovoy" description="Голосовой ассистент: VAD → STT → LLM → TTS" />
  <Card title="Focus Dashboard" href="/docs/focus-dashboard" description="Домашний дашборд с модульной архитектурой" />
</Cards>
`,
);

await fromVault({
  dir: './vault/domovoy',
  out: {
    contentDir: './content/docs/domovoy',
    publicDir: './public',
  },
  include: ['**/*', '!tasks.md'],
});

await fromVault({
  dir: './vault/focus-dashboard',
  out: {
    contentDir: './content/docs/focus-dashboard',
    publicDir: './public',
  },
  include: ['**/*', '!tasks.md'],
});

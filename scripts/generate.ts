import { fromVault } from 'fumadocs-obsidian';
import fs from 'node:fs/promises';

// Очищаем генерируемые папки перед каждым запуском
await fs.rm('./content/docs/domovoy', { recursive: true, force: true });
await fs.rm('./content/docs/focus-dashboard', { recursive: true, force: true });

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

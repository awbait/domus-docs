import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const gitConfig = {
  user: 'awbait',
  repo: 'domus-docs',
  branch: 'main',
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'Domus Docs',
    },
    links: [
      {
        type: 'menu',
        text: 'Проекты',
        items: [
          {
            text: 'Domovoy',
            description: 'Локальный голосовой ассистент на Go',
            url: '/docs/domovoy',
          },
          {
            text: 'Focus Dashboard',
            description: 'Персональный дашборд для дома',
            url: '/docs/focus-dashboard',
          },
        ],
      },
    ],
    githubUrl: 'https://github.com/awbait/domus-docs',
  };
}

import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

// fill this with your actual GitHub info, for example:
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
    githubUrl: 'https://github.com/awbait/domus-docs',
  };
}

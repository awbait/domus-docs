import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { Mic, LayoutDashboard } from 'lucide-react';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      sidebar={{
        tabs: [
          {
            title: 'Домовой',
            description: 'Голосовой ассистент',
            url: '/docs/domovoy',
            icon: <Mic size={20} className="text-blue-400" />,
          },
          {
            title: 'Focus Dashboard',
            description: 'Персональный дашборд',
            url: '/docs/focus-dashboard',
            icon: <LayoutDashboard size={20} className="text-emerald-400" />,
          },
        ],
      }}
      {...baseOptions()}
    >
      {children}
    </DocsLayout>
  );
}

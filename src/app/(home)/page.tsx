import { Mic, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

const projects = [
  {
    title: 'Domovoy',
    description: 'Локальный голосовой ассистент на Go. Оркестрирует ML-сервисы (STT, TTS, VAD, LLM) через gRPC.',
    href: '/docs/domovoy',
    icon: Mic,
    color: 'text-blue-500',
  },
  {
    title: 'Focus Dashboard',
    description: 'Персональный дашборд для дома. Go-бэкенд + React-фронтенд с модульной системой виджетов.',
    href: '/docs/focus-dashboard',
    icon: LayoutDashboard,
    color: 'text-emerald-500',
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-16">
      <h1 className="text-4xl font-bold mb-2">Domus</h1>
      <p className="text-fd-muted-foreground text-lg mb-12">
        Документация проектов умного дома
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl w-full">
        {projects.map((project) => (
          <Link
            key={project.href}
            href={project.href}
            className="group rounded-xl border border-fd-border bg-fd-card p-6 transition-colors hover:bg-fd-accent"
          >
            <project.icon className={`size-8 mb-4 ${project.color}`} />
            <h2 className="text-xl font-semibold mb-2 group-hover:text-fd-primary">
              {project.title}
            </h2>
            <p className="text-sm text-fd-muted-foreground">
              {project.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

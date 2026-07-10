'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Grupo } from '@/lib/types';

export function GroupTabs({ grupos }: { grupos: Grupo[] }) {
  const pathname = usePathname();

  if (grupos.length === 0) {
    return (
      <div className="px-6 py-3 border-b border-border bg-white text-sm text-inkSoft">
        Aún no tienes grupos conectados.{' '}
        <Link href="/dashboard/drive" className="text-goldDark font-semibold">
          Ir al explorador de Drive
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-1 px-6 pt-2.5 border-b border-border bg-white overflow-x-auto">
      {grupos.map((g) => {
        const href = `/dashboard/grupo/${g.id}`;
        const activo = pathname === href;
        return (
          <Link
            key={g.id}
            href={href}
            className={`px-4 py-2 text-sm rounded-t-md border border-b-0 whitespace-nowrap ${
              activo
                ? 'bg-bg border-border font-semibold text-ink'
                : 'border-transparent text-inkSoft hover:text-ink'
            }`}
          >
            {g.nombre}
          </Link>
        );
      })}
    </div>
  );
}

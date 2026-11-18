'use client';

import { useSidebar } from './SidebarContext';
import { Icono } from './Icono';

export function Topbar({
  breadcrumb,
  rightSlot,
  inicial
}: {
  breadcrumb: string;
  rightSlot?: React.ReactNode;
  inicial: string;
}) {
  const { abrir } = useSidebar();

  return (
    <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-3.5 border-b border-border bg-white shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={abrir}
          aria-label="Abrir menú"
          className="w-10 h-10 -ml-2 shrink-0 flex items-center justify-center rounded-lg text-ink hover:bg-black/5 md:hidden"
        >
          <Icono nombre="menu" className="w-5 h-5" />
        </button>
        <div className="text-sm text-inkSoft truncate">{breadcrumb}</div>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        {rightSlot}
        <div className="w-8 h-8 rounded-full bg-navy text-gold font-display font-bold text-sm flex items-center justify-center">
          {inicial}
        </div>
      </div>
    </div>
  );
}

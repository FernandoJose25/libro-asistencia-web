'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSidebar } from './SidebarContext';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { abierto, cerrar } = useSidebar();

  const item = (href: string, label: string, icon: string, matchExtra?: string) => {
    const activo = pathname === href || (matchExtra ? pathname.startsWith(matchExtra) : false);
    return (
      <Link
        href={href}
        onClick={cerrar}
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm ${activo ? 'bg-navyActive text-gold font-semibold' : 'text-[#a9b3c6] hover:bg-white/5 hover:text-white'
          }`}
      >
        <span className="w-4 text-center">{icon}</span>
        {label}
      </Link>
    );
  };

  async function desconectarDrive() {
    if (!confirm('¿Cerrar sesión de esta cuenta de Google Drive? Vas a tener que volver a conectarla (puedes elegir la misma cuenta u otra distinta).')) return;
    await fetch('/api/google/disconnect', { method: 'POST' });
    router.push('/dashboard/conectar-drive');
    router.refresh();
  }

  return (
    <>
      {abierto && (
        <div
          onClick={cerrar}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[250px] shrink-0 bg-navy p-4 flex flex-col text-[#a9b3c6] transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 pb-5 mb-3.5 border-b border-white/10">
          <div className="w-9 h-9 rounded-[9px] shrink-0 bg-gradient-to-br from-gold to-goldDark flex items-center justify-center text-lg">
            📋
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
              Libro de<br />Asistencia
            </div>
            <div className="text-[10.5px] text-[#6d7996] mt-0.5">Panel Docente</div>
          </div>
          <button
            onClick={cerrar}
            aria-label="Cerrar menú"
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-md text-[#a9b3c6] hover:bg-white/5 hover:text-white md:hidden"
          >
            ✕
          </button>
        </div>

        <div className="text-[10px] uppercase tracking-wider text-[#6d7996] px-2.5 pb-1.5 pt-1">Principal</div>
        <nav className="flex flex-col gap-0.5 mb-2">
          {item('/dashboard', 'Dashboard', '▦')}
        </nav>

        <div className="text-[10px] uppercase tracking-wider text-[#6d7996] px-2.5 pb-1.5 pt-3">Contenido</div>
        <nav className="flex flex-col gap-0.5">
          {item('/dashboard/grupos', 'Grupos', '🗂', '/dashboard/grupos')}
          {item('/dashboard/asistencia', 'Asistencia', '🗓', '/dashboard/asistencia')}
          {item('/dashboard/alumnos', 'Alumnos', '🎓', '/dashboard/alumnos')}
          {item('/dashboard/drive', 'Drive', '🗄', '/dashboard/drive')}
        </nav>

        <div className="mt-auto pt-3.5 border-t border-white/10 flex flex-col gap-0.5">
          <button
            onClick={desconectarDrive}
            className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-md text-sm text-[#6d7996] hover:bg-white/5"
          >
            <span className="w-4 text-center">🔌</span>Desconectar Drive
          </button>
          <form action="/auth/signout" method="post">
            <button className="flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-md text-sm text-[#6d7996] hover:bg-white/5">
              <span className="w-4 text-center">⏻</span>Salir
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

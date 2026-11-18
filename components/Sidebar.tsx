'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSidebar } from './SidebarContext';
import { Icono, type NombreIcono } from './Icono';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { abierto, cerrar } = useSidebar();

  const item = (href: string, label: string, icon: NombreIcono, matchExtra?: string) => {
    const activo = pathname === href || (matchExtra ? pathname.startsWith(matchExtra) : false);
    return (
      <Link
        href={href}
        onClick={cerrar}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] transition-colors ${activo ? 'bg-navyActive text-gold font-bold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-gold' : 'text-[#a9b3c6] hover:bg-white/5 hover:text-white'
          }`}
      >
        <Icono nombre={icon} className="w-[18px] h-[18px]" />
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
          <div className="w-10 h-10 rounded-[10px] shrink-0 bg-gradient-to-br from-gold to-goldDark flex items-center justify-center text-navy shadow-inner">
            <Icono nombre="libro" className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display text-white font-semibold text-[17px] leading-[1.05]">
              Libro de<br />Asistencia
            </div>
            <div className="text-[10.5px] text-[#6d7996] mt-0.5">Panel Docente</div>
          </div>
          <button
            onClick={cerrar}
            aria-label="Cerrar menú"
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-md text-[#a9b3c6] hover:bg-white/5 hover:text-white md:hidden"
          >
            <Icono nombre="cerrar" />
          </button>
        </div>

        <div className="text-[10px] uppercase tracking-wider text-[#6d7996] px-2.5 pb-1.5 pt-1">Principal</div>
        <nav className="flex flex-col gap-0.5 mb-2">
          {item('/dashboard', 'Dashboard', 'panel')}
        </nav>

        <div className="text-[10px] uppercase tracking-wider text-[#6d7996] px-2.5 pb-1.5 pt-3">Contenido</div>
        <nav className="flex flex-col gap-0.5">
          {item('/dashboard/grupos', 'Grupos', 'carpeta', '/dashboard/grupos')}
          {item('/dashboard/asistencia', 'Asistencia', 'calendario', '/dashboard/asistencia')}
          {item('/dashboard/alumnos', 'Alumnos', 'birrete', '/dashboard/alumnos')}
          {item('/dashboard/drive', 'Drive', 'nube', '/dashboard/drive')}
        </nav>

        <div className="mt-auto pt-3.5 border-t border-white/10 flex flex-col gap-0.5">
          <button
            onClick={desconectarDrive}
            className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm text-[#8d97ad] hover:bg-white/5 hover:text-white"
          >
            <Icono nombre="enchufe" className="w-[18px] h-[18px]" />Desconectar Drive
          </button>
          <form action="/auth/signout" method="post">
            <button className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm text-[#8d97ad] hover:bg-white/5 hover:text-white">
              <Icono nombre="salir" className="w-[18px] h-[18px]" />Salir
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

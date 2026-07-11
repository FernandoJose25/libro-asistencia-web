'use client';

import { useRouter } from 'next/navigation';

// Acceso directo desde el Dashboard: abre la sección Asistencia en el mismo
// grupo que el profesor usó la última vez (localStorage), listo para tomar
// asistencia de hoy sin tener que elegir el grupo de nuevo.
export function AsistenciaHoyButton({ primerGrupoId }: { primerGrupoId: string | null }) {
  const router = useRouter();

  function irAHoy() {
    const ultimoGrupoId = localStorage.getItem('ultimoGrupoAsistencia') || primerGrupoId;
    if (!ultimoGrupoId) return;
    router.push(`/dashboard/asistencia/${ultimoGrupoId}`);
  }

  if (!primerGrupoId) return null;

  return (
    <button
      onClick={irAHoy}
      className="px-4 py-2.5 rounded-md bg-navy text-white text-sm font-semibold whitespace-nowrap"
    >
      🗓 Tomar asistencia de hoy
    </button>
  );
}

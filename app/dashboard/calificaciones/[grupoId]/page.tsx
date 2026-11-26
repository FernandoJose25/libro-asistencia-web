import { Topbar } from '@/components/Topbar';
import { CalificacionesGrupo } from '@/components/CalificacionesGrupo';
import { cargarCalificacionesGrupo } from '@/lib/cargarCalificaciones';

export default async function CalificacionesGrupoPage({
  params,
  searchParams
}: {
  params: { grupoId: string };
  searchParams: { vista?: string };
}) {
  const datos = await cargarCalificacionesGrupo(params.grupoId);

  return (
    <>
      <Topbar breadcrumb={`Calificaciones / ${datos.grupo.nombre}`} inicial={datos.inicial} />
      <CalificacionesGrupo
        key={datos.grupo.id}
        vistaInicial={searchParams.vista === 'examenes' ? 'examenes' : 'trabajos'}
        grupoId={datos.grupo.id}
        grupoNombre={datos.grupo.nombre}
        profesorId={datos.profesorId}
        porcentajeTrabajos={datos.grupo.porcentajeTrabajos}
        alumnos={datos.alumnos}
        trabajosIniciales={datos.trabajos}
        notasIniciales={datos.notas}
        examenesIniciales={datos.examenes}
      />
    </>
  );
}

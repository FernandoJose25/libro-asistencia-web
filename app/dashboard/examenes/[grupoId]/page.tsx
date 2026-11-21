import { Topbar } from '@/components/Topbar';
import { AsistenciaTabs } from '@/components/AsistenciaTabs';
import { ExamenesClient } from '@/components/ExamenesClient';
import { cargarCalificacionesGrupo } from '@/lib/cargarCalificaciones';

export default async function ExamenesGrupoPage({ params }: { params: { grupoId: string } }) {
  const datos = await cargarCalificacionesGrupo(params.grupoId);

  return (
    <>
      <Topbar breadcrumb={`Exámenes / ${datos.grupo.nombre}`} inicial={datos.inicial} />
      <AsistenciaTabs grupos={datos.grupos} base="/dashboard/examenes" />
      <ExamenesClient
        grupoId={datos.grupo.id}
        grupoNombre={datos.grupo.nombre}
        profesorId={datos.profesorId}
        porcentajeTrabajos={datos.grupo.porcentajeTrabajos}
        alumnos={datos.alumnos}
        trabajos={datos.trabajos}
        notas={datos.notas}
        examenesIniciales={datos.examenes}
      />
    </>
  );
}

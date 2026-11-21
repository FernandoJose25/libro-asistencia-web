import { Topbar } from '@/components/Topbar';
import { AsistenciaTabs } from '@/components/AsistenciaTabs';
import { TrabajosClient } from '@/components/TrabajosClient';
import { cargarCalificacionesGrupo } from '@/lib/cargarCalificaciones';

export default async function TrabajosGrupoPage({ params }: { params: { grupoId: string } }) {
  const datos = await cargarCalificacionesGrupo(params.grupoId);

  return (
    <>
      <Topbar breadcrumb={`Trabajos / ${datos.grupo.nombre}`} inicial={datos.inicial} />
      <AsistenciaTabs grupos={datos.grupos} base="/dashboard/trabajos" />
      <TrabajosClient
        grupoId={datos.grupo.id}
        grupoNombre={datos.grupo.nombre}
        profesorId={datos.profesorId}
        porcentajeTrabajos={datos.grupo.porcentajeTrabajos}
        alumnos={datos.alumnos}
        trabajosIniciales={datos.trabajos}
        notasIniciales={datos.notas}
      />
    </>
  );
}

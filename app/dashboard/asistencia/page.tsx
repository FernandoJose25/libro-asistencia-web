import { redirigirAlPrimerGrupo } from '@/lib/primerGrupo';

export default async function AsistenciaIndexPage() {
  return redirigirAlPrimerGrupo('/dashboard/asistencia');
}

import { redirigirAlPrimerGrupo } from '@/lib/primerGrupo';

export default async function ExamenesIndexPage() {
  return redirigirAlPrimerGrupo('/dashboard/examenes');
}

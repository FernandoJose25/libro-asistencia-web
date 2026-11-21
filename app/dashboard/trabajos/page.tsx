import { redirigirAlPrimerGrupo } from '@/lib/primerGrupo';

export default async function TrabajosIndexPage() {
  return redirigirAlPrimerGrupo('/dashboard/trabajos');
}

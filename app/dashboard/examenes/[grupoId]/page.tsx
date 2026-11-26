import { redirect } from 'next/navigation';

// Trabajos y Exámenes ahora están juntos en Calificaciones.
export default function ExamenesGrupoPage({ params }: { params: { grupoId: string } }) {
  redirect(`/dashboard/calificaciones/${params.grupoId}?vista=examenes`);
}

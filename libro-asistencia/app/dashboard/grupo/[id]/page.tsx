import { redirect, notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { Topbar } from '@/components/Topbar';
import { GroupTabs } from '@/components/GroupTabs';
import { AttendanceClient } from '@/components/AttendanceClient';
import { Estatus } from '@/lib/types';

export default async function GrupoPage({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const { data: grupos } = await supabase
    .from('grupos')
    .select('id, profesor_id, archivo_id_nube, nombre, activo, ultima_sync')
    .eq('profesor_id', session.user.id)
    .eq('activo', true)
    .order('nombre');

  const grupo = (grupos || []).find((g) => g.id === params.id);
  if (!grupo) notFound();

  const { data: alumnos } = await supabase
    .from('alumnos')
    .select('id, grupo_id, nombre, orden')
    .eq('grupo_id', grupo.id)
    .order('orden');

  const hoy = new Date().toISOString().slice(0, 10);
  const { data: registros } = await supabase
    .from('registros_asistencia')
    .select('alumno_id, estatus, horas_clase_dia')
    .eq('fecha', hoy)
    .in('alumno_id', (alumnos || []).map((a) => a.id));

  const estatusIniciales: Record<string, Estatus> = {};
  (registros || []).forEach((r) => { estatusIniciales[r.alumno_id] = r.estatus as Estatus; });
  const horasIniciales = ((registros || [])[0]?.horas_clase_dia as 1 | 2) || 1;

  const inicial = (session.user.email || 'P')[0].toUpperCase();

  return (
    <>
      <Topbar breadcrumb={`Grupos / ${grupo.nombre}`} inicial={inicial} />
      <GroupTabs grupos={grupos || []} />
      <AttendanceClient
        grupoId={grupo.id}
        grupoNombre={grupo.nombre}
        alumnosIniciales={alumnos || []}
        estatusIniciales={estatusIniciales}
        horasIniciales={horasIniciales}
      />
    </>
  );
}

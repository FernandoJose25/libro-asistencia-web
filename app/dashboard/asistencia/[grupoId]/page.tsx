import { redirect, notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { Topbar } from '@/components/Topbar';
import { AsistenciaTabs } from '@/components/AsistenciaTabs';
import { AsistenciaClient } from '@/components/AsistenciaClient';

export default async function AsistenciaGrupoPage({ params }: { params: { grupoId: string } }) {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const { data: grupos } = await supabase
    .from('grupos')
    .select('id, profesor_id, archivo_id_nube, nombre, activo, ultima_sync')
    .eq('profesor_id', session.user.id)
    .eq('activo', true)
    .order('nombre');

  const grupo = (grupos || []).find((g) => g.id === params.grupoId);
  if (!grupo) notFound();

  const { data: alumnos } = await supabase
    .from('alumnos')
    .select('id, grupo_id, nombre, orden')
    .eq('grupo_id', grupo.id)
    .order('orden');

  const hoy = new Date().toISOString().slice(0, 10);
  const { data: registros } = await supabase
    .from('asistencia_registros')
    .select('alumno_id, estatus, marcado_en, justificada')
    .eq('grupo_id', grupo.id)
    .eq('fecha', hoy)
    .eq('clase', 1);

  const registrosIniciales: Record<string, { estatus: any; marcado_en: string; justificada: boolean }> = {};
  (registros || []).forEach((r) => {
    registrosIniciales[r.alumno_id] = { estatus: r.estatus, marcado_en: r.marcado_en, justificada: r.justificada };
  });

  const inicial = (session.user.email || 'P')[0].toUpperCase();

  return (
    <>
      <Topbar breadcrumb={`Asistencia / ${grupo.nombre}`} inicial={inicial} />
      <AsistenciaTabs grupos={grupos || []} />
      <AsistenciaClient
        grupoId={grupo.id}
        grupoNombre={grupo.nombre}
        alumnosIniciales={alumnos || []}
        registrosIniciales={registrosIniciales}
      />
    </>
  );
}

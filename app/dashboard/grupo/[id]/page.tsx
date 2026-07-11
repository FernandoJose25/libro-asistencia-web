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
    .select('id, profesor_id, archivo_id_nube, nombre, activo, ultima_sync, umbral_falta_porcentaje')
    .eq('profesor_id', session.user.id)
    .eq('activo', true)
    .order('nombre');

  const grupo = (grupos || []).find((g) => g.id === params.id);
  if (!grupo) notFound();

  const { data: alumnos } = await supabase
    .from('alumnos')
    .select('id, grupo_id, nombre, apellidos, nombres, orden')
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

  // Riesgo por alumno (feature de alertas configurables)
  const { data: riesgoRows } = await supabase
    .from('riesgo_por_alumno')
    .select('alumno_id, porcentaje_falta, en_riesgo')
    .eq('grupo_id', grupo.id);

  const riesgoPorAlumno: Record<string, { porcentajeFalta: number; enRiesgo: boolean }> = {};
  (riesgoRows || []).forEach((r) => {
    riesgoPorAlumno[r.alumno_id] = { porcentajeFalta: r.porcentaje_falta, enRiesgo: r.en_riesgo };
  });

  // Calendario de asistencia (heatmap): una fila por día dictado + su tasa de asistencia real.
  const { data: sesiones } = await supabase
    .from('sesiones_grupo')
    .select('fecha')
    .eq('grupo_id', grupo.id)
    .order('fecha');

  const { data: registrosTodos } = await supabase
    .from('registros_asistencia')
    .select('fecha, estatus')
    .in('alumno_id', (alumnos || []).map((a) => a.id));

  const totalAlumnos = (alumnos || []).length || 1;
  const diasHeatmap = (sesiones || []).map((s) => {
    const delDia = (registrosTodos || []).filter((r) => r.fecha === s.fecha);
    const presentes = delDia.filter((r) => r.estatus === 'asistio' || r.estatus === 'tardanza').length;
    return { fecha: s.fecha, tasaAsistencia: presentes / totalAlumnos };
  });

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
        umbralInicial={grupo.umbral_falta_porcentaje}
        riesgoPorAlumno={riesgoPorAlumno}
        diasHeatmap={diasHeatmap}
      />
    </>
  );
}

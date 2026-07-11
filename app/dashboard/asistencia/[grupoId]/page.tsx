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
    .select('id, profesor_id, archivo_id_nube, nombre, activo, ultima_sync, umbral_falta_porcentaje, horas_clase_semana, faltas_permitidas_semestre')
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

  // Riesgo por alumno (umbral configurable) y calendario de asistencia (heatmap).
  const { data: riesgoRows } = await supabase
    .from('riesgo_por_alumno_v2')
    .select('alumno_id, porcentaje_falta, en_riesgo')
    .eq('grupo_id', grupo.id);

  const riesgoPorAlumno: Record<string, { porcentajeFalta: number; enRiesgo: boolean }> = {};
  (riesgoRows || []).forEach((r) => {
    riesgoPorAlumno[r.alumno_id] = { porcentajeFalta: r.porcentaje_falta, enRiesgo: r.en_riesgo };
  });

  const { data: registrosTodos } = await supabase
    .from('asistencia_registros')
    .select('fecha, clase, estatus')
    .eq('grupo_id', grupo.id);

  const fechasClase = Array.from(
    new Set((registrosTodos || []).map((r) => `${r.fecha}|${r.clase}`))
  ).sort();

  const totalAlumnos = (alumnos || []).length || 1;
  const diasHeatmap = fechasClase.map((fc) => {
    const [fecha, clase] = fc.split('|');
    const delDia = (registrosTodos || []).filter((r) => r.fecha === fecha && String(r.clase) === clase);
    const presentes = delDia.filter((r) => r.estatus === 'asistio' || r.estatus === 'tardanza').length;
    return { fecha, tasaAsistencia: presentes / totalAlumnos };
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
        umbralInicial={grupo.umbral_falta_porcentaje}
        horasClaseSemanaInicial={grupo.horas_clase_semana}
        faltasPermitidasSemestreInicial={grupo.faltas_permitidas_semestre}
        riesgoPorAlumno={riesgoPorAlumno}
        diasHeatmap={diasHeatmap}
      />
    </>
  );
}

import { notFound, redirect } from 'next/navigation';
import { supabaseServer } from './supabaseServer';
import { leerTodo } from './utils';
import type { Alumno, Grupo } from './types';
import type { NotaTrabajo, Parcial, Trabajo } from './calificaciones';

export interface ExamenGuardado {
  alumno_id: string;
  parcial: Parcial;
  nota: number;
}

// Datos de las pestañas Trabajos y Exámenes de un grupo del profesor.
export async function cargarCalificacionesGrupo(grupoId: string) {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const { data: grupos } = await supabase
    .from('grupos')
    .select('id, profesor_id, archivo_id_nube, nombre, activo, ultima_sync, porcentaje_trabajos')
    .eq('profesor_id', session.user.id)
    .eq('activo', true)
    .order('nombre');

  const grupo = (grupos || []).find((g) => g.id === grupoId);
  if (!grupo) notFound();

  const [{ data: alumnos }, { data: trabajos }, notas, examenes] = await Promise.all([
    supabase.from('alumnos').select('id, grupo_id, nombre, apellidos, nombres, orden').eq('grupo_id', grupo.id).order('orden'),
    supabase.from('evaluaciones').select('id, nombre, parcial').eq('grupo_id', grupo.id).order('creado_en').order('id'),
    // Un grupo de 35 alumnos con 10 trabajos por parcial ya pasa de 1000 notas.
    leerTodo<NotaTrabajo>((desde, hasta) =>
      supabase
        .from('notas')
        .select('alumno_id, evaluacion_id, nota, no_entrego')
        .eq('grupo_id', grupo.id)
        .order('id')
        .range(desde, hasta)
    ),
    leerTodo<ExamenGuardado>((desde, hasta) =>
      supabase.from('examenes').select('alumno_id, parcial, nota').eq('grupo_id', grupo.id).order('id').range(desde, hasta)
    )
  ]);

  return {
    profesorId: session.user.id,
    inicial: (session.user.email || 'P')[0].toUpperCase(),
    grupos: (grupos || []) as Grupo[],
    grupo: { id: grupo.id as string, nombre: grupo.nombre as string, porcentajeTrabajos: Number(grupo.porcentaje_trabajos ?? 50) },
    alumnos: (alumnos || []) as Alumno[],
    trabajos: (trabajos || []) as Trabajo[],
    notas: notas.map((n) => ({ ...n, nota: Number(n.nota) })),
    examenes: examenes.map((e) => ({ ...e, nota: Number(e.nota) }))
  };
}

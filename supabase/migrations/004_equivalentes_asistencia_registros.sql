-- Ejecutar en Supabase → SQL Editor
--
-- Reemplazos de las vistas del sistema VIEJO (registros_asistencia,
-- sesiones_grupo) apuntando al sistema NUEVO (asistencia_registros), para
-- poder migrar Alumnos/Dashboard/heatmap/resumen-IA y luego retirar
-- AttendanceClient.tsx y todo /dashboard/grupo. Se usan con sufijo _v2
-- mientras se verifica que el reemplazo funciona igual; una migración
-- posterior las renombra a los nombres definitivos y borra lo viejo.
--
-- Diferencia intencional respecto al sistema viejo: las faltas marcadas
-- justificada = true NO cuentan para horas de falta ni riesgo.

-- Config por grupo que antes no existía en ningún lado versionado.
alter table grupos
  add column if not exists horas_clase_semana int not null default 0;
alter table grupos
  add column if not exists faltas_permitidas_semestre int not null default 0;

-- Horas de falta por alumno, sin contar faltas justificadas.
create or replace view horas_falta_por_alumno_v2 as
select
  a.id as alumno_id,
  a.nombre,
  a.grupo_id,
  coalesce(sum(1) filter (where r.estatus = 'falto' and not r.justificada), 0) as horas_falta_total,
  count(*) filter (where r.estatus = 'tardanza') as tardanzas_total
from alumnos a
left join asistencia_registros r on r.alumno_id = a.id
group by a.id, a.nombre, a.grupo_id;

-- Horas dictadas por grupo: cada combinación (fecha, clase) con al menos un
-- registro cuenta como una clase dictada de 1 hora (el sistema nuevo no
-- distingue horas_clase_dia como el viejo — cada "clase" ya es una unidad).
create or replace view horas_dictadas_por_grupo_v2 as
select
  grupo_id,
  count(distinct (fecha, clase)) as horas_dictadas_total
from asistencia_registros
group by grupo_id;

create or replace view riesgo_por_alumno_v2 as
select
  a.id as alumno_id,
  a.nombre,
  a.grupo_id,
  g.nombre as grupo_nombre,
  g.profesor_id,
  g.umbral_falta_porcentaje,
  coalesce(h.horas_falta_total, 0) as horas_falta_total,
  coalesce(s.horas_dictadas_total, 0) as horas_dictadas_total,
  case
    when coalesce(s.horas_dictadas_total, 0) > 0
      then round(100.0 * coalesce(h.horas_falta_total, 0)::numeric / s.horas_dictadas_total::numeric, 1)
    else 0
  end as porcentaje_falta,
  case
    when coalesce(s.horas_dictadas_total, 0) > 0
      and (100.0 * coalesce(h.horas_falta_total, 0)::numeric / s.horas_dictadas_total::numeric) >= g.umbral_falta_porcentaje
      then true
    else false
  end as en_riesgo
from alumnos a
join grupos g on g.id = a.grupo_id
left join horas_falta_por_alumno_v2 h on h.alumno_id = a.id
left join horas_dictadas_por_grupo_v2 s on s.grupo_id = a.grupo_id;

-- Reporte agregado por alumno para la sección "Alumnos" (nunca existió una
-- versión real de esto en el repo — se reconstruye desde cero según las
-- columnas que ya consume app/dashboard/alumnos/page.tsx).
create or replace view reporte_asistencia_alumno_v2 as
select
  a.id as alumno_id,
  a.nombre,
  a.grupo_id,
  g.nombre as grupo_nombre,
  g.profesor_id,
  g.horas_clase_semana,
  g.faltas_permitidas_semestre,
  count(*) filter (where r.estatus = 'asistio') as dias_asistio,
  count(*) filter (where r.estatus = 'tardanza') as dias_tardanza,
  count(*) filter (where r.estatus = 'falto' and not r.justificada) as dias_falto,
  coalesce(sum(1) filter (where r.estatus = 'falto' and not r.justificada), 0) as horas_falta_acumuladas,
  g.faltas_permitidas_semestre - coalesce(sum(1) filter (where r.estatus = 'falto' and not r.justificada), 0) as horas_falta_restantes
from alumnos a
join grupos g on g.id = a.grupo_id
left join asistencia_registros r on r.alumno_id = a.id
group by a.id, a.nombre, a.grupo_id, g.nombre, g.profesor_id, g.horas_clase_semana, g.faltas_permitidas_semestre;

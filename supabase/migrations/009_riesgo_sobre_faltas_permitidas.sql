-- Ejecutar en Supabase → SQL Editor
--
-- Corrige la lógica de riesgo por inasistencias. Antes el porcentaje se
-- calculaba sobre las CLASES DICTADAS hasta hoy (horas_dictadas_total), lo que
-- hacía que con pocas clases dictadas 1 falta ya diera un % altísimo (ej. 1 de
-- 2 clases = 50%) y marcara al alumno en riesgo incorrectamente.
--
-- Nuevo criterio: el porcentaje se calcula sobre las FALTAS PERMITIDAS del
-- semestre (config del grupo), que es un tope fijo e independiente de cuántas
-- clases se hayan dictado:
--
--   porcentaje_falta = 100 * faltas_actuales / faltas_permitidas_semestre
--   faltas_para_alerta = ceil(faltas_permitidas_semestre * umbral / 100)
--   en_riesgo = faltas_actuales >= faltas_para_alerta
--
-- Las horas de clase por semana NO intervienen en el riesgo; quedan solo como
-- dato contextual y para estadísticas/equivalencias futuras.

-- create or replace no permite reordenar/renombrar columnas existentes de la
-- vista, así que la recreamos desde cero.
drop view if exists riesgo_por_alumno_v2;

create view riesgo_por_alumno_v2 as
select
  a.id as alumno_id,
  a.nombre,
  a.grupo_id,
  g.nombre as grupo_nombre,
  g.profesor_id,
  g.umbral_falta_porcentaje,
  g.faltas_permitidas_semestre,
  coalesce(h.horas_falta_total, 0) as horas_falta_total,
  coalesce(s.horas_dictadas_total, 0) as horas_dictadas_total,
  -- Faltas que activan la alerta: tope permitido * umbral, redondeado hacia
  -- arriba. Si no hay faltas permitidas configuradas, no hay alerta posible.
  case
    when g.faltas_permitidas_semestre > 0
      then ceil(g.faltas_permitidas_semestre::numeric * g.umbral_falta_porcentaje::numeric / 100.0)
    else 0
  end as faltas_para_alerta,
  -- Porcentaje de inasistencia sobre el tope permitido (1 decimal).
  case
    when g.faltas_permitidas_semestre > 0
      then round(100.0 * coalesce(h.horas_falta_total, 0)::numeric / g.faltas_permitidas_semestre::numeric, 1)
    else 0
  end as porcentaje_falta,
  -- En riesgo cuando alcanza o supera las faltas de alerta.
  case
    when g.faltas_permitidas_semestre > 0
      and coalesce(h.horas_falta_total, 0) >= ceil(g.faltas_permitidas_semestre::numeric * g.umbral_falta_porcentaje::numeric / 100.0)
      then true
    else false
  end as en_riesgo
from alumnos a
join grupos g on g.id = a.grupo_id
left join horas_falta_por_alumno_v2 h on h.alumno_id = a.id
left join horas_dictadas_por_grupo_v2 s on s.grupo_id = a.grupo_id;

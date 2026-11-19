-- Ejecutar en Supabase → SQL Editor
--
-- Conteo de asistencias, retardos y faltas por alumno entre dos fechas
-- (ambas incluidas), para el filtro de periodo de la sección Alumnos. Cuenta
-- igual que reporte_asistencia_alumno_v2: un registro por fecha y hora de
-- clase, y las faltas justificadas no suman.
--
-- security invoker: corre con la sesión del profesor y aplica el RLS de
-- asistencia_registros, así cada uno solo ve lo suyo. Los alumnos sin
-- registros en el periodo no aparecen (la app los toma como 0).

create or replace function public.reporte_asistencia_rango(p_desde date, p_hasta date)
returns table (alumno_id uuid, dias_asistio bigint, dias_tardanza bigint, dias_falto bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.alumno_id,
    count(*) filter (where r.estatus = 'asistio'),
    count(*) filter (where r.estatus = 'tardanza'),
    count(*) filter (where r.estatus = 'falto' and not r.justificada)
  from asistencia_registros r
  where r.fecha between p_desde and p_hasta
  group by r.alumno_id;
$$;

revoke all on function public.reporte_asistencia_rango(date, date) from public, anon;
grant execute on function public.reporte_asistencia_rango(date, date) to authenticated;

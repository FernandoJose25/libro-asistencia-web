-- Ejecutar en Supabase → SQL Editor
--
-- Las vistas de reportes se ejecutaban con los permisos de su dueño (postgres),
-- así que se saltaban el RLS de las tablas: con la clave pública, sin sesión,
-- se podían leer nombre, grupo, faltas, notas y riesgo de todos los alumnos.
--
-- Con security_invoker la vista corre con los permisos de quien consulta, y
-- aplica el RLS de alumnos, grupos, asistencia y notas. Cada profesor sigue
-- viendo solo lo suyo y sin sesión no se ve nada.
--
-- Ojo: si una migración futura hace drop/create de alguna de estas vistas,
-- tiene que crearla con `with (security_invoker = on)`, o vuelve el problema.

alter view public.horas_dictadas_por_grupo set (security_invoker = on);
alter view public.horas_dictadas_por_grupo_v2 set (security_invoker = on);
alter view public.horas_falta_por_alumno set (security_invoker = on);
alter view public.horas_falta_por_alumno_v2 set (security_invoker = on);
alter view public.reporte_asistencia_alumno_v2 set (security_invoker = on);
alter view public.reporte_notas_alumno set (security_invoker = on);
alter view public.riesgo_por_alumno set (security_invoker = on);
alter view public.riesgo_por_alumno_v2 set (security_invoker = on);

-- La app solo consulta estas vistas con la sesión del profesor.
revoke all on public.horas_dictadas_por_grupo, public.horas_dictadas_por_grupo_v2,
  public.horas_falta_por_alumno, public.horas_falta_por_alumno_v2,
  public.reporte_asistencia_alumno_v2, public.reporte_notas_alumno,
  public.riesgo_por_alumno, public.riesgo_por_alumno_v2
  from anon;

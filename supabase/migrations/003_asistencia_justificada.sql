-- Ejecutar en Supabase → SQL Editor
--
-- Permite marcar una falta de la sección "Asistencia" como justificada
-- (médica, permiso, etc.) sin dejar de registrarla — solo se usa para
-- distinguirla visualmente y en las exportaciones; no altera el estatus
-- 'falto' en sí ni toca registros_asistencia (sistema clásico de Grupos).

alter table asistencia_registros
  add column if not exists justificada boolean not null default false;

-- Ejecutar en Supabase → SQL Editor
--
-- La 002 borró la tabla sesiones_qr, pero quedaron sus dos funciones, que
-- cualquiera podía llamar sin sesión (fallaban porque la tabla ya no existe).
-- Se borran. Además, el trigger de nombres queda con search_path fijo.

drop function if exists public.alumnos_para_qr(text);
drop function if exists public.marcar_asistencia_qr(text, uuid);

alter function public.sincronizar_nombre_alumno() set search_path = public;

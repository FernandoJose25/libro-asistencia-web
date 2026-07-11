-- Ejecutar en Supabase → SQL Editor
--
-- Para la sección "Asistencia"/"Grupos" nueva, un grupo pasa a estar
-- representado por una CARPETA en Drive (GRUPOS/<Grupo>/<fecha>/Clase N.xlsx),
-- no por el archivo suelto que usa el sistema clásico de Grupos
-- (archivo_id_nube, que sigue intocado para no romper AttendanceClient.tsx /
-- /dashboard/grupo/[id] / sync-file). carpeta_drive_id guarda el ID de esa
-- carpeta de Drive; queda NULL para grupos creados/importados por el flujo
-- viejo hasta que se sincronicen al menos una vez desde Asistencia.

alter table grupos
  add column if not exists carpeta_drive_id text;

-- Ejecutar en Supabase → SQL Editor
--
-- Nuevo motivo de justificación 'sin_clases': lo usa "¿No hubo clases este
-- día?" en Asistencia para justificar a todo el grupo un feriado o día
-- inhábil. Se muestra como "Sin clases — <motivo escrito>".

alter table asistencia_registros
  drop constraint if exists asistencia_registros_justificacion_motivo_check;

alter table asistencia_registros
  add constraint asistencia_registros_justificacion_motivo_check
    check (justificacion_motivo is null or justificacion_motivo in ('salud', 'imprevisto', 'otro', 'sin_clases'));

-- Ejecutar en Supabase → SQL Editor
--
-- Extiende "justificada" (boolean, migración 003) con un motivo estructurado
-- y un detalle libre, para que el profesor pueda explicar por qué justificó
-- la falta y que quede reflejado en las exportaciones.

alter table asistencia_registros
  add column if not exists justificacion_motivo text
    check (justificacion_motivo is null or justificacion_motivo in ('salud', 'imprevisto', 'otro'));

alter table asistencia_registros
  add column if not exists justificacion_detalle text;

-- Ejecutar en Supabase → SQL Editor
--
-- Tabla nueva y aditiva para la sección "Asistencia" del dashboard (toma de
-- asistencia interactiva por grupo + fecha + clase, sincronizada a Drive en
-- ASISTENCIA/<fecha>/[Clase N/]Grupo.xlsx). Es independiente de
-- registros_asistencia (usada por la vista clásica de Grupos): no se toca su
-- único (alumno_id, fecha) porque AttendanceClient.tsx y sync-file/[grupoId]
-- dependen de él tal cual. Aquí el único incluye "clase" para permitir 2
-- clases del mismo alumno en el mismo día como filas separadas.

create table if not exists asistencia_registros (
  id uuid primary key default uuid_generate_v4(),
  alumno_id uuid references alumnos(id) on delete cascade not null,
  grupo_id uuid references grupos(id) on delete cascade not null,
  fecha date not null,
  clase smallint not null default 1 check (clase in (1,2)),
  estatus text not null check (estatus in ('asistio','tardanza','falto')),
  marcado_en timestamptz not null default now(),
  profesor_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (alumno_id, fecha, clase)
);

alter table asistencia_registros enable row level security;

create policy "profesor ve/edita su propia asistencia_registros"
  on asistencia_registros for all
  using (auth.uid() = profesor_id)
  with check (auth.uid() = profesor_id);

create index if not exists idx_asistencia_registros_grupo_fecha
  on asistencia_registros (grupo_id, fecha, clase);

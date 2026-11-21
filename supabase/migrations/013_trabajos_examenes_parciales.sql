-- Ejecutar en Supabase → SQL Editor
--
-- Trabajos/tareas y exámenes por parcial (1, 2 y 3).
--
-- La calificación de un parcial = promedio de sus trabajos × porcentaje_trabajos
-- + examen del parcial × (100 − porcentaje_trabajos). Lo calcula la app.
--
-- "evaluaciones" y "notas" (migración 008) no se habían usado todavía: pasan a
-- ser los trabajos y sus calificaciones.

-- Cada trabajo pertenece a un parcial.
alter table public.evaluaciones
  add column if not exists parcial smallint not null default 1 check (parcial between 1 and 3);

-- El mismo título puede repetirse en parciales distintos ("Tarea 1" en cada uno).
drop index if exists public.idx_evaluaciones_grupo_nombre_ci;
create unique index if not exists idx_evaluaciones_grupo_parcial_nombre_ci
  on public.evaluaciones (grupo_id, parcial, lower(trim(nombre)));

-- NE = no entregó. Vale 0 en el promedio, pero se distingue de un 0 calificado.
alter table public.notas add column if not exists no_entrego boolean not null default false;
alter table public.notas drop constraint if exists notas_no_entrego_es_cero;
alter table public.notas add constraint notas_no_entrego_es_cero check (not no_entrego or nota = 0);

-- Qué porcentaje de la calificación del parcial corresponde a los trabajos; el
-- resto corresponde al examen.
alter table public.grupos
  add column if not exists porcentaje_trabajos numeric not null default 50
  check (porcentaje_trabajos >= 0 and porcentaje_trabajos <= 100);

-- Un examen por alumno y parcial, escala 0-10.
create table if not exists public.examenes (
  id uuid primary key default uuid_generate_v4(),
  alumno_id uuid references public.alumnos(id) on delete cascade not null,
  grupo_id uuid references public.grupos(id) on delete cascade not null,
  profesor_id uuid references auth.users(id) on delete cascade not null,
  parcial smallint not null check (parcial between 1 and 3),
  nota numeric(4,2) not null check (nota >= 0 and nota <= 10),
  actualizado_en timestamptz default now(),
  unique (alumno_id, parcial)
);

create index if not exists idx_examenes_grupo on public.examenes (grupo_id);

alter table public.examenes enable row level security;

drop policy if exists "profesor ve/edita sus propios examenes" on public.examenes;
create policy "profesor ve/edita sus propios examenes"
  on public.examenes for all
  using ((select auth.uid()) = profesor_id)
  with check ((select auth.uid()) = profesor_id);

revoke all on public.examenes from anon;

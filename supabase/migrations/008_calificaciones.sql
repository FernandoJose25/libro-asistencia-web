-- Ejecutar en Supabase → SQL Editor
--
-- Tabla nueva y aditiva para la sección "Calificaciones" del dashboard.
-- Introduce evaluaciones (una entrada por examen/tarea/práctica dentro de un
-- grupo) y notas (una nota por alumno y evaluación, escala 0-10, sin peso:
-- el promedio del alumno es el promedio aritmético simple de sus notas
-- cargadas). No toca alumnos, grupos ni ninguna tabla de asistencia.

create table if not exists evaluaciones (
  id uuid primary key default uuid_generate_v4(),
  grupo_id uuid references grupos(id) on delete cascade not null,
  profesor_id uuid references auth.users(id) on delete cascade not null,
  nombre text not null check (char_length(trim(nombre)) > 0),
  fecha date not null default current_date,
  creado_en timestamptz default now()
);

-- Evita que dos evaluaciones se llamen igual en el mismo grupo incluso si
-- difieren solo en mayúsculas o espacios (ej. "Examen 1" vs " examen 1 "),
-- que es el caso real de "duplicado accidental" que se quiere evitar.
create unique index if not exists idx_evaluaciones_grupo_nombre_ci
  on evaluaciones (grupo_id, lower(trim(nombre)));

create index if not exists idx_evaluaciones_grupo
  on evaluaciones (grupo_id);

alter table evaluaciones enable row level security;

create policy "profesor ve/edita sus propias evaluaciones"
  on evaluaciones for all
  using (auth.uid() = profesor_id)
  with check (auth.uid() = profesor_id);

create table if not exists notas (
  id uuid primary key default uuid_generate_v4(),
  alumno_id uuid references alumnos(id) on delete cascade not null,
  evaluacion_id uuid references evaluaciones(id) on delete cascade not null,
  grupo_id uuid references grupos(id) on delete cascade not null,
  nota numeric(4,2) not null check (nota >= 0 and nota <= 10),
  profesor_id uuid references auth.users(id) on delete cascade not null,
  actualizado_en timestamptz default now(),
  unique (alumno_id, evaluacion_id)
);

create index if not exists idx_notas_grupo_evaluacion
  on notas (grupo_id, evaluacion_id);

create index if not exists idx_notas_alumno
  on notas (alumno_id);

alter table notas enable row level security;

create policy "profesor ve/edita sus propias notas"
  on notas for all
  using (auth.uid() = profesor_id)
  with check (auth.uid() = profesor_id);

-- Reporte agregado por alumno para la sección "Calificaciones": promedio
-- simple (sin peso) y conteo de notas pendientes de cargar.
create or replace view reporte_notas_alumno as
select
  a.id as alumno_id,
  a.nombre,
  a.grupo_id,
  g.nombre as grupo_nombre,
  g.profesor_id,
  count(distinct e.id) as cantidad_evaluaciones,
  count(n.id) as cantidad_notas_cargadas,
  count(distinct e.id) - count(n.id) as cantidad_pendientes,
  round(avg(n.nota), 2) as promedio
from alumnos a
join grupos g on g.id = a.grupo_id
left join evaluaciones e on e.grupo_id = a.grupo_id
left join notas n on n.alumno_id = a.id and n.evaluacion_id = e.id
group by a.id, a.nombre, a.grupo_id, g.nombre, g.profesor_id;

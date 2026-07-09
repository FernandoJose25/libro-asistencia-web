-- Ejecutar en Supabase → SQL Editor
-- Requiere que Google OAuth esté habilitado en Authentication → Providers,
-- con el scope de Drive agregado (ver README, sección "Google Cloud").

create extension if not exists "uuid-ossp";

-- Config por profesor: qué carpeta de Drive tiene conectada
create table if not exists profesores_config (
  id uuid primary key references auth.users(id) on delete cascade,
  carpeta_id text,
  carpeta_nombre text,
  updated_at timestamptz default now()
);

-- Un grupo = un archivo dentro de la carpeta conectada
create table if not exists grupos (
  id uuid primary key default uuid_generate_v4(),
  profesor_id uuid references auth.users(id) on delete cascade not null,
  archivo_id_nube text not null,
  nombre text not null,
  activo boolean default true,
  ultima_sync timestamptz,
  created_at timestamptz default now(),
  unique (profesor_id, archivo_id_nube)
);

create table if not exists alumnos (
  id uuid primary key default uuid_generate_v4(),
  grupo_id uuid references grupos(id) on delete cascade not null,
  nombre text not null,
  orden int default 0
);

create table if not exists registros_asistencia (
  id uuid primary key default uuid_generate_v4(),
  alumno_id uuid references alumnos(id) on delete cascade not null,
  fecha date not null default current_date,
  estatus text not null check (estatus in ('asistio','tardanza','falto')),
  horas_clase_dia smallint not null default 1 check (horas_clase_dia in (1,2)),
  created_at timestamptz default now(),
  unique (alumno_id, fecha)
);

-- ── Row Level Security ──────────────────────────────────────────
alter table profesores_config enable row level security;
alter table grupos enable row level security;
alter table alumnos enable row level security;
alter table registros_asistencia enable row level security;

create policy "profesor ve/edita su propia config"
  on profesores_config for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profesor ve/edita sus propios grupos"
  on grupos for all
  using (auth.uid() = profesor_id)
  with check (auth.uid() = profesor_id);

create policy "profesor ve/edita alumnos de sus grupos"
  on alumnos for all
  using (exists (select 1 from grupos g where g.id = grupo_id and g.profesor_id = auth.uid()))
  with check (exists (select 1 from grupos g where g.id = grupo_id and g.profesor_id = auth.uid()));

create policy "profesor ve/edita asistencia de sus alumnos"
  on registros_asistencia for all
  using (exists (
    select 1 from alumnos a join grupos g on g.id = a.grupo_id
    where a.id = alumno_id and g.profesor_id = auth.uid()
  ))
  with check (exists (
    select 1 from alumnos a join grupos g on g.id = a.grupo_id
    where a.id = alumno_id and g.profesor_id = auth.uid()
  ));

-- Vista de horas de falta acumuladas por alumno (para el dashboard)
create or replace view horas_falta_por_alumno as
select
  a.id as alumno_id,
  a.nombre,
  a.grupo_id,
  coalesce(sum(r.horas_clase_dia) filter (where r.estatus = 'falto'), 0) as horas_falta_total,
  count(*) filter (where r.estatus = 'tardanza') as tardanzas_total
from alumnos a
left join registros_asistencia r on r.alumno_id = a.id
group by a.id, a.nombre, a.grupo_id;

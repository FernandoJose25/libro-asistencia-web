-- Ejecutar en Supabase → SQL Editor
--
-- Separa "nombre" (texto único) en "apellidos" + "nombres" para poder
-- importar Excel con columnas separadas y mostrar "Nro" en la tabla de
-- Alumnos. "nombre" se conserva (no se borra) porque reporte_asistencia_alumno_v2,
-- horas_falta_por_alumno_v2, riesgo_por_alumno_v2, los PDF de reporte y los
-- exports a Drive (lib/drive.ts, lib/driveAsistencia.ts) ya lo leen — un
-- trigger lo mantiene sincronizado a partir de apellidos+nombres cuando
-- estos vienen informados. Alumnos ya existentes quedan con apellidos/nombres
-- en null y su "nombre" intacto hasta que se editen.

alter table alumnos add column if not exists apellidos text;
alter table alumnos add column if not exists nombres text;

create or replace function sincronizar_nombre_alumno()
returns trigger as $$
begin
  if new.apellidos is not null and new.nombres is not null then
    new.nombre := trim(new.apellidos || ' ' || new.nombres);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sincronizar_nombre_alumno on alumnos;
create trigger trg_sincronizar_nombre_alumno
  before insert or update on alumnos
  for each row execute function sincronizar_nombre_alumno();

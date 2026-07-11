import { NextResponse } from 'next/server';
import { contextoDrive } from '@/lib/driveContext';
import { sincronizarAsistenciaADrive } from '@/lib/driveAsistencia';
import { sanitizarNombreArchivo } from '@/lib/utils';

export async function POST(request: Request, { params }: { params: { grupoId: string } }) {
  const ctx = await contextoDrive();
  if (ctx.error) return ctx.error;
  const { session, accessToken, supabase } = ctx;

  const { fecha, clase } = await request.json();
  if (!fecha || (clase !== 1 && clase !== 2)) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const { data: grupo } = await supabase
    .from('grupos')
    .select('id, nombre, profesor_id, carpeta_drive_id')
    .eq('id', params.grupoId)
    .single();

  if (!grupo || grupo.profesor_id !== session.user.id) {
    return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
  }

  const { data: alumnos } = await supabase
    .from('alumnos')
    .select('id, nombre, orden')
    .eq('grupo_id', grupo.id)
    .order('orden');

  const { data: registros } = await supabase
    .from('asistencia_registros')
    .select('alumno_id, estatus, marcado_en, justificada, justificacion_motivo, justificacion_detalle')
    .eq('grupo_id', grupo.id)
    .eq('fecha', fecha)
    .eq('clase', clase);

  const MOTIVO_LABEL: Record<string, string> = { salud: 'Salud', imprevisto: 'Imprevisto', otro: 'Otro' };
  const mapaRegistros = new Map((registros || []).map((r) => [r.alumno_id, r]));
  const [anio, mes, dia] = (fecha as string).split('-');

  const filas = (alumnos || []).map((a) => {
    const registro = mapaRegistros.get(a.id);
    const marcadoEn = registro?.marcado_en ? new Date(registro.marcado_en) : null;
    const estatus = registro?.estatus || 'falto';
    let estatusTexto: string = estatus;
    if (estatus === 'falto' && registro?.justificada) {
      const motivoLabel = MOTIVO_LABEL[registro.justificacion_motivo || 'otro'] || 'Otro';
      estatusTexto = `falto (justificada: ${motivoLabel}${registro.justificacion_detalle ? ` — ${registro.justificacion_detalle}` : ''})`;
    }
    return {
      nombre: a.nombre,
      estatus: estatusTexto,
      fecha: `${dia}/${mes}/${anio}`,
      hora: marcadoEn
        ? marcadoEn.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false })
        : ''
    };
  });

  try {
    const { carpetaGrupoId } = await sincronizarAsistenciaADrive(accessToken, {
      grupoNombre: sanitizarNombreArchivo(grupo.nombre),
      carpetaGrupoId: grupo.carpeta_drive_id,
      fechaCarpeta: `${dia}-${mes}-${anio}`,
      clase: clase as 1 | 2,
      filas
    });

    if (carpetaGrupoId !== grupo.carpeta_drive_id) {
      await supabase.from('grupos').update({ carpeta_drive_id: carpetaGrupoId }).eq('id', grupo.id);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error escribiendo en Drive' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

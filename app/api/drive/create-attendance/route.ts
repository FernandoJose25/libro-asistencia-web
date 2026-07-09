import { NextResponse } from 'next/server';
import { contextoDrive } from '@/lib/driveContext';
import { leerAlumnosDeArchivo } from '@/lib/drive';

// Convierte un archivo cualquiera (xlsx/csv/Google Sheet) en un "grupo" de
// asistencia: crea el registro en `grupos` y, si es la primera vez, importa
// los nombres de la primera columna como alumnos.
export async function POST(request: Request) {
  const ctx = await contextoDrive();
  if (ctx.error) return ctx.error;

  const { archivoId, nombre, mimeType } = await request.json();
  if (!archivoId || !nombre || !mimeType) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const { data: grupo, error } = await ctx.supabase
    .from('grupos')
    .upsert(
      {
        profesor_id: ctx.session.user.id,
        archivo_id_nube: archivoId,
        archivo_mime_type: mimeType,
        nombre: nombre.replace(/\.(xlsx|csv)$/i, ''),
        activo: true,
        ultima_sync: new Date().toISOString()
      },
      { onConflict: 'profesor_id,archivo_id_nube' }
    )
    .select('id')
    .single();

  if (error || !grupo) {
    return NextResponse.json({ error: error?.message || 'No se pudo crear el grupo' }, { status: 500 });
  }

  const { count } = await ctx.supabase
    .from('alumnos')
    .select('id', { count: 'exact', head: true })
    .eq('grupo_id', grupo.id);

  if (!count) {
    try {
      const nombres = await leerAlumnosDeArchivo(ctx.accessToken, archivoId, mimeType);
      const filas = nombres.map((n, orden) => ({ grupo_id: grupo.id, nombre: n, orden }));
      if (filas.length > 0) await ctx.supabase.from('alumnos').insert(filas);
    } catch {
      // Si el archivo está vacío o con un formato inesperado, igual se crea
      // el grupo; el profesor puede agregar alumnos manualmente después.
    }
  }

  return NextResponse.json({ grupoId: grupo.id });
}

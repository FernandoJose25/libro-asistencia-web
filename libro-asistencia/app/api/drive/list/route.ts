import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { listarArchivosDeCarpeta, leerAlumnosDeArchivo } from '@/lib/drive';

// POST: solo escanea la carpeta y regresa los archivos reconocibles (no guarda nada todavía).
export async function POST(request: Request) {
  const { carpetaId, accessToken } = await request.json();
  if (!carpetaId || !accessToken) {
    return NextResponse.json({ error: 'Falta carpetaId o accessToken' }, { status: 400 });
  }

  try {
    const archivos = await listarArchivosDeCarpeta(accessToken, carpetaId);
    return NextResponse.json({ archivos });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error leyendo Drive' }, { status: 502 });
  }
}

// PUT: confirma el import — guarda la carpeta conectada y crea/actualiza grupos + alumnos en Supabase.
export async function PUT(request: Request) {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { carpetaId, carpetaNombre, accessToken, archivos } = await request.json();
  if (!carpetaId || !accessToken || !Array.isArray(archivos)) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  await supabase.from('profesores_config').upsert({
    id: session.user.id,
    carpeta_id: carpetaId,
    carpeta_nombre: carpetaNombre || carpetaId,
    updated_at: new Date().toISOString()
  });

  for (const archivo of archivos) {
    const { data: grupo } = await supabase
      .from('grupos')
      .upsert(
        {
          profesor_id: session.user.id,
          archivo_id_nube: archivo.id,
          nombre: archivo.nombre,
          activo: true,
          ultima_sync: new Date().toISOString()
        },
        { onConflict: 'profesor_id,archivo_id_nube' }
      )
      .select('id')
      .single();

    if (!grupo) continue;

    // Evita duplicar alumnos si el grupo ya existía.
    const { count } = await supabase
      .from('alumnos')
      .select('id', { count: 'exact', head: true })
      .eq('grupo_id', grupo.id);

    if (!count) {
      const nombres = await leerAlumnosDeArchivo(accessToken, archivo.id, archivo.mimeType);
      const filas = nombres.map((nombre, orden) => ({ grupo_id: grupo.id, nombre, orden }));
      if (filas.length > 0) await supabase.from('alumnos').insert(filas);
    }
  }

  // Marca como inactivos los grupos cuyo archivo ya no está en la carpeta (borrados en Drive).
  const idsVigentes = archivos.map((a: any) => a.id);
  const { data: gruposExistentes } = await supabase
    .from('grupos')
    .select('id, archivo_id_nube')
    .eq('profesor_id', session.user.id);

  const aDesactivar = (gruposExistentes || [])
    .filter((g) => !idsVigentes.includes(g.archivo_id_nube))
    .map((g) => g.id);

  if (aDesactivar.length > 0) {
    await supabase.from('grupos').update({ activo: false }).in('id', aDesactivar);
  }

  return NextResponse.json({ ok: true });
}

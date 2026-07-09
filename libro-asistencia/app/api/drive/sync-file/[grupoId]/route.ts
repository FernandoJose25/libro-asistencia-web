import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { escribirAsistenciaEnArchivo } from '@/lib/drive';

export async function POST(request: Request, { params }: { params: { grupoId: string } }) {
  const supabase = supabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { accessToken } = await request.json();
  if (!accessToken) return NextResponse.json({ error: 'Falta accessToken' }, { status: 400 });

  const { data: grupo } = await supabase
    .from('grupos')
    .select('id, archivo_id_nube, profesor_id')
    .eq('id', params.grupoId)
    .single();

  if (!grupo || grupo.profesor_id !== session.user.id) {
    return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
  }

  const hoy = new Date().toISOString().slice(0, 10);

  const { data: alumnos } = await supabase
    .from('alumnos')
    .select('id, nombre, orden')
    .eq('grupo_id', grupo.id)
    .order('orden');

  const { data: registros } = await supabase
    .from('registros_asistencia')
    .select('alumno_id, estatus')
    .eq('fecha', hoy)
    .in('alumno_id', (alumnos || []).map((a) => a.id));

  const mapaEstatus = new Map((registros || []).map((r) => [r.alumno_id, r.estatus]));
  const filas = (alumnos || []).map((a) => ({
    nombre: a.nombre,
    estatus: mapaEstatus.get(a.id) || 'falto'
  }));

  try {
    await escribirAsistenciaEnArchivo(accessToken, grupo.archivo_id_nube, filas);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error escribiendo en Drive' }, { status: 502 });
  }

  await supabase.from('grupos').update({ ultima_sync: new Date().toISOString() }).eq('id', grupo.id);

  return NextResponse.json({ ok: true });
}

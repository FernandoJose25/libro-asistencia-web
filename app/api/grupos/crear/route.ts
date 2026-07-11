import { NextResponse } from 'next/server';
import { contextoDrive } from '@/lib/driveContext';
import { crearArchivoAsistenciaDesdeCero, MIME_XLSX } from '@/lib/drive';

export async function POST(request: Request) {
    const ctx = await contextoDrive();
    if (ctx.error) return ctx.error;
    const { session, accessToken, supabase } = ctx;

    const { nombre, alumnos, carpetaId } = await request.json();
    if (!nombre) {
        return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const nombresLimpios: string[] = Array.isArray(alumnos)
        ? alumnos.map((n: string) => (n || '').trim()).filter((n: string) => n.length > 0)
        : [];

    let archivo;
    try {
        archivo = await crearArchivoAsistenciaDesdeCero(accessToken, nombre, nombresLimpios, carpetaId);
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'No se pudo crear el archivo en Drive' }, { status: 502 });
    }

    const { data: grupo, error } = await supabase
        .from('grupos')
        .insert({
            profesor_id: session.user.id,
            archivo_id_nube: archivo.id,
            archivo_mime_type: MIME_XLSX,
            nombre,
            activo: true,
            ultima_sync: new Date().toISOString()
        })
        .select('id')
        .single();

    if (error || !grupo) {
        return NextResponse.json({ error: error?.message || 'No se pudo crear el grupo' }, { status: 500 });
    }

    if (nombresLimpios.length > 0) {
        await supabase.from('alumnos').insert(
            nombresLimpios.map((n, orden) => ({ grupo_id: grupo.id, nombre: n, orden }))
        );
    }

    return NextResponse.json({ grupoId: grupo.id });
}

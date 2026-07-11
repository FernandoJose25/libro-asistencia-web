import { NextResponse } from 'next/server';
import { contextoDrive } from '@/lib/driveContext';
import { crearCarpetaGrupo } from '@/lib/driveAsistencia';
import { MIME_FOLDER } from '@/lib/drive';
import { sanitizarNombreArchivo } from '@/lib/utils';

export async function POST(request: Request) {
    const ctx = await contextoDrive();
    if (ctx.error) return ctx.error;
    const { session, accessToken, supabase } = ctx;

    const { nombre } = await request.json();
    if (!nombre) {
        return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    let carpetaId: string;
    try {
        carpetaId = await crearCarpetaGrupo(accessToken, sanitizarNombreArchivo(nombre));
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'No se pudo crear la carpeta en Drive' }, { status: 502 });
    }

    // archivo_id_nube pertenece al sistema clásico de Grupos (un archivo
    // .xlsx); un grupo nuevo ya no tiene uno, así que se usa el id de la
    // carpeta como valor único de todos modos (satisface el unique
    // (profesor_id, archivo_id_nube) sin crear un archivo real).
    const { data: grupo, error } = await supabase
        .from('grupos')
        .insert({
            profesor_id: session.user.id,
            archivo_id_nube: carpetaId,
            archivo_mime_type: MIME_FOLDER,
            carpeta_drive_id: carpetaId,
            nombre,
            activo: true,
            ultima_sync: new Date().toISOString()
        })
        .select('id')
        .single();

    if (error || !grupo) {
        return NextResponse.json({ error: error?.message || 'No se pudo crear el grupo' }, { status: 500 });
    }

    return NextResponse.json({ grupoId: grupo.id });
}

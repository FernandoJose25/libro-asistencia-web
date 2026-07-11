import { NextResponse } from 'next/server';
import { contextoSesion } from '@/lib/driveContext';

// Guarda la configuración de un grupo (umbral de riesgo, horas de clase por
// semana, tope de faltas del semestre). No habla con Drive, por eso usa
// contextoSesion() y no contextoDrive().
export async function POST(request: Request, { params }: { params: { id: string } }) {
    const ctx = await contextoSesion();
    if (ctx.error) return ctx.error;
    const { session, supabase } = ctx;

    const { umbralFaltaPorcentaje, horasClaseSemana, faltasPermitidasSemestre } = await request.json();

    const cambios: Record<string, number> = {};
    if (umbralFaltaPorcentaje !== undefined) cambios.umbral_falta_porcentaje = Number(umbralFaltaPorcentaje);
    if (horasClaseSemana !== undefined) cambios.horas_clase_semana = Number(horasClaseSemana);
    if (faltasPermitidasSemestre !== undefined) cambios.faltas_permitidas_semestre = Number(faltasPermitidasSemestre);

    if (Object.keys(cambios).length === 0) {
        return NextResponse.json({ error: 'Nada que guardar' }, { status: 400 });
    }

    const { error } = await supabase
        .from('grupos')
        .update(cambios)
        .eq('id', params.id)
        .eq('profesor_id', session.user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
}

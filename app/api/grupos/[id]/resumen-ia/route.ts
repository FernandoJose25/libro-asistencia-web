import { NextResponse } from 'next/server';
import { contextoSesion } from '@/lib/driveContext';

// Genera un resumen en lenguaje natural de la asistencia de un grupo, con los
// datos que existen HASTA EL MOMENTO en que se genera — nunca proyecta ni
// inventa clases futuras, porque simplemente no hay registros de ellas
// todavía. El componente que llama a este endpoint es responsable de dejar
// claro en pantalla la fecha de corte (ver AiSummaryButton.tsx).
export async function POST(request: Request, { params }: { params: { id: string } }) {
    const ctx = await contextoSesion();
    if (ctx.error) return ctx.error;
    const { session, supabase } = ctx;

    const { data: grupo } = await supabase
        .from('grupos')
        .select('id, nombre, umbral_falta_porcentaje')
        .eq('id', params.id)
        .eq('profesor_id', session.user.id)
        .single();

    if (!grupo) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });

    const { data: riesgo } = await supabase
        .from('riesgo_por_alumno_v2')
        .select('nombre, horas_falta_total, tardanzas_total:horas_falta_total, porcentaje_falta, en_riesgo')
        .eq('grupo_id', grupo.id);

    const { data: sesiones } = await supabase
        .from('asistencia_registros')
        .select('fecha, clase')
        .eq('grupo_id', grupo.id)
        .order('fecha');

    if (!process.env.GROQ_API_KEY) {
        return NextResponse.json(
            { error: 'Falta configurar GROQ_API_KEY en las variables de entorno.' },
            { status: 500 }
        );
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const sesionesUnicas = new Set((sesiones || []).map((s) => `${s.fecha}-${s.clase}`));
    const totalSesiones = sesionesUnicas.size;
    const enRiesgo = (riesgo || []).filter((r) => r.en_riesgo);

    const datosParaLaIA = {
        curso: grupo.nombre,
        fecha_de_corte: hoy,
        clases_dictadas: totalSesiones,
        horas_dictadas_total: totalSesiones,
        umbral_de_riesgo_configurado: `${grupo.umbral_falta_porcentaje}%`,
        alumnos: (riesgo || []).map((r) => ({
            nombre: r.nombre,
            horas_falta: r.horas_falta_total,
            porcentaje_falta: r.porcentaje_falta,
            en_riesgo: r.en_riesgo
        }))
    };

    const prompt = `Eres un asistente que ayuda a un profesor peruano a interpretar los datos de asistencia de su curso.
Con el siguiente JSON, escribe un resumen breve en español (máximo 120 palabras, en prosa, sin bullets),
mencionando: el % de asistencia general, quién(es) están en riesgo (si hay alguno) y cualquier patrón que notes.
No inventes datos que no estén en el JSON. No menciones nada sobre clases futuras, porque no existen todavía.

${JSON.stringify(datosParaLaIA, null, 2)}`;

    try {
        const respuesta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.4,
                max_tokens: 300
            })
        });

        if (!respuesta.ok) {
            const texto = await respuesta.text();
            return NextResponse.json({ error: `Groq respondió con error: ${texto}` }, { status: 502 });
        }

        const data = await respuesta.json();
        const resumen = data.choices?.[0]?.message?.content?.trim() || 'No se pudo generar el resumen.';

        return NextResponse.json({
            resumen,
            generadoEl: new Date().toISOString(),
            cubreHasta: hoy,
            totalEnRiesgo: enRiesgo.length
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'No se pudo generar el resumen' }, { status: 502 });
    }
}

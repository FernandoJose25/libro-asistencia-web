import { NextResponse } from 'next/server';
import { contextoSesion } from '@/lib/driveContext';
import { fechaLocalISO, ZONA_HORARIA } from '@/lib/utils';

// Resumen de asistencia de un grupo en un periodo (desde/hasta, opcionales),
// con los datos que existen HASTA EL MOMENTO en que se genera — nunca
// proyecta ni inventa clases futuras, porque no hay registros de ellas.
//
// Devuelve dos cosas:
// - La lista por alumno, en orden alfabético, con las asistencias tal como se
//   reportan en el sistema de la escuela: asistió + retardos + faltas
//   justificadas, contadas por hora de clase. La calcula este código, no la
//   IA, para que los números sean exactos.
// - Un comentario breve escrito por la IA. Si la IA falla, la lista sale igual.
export async function POST(request: Request, { params }: { params: { id: string } }) {
    const ctx = await contextoSesion();
    if (ctx.error) return ctx.error;
    const { session, supabase } = ctx;

    const body = await request.json().catch(() => ({}));
    const fechaValida = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const hoy = fechaLocalISO(new Date(), ZONA_HORARIA);
    const desdePedido = fechaValida(body?.desde);
    const hasta = fechaValida(body?.hasta) || hoy;
    if (desdePedido && desdePedido > hasta) {
        return NextResponse.json({ error: 'La fecha "Desde" no puede ser posterior a "Hasta".' }, { status: 400 });
    }

    const { data: grupo } = await supabase
        .from('grupos')
        .select('id, nombre')
        .eq('id', params.id)
        .eq('profesor_id', session.user.id)
        .single();

    if (!grupo) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });

    const [{ data: alumnos }, { data: riesgo }] = await Promise.all([
        supabase.from('alumnos').select('id, nombre, apellidos, nombres').eq('grupo_id', grupo.id),
        supabase.from('riesgo_por_alumno_v2').select('alumno_id, en_riesgo').eq('grupo_id', grupo.id)
    ]);

    // Supabase devuelve como máximo 1000 filas por consulta: se piden por páginas.
    const registros: { alumno_id: string; fecha: string; clase: number; estatus: string; justificada: boolean }[] = [];
    for (let inicio = 0; ; inicio += 1000) {
        let consulta = supabase
            .from('asistencia_registros')
            .select('alumno_id, fecha, clase, estatus, justificada')
            .eq('grupo_id', grupo.id)
            .lte('fecha', hasta);
        if (desdePedido) consulta = consulta.gte('fecha', desdePedido);
        const { data, error } = await consulta.order('fecha').order('id').range(inicio, inicio + 999);
        if (error) return NextResponse.json({ error: `No se pudo leer la asistencia: ${error.message}` }, { status: 500 });
        registros.push(...(data || []));
        if (!data || data.length < 1000) break;
    }

    const conteos = new Map<string, { asistio: number; retardos: number; justificadas: number; faltas: number }>();
    registros.forEach((r) => {
        const c = conteos.get(r.alumno_id) || { asistio: 0, retardos: 0, justificadas: 0, faltas: 0 };
        if (r.estatus === 'asistio') c.asistio++;
        else if (r.estatus === 'tardanza') c.retardos++;
        else if (r.justificada) c.justificadas++;
        else c.faltas++;
        conteos.set(r.alumno_id, c);
    });

    const enRiesgo = new Set((riesgo || []).filter((r) => r.en_riesgo).map((r) => r.alumno_id));
    const lista = (alumnos || [])
        .map((a) => {
            const c = conteos.get(a.id) || { asistio: 0, retardos: 0, justificadas: 0, faltas: 0 };
            return {
                id: a.id,
                nombre: a.apellidos && a.nombres ? `${a.apellidos}, ${a.nombres}` : a.nombre,
                asistencias: c.asistio + c.retardos + c.justificadas,
                retardos: c.retardos,
                justificadas: c.justificadas,
                faltas: c.faltas,
                enRiesgo: enRiesgo.has(a.id)
            };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

    const clases = new Set(registros.map((r) => `${r.fecha}|${r.clase}`)).size;
    // Sin "Desde", el periodo empieza en la primera clase registrada.
    const desde = desdePedido || registros[0]?.fecha || null;
    const respuestaBase = { curso: grupo.nombre, generadoEl: new Date().toISOString(), desde, hasta, clases, alumnos: lista };

    if (clases === 0) {
        return NextResponse.json({ ...respuestaBase, resumen: null, avisoIA: 'No hay asistencia registrada en ese periodo.' });
    }
    if (!process.env.GROQ_API_KEY) {
        return NextResponse.json({ ...respuestaBase, resumen: null, avisoIA: 'Falta configurar GROQ_API_KEY para el comentario de la IA.' });
    }

    const horasRegistradas = lista.reduce((s, a) => s + a.asistencias + a.faltas, 0);
    const horasAsistidas = lista.reduce((s, a) => s + a.asistencias, 0);
    const datosParaLaIA = {
        curso: grupo.nombre,
        periodo: desdePedido ? `del ${desde} al ${hasta}` : `desde el inicio (${desde}) hasta ${hasta}`,
        horas_de_clase_en_el_periodo: clases,
        porcentaje_asistencia_general: horasRegistradas ? Math.round((1000 * horasAsistidas) / horasRegistradas) / 10 : 0,
        alumnos: lista.map((a) => ({
            nombre: a.nombre,
            asistencias: a.asistencias,
            de_ellas_retardos: a.retardos,
            de_ellas_faltas_justificadas: a.justificadas,
            faltas_sin_justificar: a.faltas,
            en_riesgo_en_el_curso: a.enRiesgo
        }))
    };

    const prompt = `Eres un asistente que ayuda a un profesor a interpretar la asistencia de su curso en un periodo.
Con el siguiente JSON, escribe un comentario breve en español (máximo 100 palabras, en prosa, sin bullets ni tablas),
mencionando: el porcentaje de asistencia general (usa el valor dado, no lo recalcules), quiénes tienen más faltas sin justificar
en el periodo, quién(es) están en riesgo en el curso (si hay alguno) y cualquier patrón que notes.
No enumeres a todos los alumnos: la lista completa ya se muestra aparte. Usa solo las cifras del JSON, no inventes datos.
No menciones nada sobre clases futuras, porque no existen todavía.

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
            return NextResponse.json({ ...respuestaBase, resumen: null, avisoIA: 'La IA no respondió esta vez; la lista sí está completa.' });
        }

        const data = await respuesta.json();
        const resumen: string | null = data.choices?.[0]?.message?.content?.trim() || null;
        return NextResponse.json({ ...respuestaBase, resumen, avisoIA: resumen ? undefined : 'La IA no devolvió comentario.' });
    } catch {
        return NextResponse.json({ ...respuestaBase, resumen: null, avisoIA: 'La IA no respondió esta vez; la lista sí está completa.' });
    }
}

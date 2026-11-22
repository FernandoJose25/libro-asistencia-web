// RUTA: app/dashboard/alumnos/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { Topbar } from '@/components/Topbar';
import { AlumnosReportTable, type DetalleFechas, type FilaReporteAlumno } from '@/components/AlumnosReportTable';
import { ImportarAlumnosModal } from '@/components/ImportarAlumnosModal';
import type { MotivoJustificacion } from '@/components/JustificarPopover';
import { MOTIVO_LABEL } from '@/lib/formatearAsistenciaExport';

export default async function AlumnosPage() {
    const supabase = supabaseServer();
    const {
        data: { session }
    } = await supabase.auth.getSession();
    if (!session) redirect('/login');

    // reporte_asistencia_alumno_v2 ya trae días de asistencia/tardanza/falta y
    // el tope de faltas permitidas según horas_clase_semana del grupo (las
    // faltas justificadas no cuentan). RLS se encarga de que solo salgan
    // alumnos de grupos de este profesor.
    const { data: reporte } = await supabase
        .from('reporte_asistencia_alumno_v2')
        .select(
            'alumno_id, nombre, grupo_id, grupo_nombre, horas_clase_semana, faltas_permitidas_semestre, dias_asistio, dias_tardanza, dias_falto, horas_falta_acumuladas, horas_falta_restantes'
        );

    // apellidos/nombres no están en la vista (agregados después); se cruzan
    // aparte para no tener que tocar reporte_asistencia_alumno_v2.
    const { data: alumnosDetalle } = await supabase.from('alumnos').select('id, apellidos, nombres, orden');
    const detalleNombre: Record<string, { apellidos: string | null; nombres: string | null; orden: number }> = {};
    (alumnosDetalle || []).forEach((a: any) => {
        detalleNombre[a.id] = { apellidos: a.apellidos, nombres: a.nombres, orden: a.orden ?? 0 };
    });

    const filas = (reporte || []).map((f: any) => ({
        ...f,
        apellidos: detalleNombre[f.alumno_id]?.apellidos ?? null,
        nombres: detalleNombre[f.alumno_id]?.nombres ?? null,
        orden: detalleNombre[f.alumno_id]?.orden ?? 0
    })) as FilaReporteAlumno[];

    // Fechas exactas de cada falta/tardanza, para poder mostrarlas como
    // evidencia si el alumno pregunta o reclama qué día faltó. Supabase
    // devuelve como máximo 1000 filas por consulta, así que se piden por
    // páginas: el filtro de periodo necesita también las fechas más viejas.
    // Las faltas justificadas van aparte: no son faltas y suman al total de asistencias.
    const registros: {
        alumno_id: string;
        fecha: string;
        estatus: string;
        justificada: boolean;
        justificacion_motivo: MotivoJustificacion | null;
    }[] = [];
    for (let inicio = 0; ; inicio += 1000) {
        const { data } = await supabase
            .from('asistencia_registros')
            .select('alumno_id, fecha, estatus, justificada, justificacion_motivo')
            .in('estatus', ['falto', 'tardanza'])
            .order('fecha', { ascending: false })
            .order('id')
            .range(inicio, inicio + 999);
        registros.push(...(data || []));
        if (!data || data.length < 1000) break;
    }

    const detalles: Record<string, DetalleFechas> = {};
    registros.forEach((r) => {
        if (!detalles[r.alumno_id]) detalles[r.alumno_id] = { faltas: [], tardanzas: [], justificadas: [] };
        if (r.estatus === 'tardanza') detalles[r.alumno_id].tardanzas.push(r.fecha);
        else if (r.justificada)
            detalles[r.alumno_id].justificadas.push({ fecha: r.fecha, motivo: MOTIVO_LABEL[r.justificacion_motivo || 'otro'] || 'Otro' });
        else detalles[r.alumno_id].faltas.push(r.fecha);
    });

    const grupos = Array.from(
        new Map(filas.map((f) => [f.grupo_id, { id: f.grupo_id, nombre: f.grupo_nombre }])).values()
    ).sort((a, b) => a.nombre.localeCompare(b.nombre));

    const enRiesgo = filas.filter((f) => f.horas_falta_restantes <= 0).length;
    const inicial = (session.user.email || 'P')[0].toUpperCase();

    // Distingue "no tienes grupos" de "tus grupos existen pero están vacíos",
    // para no mandar al profesor a "crear un curso" cuando ya lo creó y solo
    // le falta agregar alumnos dentro.
    const { data: gruposTodos, count: totalGrupos } = await supabase
        .from('grupos')
        .select('id, nombre', { count: 'exact' });

    // Para el modal de importar se usa la lista completa de grupos del
    // profesor (no solo los que ya tienen alumnos con asistencia, como
    // "grupos" derivado de "filas"), para poder importar hacia un grupo
    // recién creado y vacío.
    const gruposParaImportar = (gruposTodos || [])
        .map((g) => ({ id: g.id, nombre: g.nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

    return (
        <>
            <Topbar breadcrumb="Alumnos" inicial={inicial} />
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-[1020px] mx-auto px-4 md:px-8 py-5 md:py-7 pb-14">
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                        <h2 className="text-xl font-bold">Alumnos</h2>
                        <ImportarAlumnosModal grupos={gruposParaImportar} />
                    </div>
                    <p className="text-[13px] text-inkSoft mb-5">
                        Reporte de asistencia de todos tus alumnos, con las fechas exactas de cada falta y tardanza.
                    </p>

                    {filas.length === 0 ? (
                        <div className="bg-white border border-border rounded-card p-5 text-sm text-inkSoft">
                            {totalGrupos && totalGrupos > 0 ? (
                                <>
                                    Ya tienes {totalGrupos} grupo(s) creado(s), pero todavía no tienen alumnos. Ve a{' '}
                                    <Link href="/dashboard/grupos" className="text-goldDark font-semibold">
                                        Grupos
                                    </Link>
                                    , abre cada curso con la flechita y agrega sus alumnos con "+ Agregar".
                                </>
                            ) : (
                                <>
                                    Todavía no hay alumnos registrados. Ve a{' '}
                                    <Link href="/dashboard/grupos" className="text-goldDark font-semibold">
                                        Grupos
                                    </Link>{' '}
                                    para crear un curso y agregarle alumnos.
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            {enRiesgo > 0 && (
                                <div className="bg-red/10 border border-red/30 rounded-card p-3.5 mb-5 text-sm text-red font-semibold">
                                    ⚠️ {enRiesgo} alumno(s) ya llegaron o pasaron el tope de faltas permitidas del semestre.
                                </div>
                            )}
                            <AlumnosReportTable filas={filas} detalles={detalles} grupos={grupos} />
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

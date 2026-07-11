// RUTA: app/dashboard/alumnos/page.tsx
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { Topbar } from '@/components/Topbar';
import { AlumnosReportTable, type DetalleFechas, type FilaReporteAlumno } from '@/components/AlumnosReportTable';
import { GestionAlumnosGrupo } from '@/components/GestionAlumnosGrupo';

export default async function AlumnosPage() {
    const supabase = supabaseServer();
    const {
        data: { session }
    } = await supabase.auth.getSession();
    if (!session) redirect('/login');

    // reporte_asistencia_alumno ya trae días de asistencia/tardanza/falta y el
    // tope de faltas permitidas según horas_clase_semana del grupo. RLS se
    // encarga de que solo salgan alumnos de grupos de este profesor.
    const { data: reporte } = await supabase
        .from('reporte_asistencia_alumno')
        .select(
            'alumno_id, nombre, grupo_id, grupo_nombre, horas_clase_semana, faltas_permitidas_semestre, dias_asistio, dias_tardanza, dias_falto, horas_falta_acumuladas, horas_falta_restantes'
        );

    const filas = (reporte || []) as FilaReporteAlumno[];

    // Fechas exactas de cada falta/tardanza, para poder mostrarlas como
    // evidencia si el alumno pregunta o reclama qué día faltó.
    const { data: registros } = await supabase
        .from('registros_asistencia')
        .select('alumno_id, fecha, estatus')
        .in('estatus', ['falto', 'tardanza'])
        .order('fecha', { ascending: false });

    const detalles: Record<string, DetalleFechas> = {};
    (registros || []).forEach((r: any) => {
        if (!detalles[r.alumno_id]) detalles[r.alumno_id] = { faltas: [], tardanzas: [] };
        if (r.estatus === 'falto') detalles[r.alumno_id].faltas.push(r.fecha);
        else detalles[r.alumno_id].tardanzas.push(r.fecha);
    });

    const grupos = Array.from(
        new Map(filas.map((f) => [f.grupo_id, { id: f.grupo_id, nombre: f.grupo_nombre }])).values()
    ).sort((a, b) => a.nombre.localeCompare(b.nombre));

    const enRiesgo = filas.filter((f) => f.horas_falta_restantes <= 0).length;
    const inicial = (session.user.email || 'P')[0].toUpperCase();

    // Gestión de grupos/alumnos: todos los grupos del profesor (activos e
    // inactivos), con sus alumnos, para crear/editar/reordenar desde aquí.
    const { data: gruposTodos } = await supabase
        .from('grupos')
        .select('id, nombre, activo, umbral_falta_porcentaje')
        .order('nombre');

    const { data: alumnosTodos } = await supabase
        .from('alumnos')
        .select('id, grupo_id, nombre, orden')
        .order('orden');

    const gruposConAlumnos = (gruposTodos || []).map((g) => ({
        ...g,
        alumnos: (alumnosTodos || []).filter((a) => a.grupo_id === g.id)
    }));

    return (
        <>
            <Topbar breadcrumb="Alumnos" inicial={inicial} />
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-[1020px] mx-auto px-8 py-7 pb-14">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-xl font-bold">Alumnos</h2>
                    </div>
                    <p className="text-[13px] text-inkSoft mb-5">
                        Reporte de asistencia de todos tus alumnos, con las fechas exactas de cada falta y tardanza.
                    </p>

                    <GestionAlumnosGrupo grupos={gruposConAlumnos} />

                    {filas.length === 0 ? (
                        <div className="bg-white border border-border rounded-card p-5 text-sm text-inkSoft">
                            Todavía no hay alumnos registrados. Crea un grupo arriba y agrégale alumnos.
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

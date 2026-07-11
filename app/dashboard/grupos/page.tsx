// RUTA: app/dashboard/grupos/page.tsx
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { Topbar } from '@/components/Topbar';
import { GestionAlumnosGrupo } from '@/components/GestionAlumnosGrupo';

export default async function GruposPage() {
    const supabase = supabaseServer();
    const {
        data: { session }
    } = await supabase.auth.getSession();
    if (!session) redirect('/login');

    const { data: gruposTodos } = await supabase
        .from('grupos')
        .select('id, nombre, activo, umbral_falta_porcentaje, horas_clase_semana, faltas_permitidas_semestre')
        .order('nombre');

    const { data: alumnosTodos } = await supabase
        .from('alumnos')
        .select('id, grupo_id, nombre, orden')
        .order('orden');

    const gruposConAlumnos = (gruposTodos || []).map((g) => ({
        ...g,
        alumnos: (alumnosTodos || []).filter((a) => a.grupo_id === g.id)
    }));

    const inicial = (session.user.email || 'P')[0].toUpperCase();

    return (
        <>
            <Topbar breadcrumb="Grupos" inicial={inicial} />
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-[1020px] mx-auto px-8 py-7 pb-14">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-xl font-bold">Grupos</h2>
                    </div>
                    <p className="text-[13px] text-inkSoft mb-5">
                        Crea tus cursos, gestiona sus alumnos y configura el umbral de riesgo, horas de clase por semana y
                        tope de faltas permitidas por semestre.
                    </p>

                    <GestionAlumnosGrupo grupos={gruposConAlumnos} />
                </div>
            </div>
        </>
    );
}

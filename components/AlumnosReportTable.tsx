// RUTA: components/AlumnosReportTable.tsx
'use client';

import { useMemo, useState } from 'react';
import { exportarReporteAlumnoPDF } from '@/lib/exportReporteAlumno';

export interface FilaReporteAlumno {
    alumno_id: string;
    nombre: string;
    grupo_id: string;
    grupo_nombre: string;
    horas_clase_semana: number;
    faltas_permitidas_semestre: number;
    dias_asistio: number;
    dias_tardanza: number;
    dias_falto: number;
    horas_falta_acumuladas: number;
    horas_falta_restantes: number;
}

export interface DetalleFechas {
    faltas: string[]; // YYYY-MM-DD, más reciente primero
    tardanzas: string[];
}

function formatearFecha(iso: string) {
    const [anio, mes, dia] = iso.split('-').map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    return fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function claseRiesgo(horasRestantes: number) {
    if (horasRestantes <= 0) return 'text-red font-bold';
    if (horasRestantes <= 3) return 'text-amber font-semibold';
    return 'text-green font-semibold';
}

export function AlumnosReportTable({
    filas,
    detalles,
    grupos
}: {
    filas: FilaReporteAlumno[];
    detalles: Record<string, DetalleFechas>;
    grupos: { id: string; nombre: string }[];
}) {
    const [grupoFiltro, setGrupoFiltro] = useState<string>('todos');
    const [busqueda, setBusqueda] = useState('');
    const [expandido, setExpandido] = useState<string | null>(null);

    const filtradas = useMemo(() => {
        return filas
            .filter((f) => grupoFiltro === 'todos' || f.grupo_id === grupoFiltro)
            .filter((f) => f.nombre.toLowerCase().includes(busqueda.toLowerCase()))
            .sort((a, b) => a.horas_falta_restantes - b.horas_falta_restantes);
    }, [filas, grupoFiltro, busqueda]);

    function exportarReporte(f: FilaReporteAlumno) {
        const detalle = detalles[f.alumno_id] || { faltas: [], tardanzas: [] };
        exportarReporteAlumnoPDF({
            nombre: f.nombre,
            grupoNombre: f.grupo_nombre,
            diasAsistio: f.dias_asistio,
            diasTardanza: f.dias_tardanza,
            diasFalto: f.dias_falto,
            horasFaltaAcumuladas: f.horas_falta_acumuladas,
            horasFaltaRestantes: f.horas_falta_restantes,
            faltasPermitidasSemestre: f.faltas_permitidas_semestre,
            faltas: detalle.faltas.map(formatearFecha),
            tardanzas: detalle.tardanzas.map(formatearFecha)
        });
    }

    return (
        <div>
            <div className="flex items-center gap-2.5 mb-4">
                <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar alumno…"
                    className="px-3 py-2 border border-border rounded-md text-sm w-[220px]"
                />
                <select
                    value={grupoFiltro}
                    onChange={(e) => setGrupoFiltro(e.target.value)}
                    className="px-3 py-2 border border-border rounded-md text-sm bg-white"
                >
                    <option value="todos">Todos los grupos</option>
                    {grupos.map((g) => (
                        <option key={g.id} value={g.id}>
                            {g.nombre}
                        </option>
                    ))}
                </select>
                <span className="text-[12.5px] text-inkSoft ml-auto">
                    {filtradas.length} alumno{filtradas.length === 1 ? '' : 's'}
                </span>
            </div>

            <div className="bg-white border border-border rounded-card overflow-hidden">
                <div className="grid grid-cols-[1.6fr_1.2fr_0.7fr_0.7fr_0.9fr_1fr] gap-2 px-4 py-2.5 text-[10.5px] uppercase tracking-wide text-inkSoft border-b border-border bg-bg/60">
                    <div>Alumno</div>
                    <div>Grupo</div>
                    <div className="text-center">Tardanzas</div>
                    <div className="text-center">Faltas</div>
                    <div className="text-center">Horas de falta</div>
                    <div className="text-right">Faltas restantes</div>
                </div>

                {filtradas.length === 0 && (
                    <div className="p-4 text-sm text-inkSoft">No hay alumnos que coincidan con el filtro.</div>
                )}

                {filtradas.map((f, i) => {
                    const detalle = detalles[f.alumno_id] || { faltas: [], tardanzas: [] };
                    const abierto = expandido === f.alumno_id;
                    return (
                        <div key={f.alumno_id} className={i > 0 ? 'border-t border-border' : ''}>
                            <button
                                onClick={() => setExpandido(abierto ? null : f.alumno_id)}
                                className="w-full grid grid-cols-[1.6fr_1.2fr_0.7fr_0.7fr_0.9fr_1fr] gap-2 px-4 py-3 text-sm text-left hover:bg-black/[0.02] items-center"
                            >
                                <span className="font-semibold flex items-center gap-1.5">
                                    <span className={`text-[10px] transition-transform ${abierto ? 'rotate-90' : ''}`}>▶</span>
                                    {f.nombre}
                                </span>
                                <span className="text-inkSoft truncate">{f.grupo_nombre}</span>
                                <span className="text-center text-amber font-semibold">{f.dias_tardanza}</span>
                                <span className="text-center text-red font-semibold">{f.dias_falto}</span>
                                <span className="text-center">{f.horas_falta_acumuladas}</span>
                                <span className={`text-right ${claseRiesgo(f.horas_falta_restantes)}`}>
                                    {f.horas_falta_restantes} / {f.faltas_permitidas_semestre}
                                </span>
                            </button>

                            {abierto && (
                                <div className="px-4 pb-4 pt-1 bg-bg/40 text-[12.5px]">
                                    <div className="flex justify-end mb-3">
                                        <button
                                            onClick={() => exportarReporte(f)}
                                            className="px-3 py-1.5 rounded-md border border-border text-xs font-semibold bg-white"
                                        >
                                            📄 Reporte para apoderado (PDF)
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-red font-semibold mb-1.5">Faltó ({detalle.faltas.length})</div>
                                        {detalle.faltas.length === 0 && <div className="text-inkSoft">Sin faltas registradas.</div>}
                                        <ul className="flex flex-col gap-1">
                                            {detalle.faltas.map((d) => (
                                                <li key={d} className="text-ink">
                                                    {formatearFecha(d)}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <div className="text-amber font-semibold mb-1.5">Llegó tarde ({detalle.tardanzas.length})</div>
                                        {detalle.tardanzas.length === 0 && <div className="text-inkSoft">Sin tardanzas registradas.</div>}
                                        <ul className="flex flex-col gap-1">
                                            {detalle.tardanzas.map((d) => (
                                                <li key={d} className="text-ink">
                                                    {formatearFecha(d)}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <p className="text-[11.5px] text-inkSoft mt-3">
                "Faltas restantes" = tope permitido según horas de clase semanales (horas × 3 por semestre) menos las horas de
                falta acumuladas. Un día de 2 horas seguidas cuenta como 2 si el alumno falta.
            </p>
        </div>
    );
}

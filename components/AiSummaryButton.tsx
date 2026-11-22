'use client';

import { useState } from 'react';
import { copiarTablaParaExcel, exportarResumenPeriodoExcel, filasResumenPeriodo } from '@/lib/exportAsistencia';
import { sanitizarNombreArchivo } from '@/lib/utils';
import { Icono } from './Icono';

interface AlumnoResumen {
    id: string;
    nombre: string;
    asistencias: number; // asistió + retardos + justificadas
    retardos: number;
    justificadas: number;
    faltas: number;
}

interface Resultado {
    curso: string;
    resumen: string | null;
    avisoIA?: string;
    generadoEl: string;
    desde: string | null;
    hasta: string;
    clases: number;
    alumnos: AlumnoResumen[];
}

function formatearFecha(iso: string) {
    const [anio, mes, dia] = iso.split('-').map(Number);
    return new Date(anio, mes - 1, dia).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function textoPeriodo(r: Resultado) {
    return r.desde ? `Del ${formatearFecha(r.desde)} al ${formatearFecha(r.hasta)}` : `Hasta el ${formatearFecha(r.hasta)}`;
}

function plural(n: number, singular: string, varios: string) {
    return `${n} ${n === 1 ? singular : varios}`;
}

export function AiSummaryButton({ grupoId }: { grupoId: string }) {
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [cargando, setCargando] = useState(false);
    const [resultado, setResultado] = useState<Resultado | null>(null);
    const [error, setError] = useState('');
    const [copiado, setCopiado] = useState<'ok' | 'error' | null>(null);

    const fechasInvertidas = !!desde && !!hasta && desde > hasta;

    async function generar() {
        setCargando(true);
        setError('');
        try {
            const res = await fetch(`/api/grupos/${grupoId}/resumen-ia`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ desde: desde || undefined, hasta: hasta || undefined })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data) {
                setError(data?.error || 'No se pudo generar el resumen.');
                return;
            }
            setResultado(data);
            setCopiado(null);
        } catch {
            setError('No se pudo generar el resumen. Revisa tu conexión.');
        } finally {
            setCargando(false);
        }
    }

    async function copiarParaExcel(r: Resultado) {
        try {
            await copiarTablaParaExcel(filasResumenPeriodo(r.alumnos));
            setCopiado('ok');
        } catch {
            setCopiado('error');
        }
    }

    function descargarExcel(r: Resultado) {
        const rango = r.desde ? `${r.desde}-al-${r.hasta}` : `hasta-${r.hasta}`;
        exportarResumenPeriodoExcel(
            `${sanitizarNombreArchivo(r.curso)}-asistencias-${rango}`,
            `${r.curso} — ${textoPeriodo(r)} (${plural(r.clases, 'hora de clase', 'horas de clase')})`,
            r.alumnos
        );
    }

    return (
        <div className="bg-white border border-border rounded-card p-4">
            <div className="flex items-center justify-between gap-3 mb-1">
                <div className="text-[11px] uppercase tracking-wide text-inkSoft">Resumen con IA</div>
                <button
                    onClick={generar}
                    disabled={cargando || fechasInvertidas}
                    className="px-3.5 py-1.5 rounded-md bg-navy text-white text-xs font-semibold disabled:opacity-60 shrink-0"
                >
                    {cargando ? 'Generando…' : resultado ? '↻ Volver a generar' : '✨ Generar resumen'}
                </button>
            </div>
            <p className="text-sm text-inkSoft">
                Lista en orden alfabético con las asistencias para reportar en el sistema de la escuela, y un comentario de la IA.
            </p>

            <div className="grid grid-cols-2 gap-2 mt-3 sm:flex sm:items-end sm:gap-3">
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-inkSoft min-w-0">
                    Desde
                    <input
                        type="date"
                        value={desde}
                        max={hasta || undefined}
                        onChange={(e) => setDesde(e.target.value)}
                        className="w-full min-w-0 px-3 py-2 border border-border rounded-md text-sm font-normal text-ink bg-white"
                    />
                </label>
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-inkSoft min-w-0">
                    Hasta
                    <input
                        type="date"
                        value={hasta}
                        min={desde || undefined}
                        onChange={(e) => setHasta(e.target.value)}
                        className="w-full min-w-0 px-3 py-2 border border-border rounded-md text-sm font-normal text-ink bg-white"
                    />
                </label>
            </div>
            <p className={`text-[12px] mt-1.5 ${fechasInvertidas ? 'text-red font-semibold' : 'text-inkSoft'}`}>
                {fechasInvertidas
                    ? 'La fecha "Desde" no puede ser posterior a "Hasta".'
                    : 'Elige el periodo (por ejemplo, el parcial). Sin "Desde" toma desde la primera clase; sin "Hasta", hasta hoy.'}
            </p>

            {error && <p className="text-sm text-red mt-2">{error}</p>}

            {resultado && (
                <div className="mt-3">
                    <div className="text-[11px] text-goldDark font-semibold bg-gold/10 border border-gold/30 rounded px-2.5 py-1.5 mb-2 inline-block">
                        {textoPeriodo(resultado)} · {plural(resultado.clases, 'hora de clase registrada', 'horas de clase registradas')} · generado el{' '}
                        {new Date(resultado.generadoEl).toLocaleString('es-PE')}
                    </div>

                    {resultado.resumen && <p className="text-sm leading-relaxed">{resultado.resumen}</p>}
                    {resultado.avisoIA && <p className="text-[12.5px] text-inkSoft">{resultado.avisoIA}</p>}

                    {resultado.clases > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => copiarParaExcel(resultado)}
                                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-md border border-border bg-white text-[13px] font-semibold hover:bg-bg"
                            >
                                <Icono nombre={copiado === 'ok' ? 'check' : 'copiar'} className={`w-4 h-4 ${copiado === 'ok' ? 'text-green' : ''}`} />
                                {copiado === 'ok' ? 'Copiado: pégalo en Excel' : 'Copiar para Excel'}
                            </button>
                            <button
                                onClick={() => descargarExcel(resultado)}
                                className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-md border border-border bg-white text-[13px] font-semibold hover:bg-bg"
                            >
                                <Icono nombre="descargar" className="w-4 h-4" />
                                Descargar Excel
                            </button>
                            {copiado === 'error' && (
                                <span className="text-[12px] text-red">No se pudo copiar; usa "Descargar Excel".</span>
                            )}
                        </div>
                    )}

                    {resultado.clases > 0 && (
                        <div className="mt-3 border border-border rounded-md overflow-hidden">
                            <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_3.5rem_3rem] gap-2 px-3 py-2 text-[10.5px] uppercase tracking-wide text-inkSoft bg-bg/60 border-b border-border">
                                <div>Nro</div>
                                <div>Alumno</div>
                                <div className="text-center">Asist.</div>
                                <div className="text-center">Faltas</div>
                            </div>
                            <ol>
                                {resultado.alumnos.map((a, i) => (
                                    <li
                                        key={a.id}
                                        className="grid grid-cols-[1.75rem_minmax(0,1fr)_3.5rem_3rem] gap-2 px-3 py-2 items-center text-sm border-b border-rule last:border-b-0"
                                    >
                                        <span className="text-inkSoft tabular-nums">{i + 1}</span>
                                        <span className="min-w-0">
                                            <span className="block leading-snug">{a.nombre}</span>
                                            {(a.retardos > 0 || a.justificadas > 0) && (
                                                <span className="block text-[11.5px] text-inkSoft">
                                                    incluye{' '}
                                                    {[
                                                        a.retardos > 0 && plural(a.retardos, 'retardo', 'retardos'),
                                                        a.justificadas > 0 && plural(a.justificadas, 'justificada', 'justificadas')
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' y ')}
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-center text-[16px] font-bold text-green tabular-nums">{a.asistencias}</span>
                                        <span className={`text-center tabular-nums ${a.faltas > 0 ? 'text-red font-semibold' : 'text-inkSoft'}`}>
                                            {a.faltas}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {resultado.clases > 0 && (
                        <p className="text-[11.5px] text-inkSoft mt-2">
                            Asistencias = asistió + retardos + faltas justificadas, contadas por hora de clase. Faltas = solo las no
                            justificadas.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

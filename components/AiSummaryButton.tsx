'use client';

import { useState } from 'react';

export function AiSummaryButton({ grupoId }: { grupoId: string }) {
    const [cargando, setCargando] = useState(false);
    const [resumen, setResumen] = useState<string | null>(null);
    const [cubreHasta, setCubreHasta] = useState<string | null>(null);
    const [generadoEl, setGeneradoEl] = useState<string | null>(null);
    const [error, setError] = useState('');

    async function generar() {
        setCargando(true);
        setError('');
        setResumen(null);
        try {
            const res = await fetch(`/api/grupos/${grupoId}/resumen-ia`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'No se pudo generar el resumen.');
                return;
            }
            setResumen(data.resumen);
            setCubreHasta(data.cubreHasta);
            setGeneradoEl(data.generadoEl);
        } finally {
            setCargando(false);
        }
    }

    return (
        <div className="bg-white border border-border rounded-card p-4">
            <div className="flex items-center justify-between mb-1">
                <div className="text-[11px] uppercase tracking-wide text-inkSoft">Resumen con IA</div>
                <button
                    onClick={generar}
                    disabled={cargando}
                    className="px-3.5 py-1.5 rounded-md bg-navy text-white text-xs font-semibold disabled:opacity-60"
                >
                    {cargando ? 'Generando…' : resumen ? '↻ Volver a generar' : '✨ Generar resumen'}
                </button>
            </div>

            {error && <p className="text-sm text-red mt-2">{error}</p>}

            {resumen && (
                <div className="mt-2">
                    <div className="text-[11px] text-goldDark font-semibold bg-gold/10 border border-gold/30 rounded px-2.5 py-1.5 mb-2 inline-block">
                        Generado el {generadoEl && new Date(generadoEl).toLocaleString('es-PE')} — cubre asistencia registrada
                        hasta hoy ({cubreHasta}). No incluye clases futuras.
                    </div>
                    <p className="text-sm leading-relaxed">{resumen}</p>
                </div>
            )}

            {!resumen && !error && !cargando && (
                <p className="text-sm text-inkSoft mt-1">
                    Genera un resumen en lenguaje natural con los datos registrados hasta hoy.
                </p>
            )}
        </div>
    );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NuevoGrupoModal() {
    const router = useRouter();
    const [abierto, setAbierto] = useState(false);
    const [nombre, setNombre] = useState('');
    const [alumnosTexto, setAlumnosTexto] = useState('');
    const [creando, setCreando] = useState(false);
    const [error, setError] = useState('');

    async function crear() {
        if (!nombre.trim()) { setError('Ponle un nombre al curso.'); return; }
        setCreando(true);
        setError('');
        const alumnos = alumnosTexto.split('\n').map((n) => n.trim()).filter(Boolean);
        const res = await fetch('/api/grupos/crear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre.trim(), alumnos })
        });
        const data = await res.json();
        setCreando(false);
        if (!res.ok) { setError(data.error || 'No se pudo crear el grupo.'); return; }
        setAbierto(false);
        router.push(`/dashboard/grupo/${data.grupoId}`);
        router.refresh();
    }

    return (
        <>
            <button
                onClick={() => setAbierto(true)}
                className="px-4 py-2 my-1.5 text-sm rounded-md border border-dashed border-border text-goldDark font-semibold whitespace-nowrap hover:bg-gold/5"
            >
                + Nuevo grupo
            </button>

            {abierto && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setAbierto(false)}>
                    <div className="bg-white rounded-xl p-6 w-[420px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="font-bold mb-1">Nuevo grupo de asistencia</h3>
                        <p className="text-xs text-inkSoft mb-4">
                            Se crea un Excel nuevo en tu Drive (raíz de "Mi unidad") y el grupo queda listo para pasar lista.
                        </p>

                        <label className="block text-xs text-inkSoft mb-1">Nombre del curso</label>
                        <input
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Ej. Matemática 3ro B"
                            className="w-full px-3 py-2 border border-border rounded-md text-sm mb-3"
                        />

                        <label className="block text-xs text-inkSoft mb-1">Alumnos (uno por línea, opcional)</label>
                        <textarea
                            value={alumnosTexto}
                            onChange={(e) => setAlumnosTexto(e.target.value)}
                            rows={6}
                            placeholder={'Ana Pérez\nJuan Gómez\nMaría Torres…'}
                            className="w-full px-3 py-2 border border-border rounded-md text-sm mb-3 font-mono"
                        />

                        {error && <p className="text-sm text-red mb-3">{error}</p>}

                        <div className="flex gap-2">
                            <button
                                onClick={crear}
                                disabled={creando}
                                className="flex-1 py-2.5 rounded-md bg-navy text-white text-sm font-semibold disabled:opacity-60"
                            >
                                {creando ? 'Creando…' : 'Crear grupo'}
                            </button>
                            <button onClick={() => setAbierto(false)} className="px-4 py-2.5 rounded-md border border-border text-sm">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

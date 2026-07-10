'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

interface AlumnoQr {
    id: string;
    nombre: string;
}

export default function AsistenciaQrPage() {
    const params = useParams();
    const token = params.token as string;
    const supabase = supabaseBrowser();

    const [alumnos, setAlumnos] = useState<AlumnoQr[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [marcado, setMarcado] = useState<string | null>(null);
    const [enviando, setEnviando] = useState<string | null>(null);
    const [busqueda, setBusqueda] = useState('');

    useEffect(() => {
        (async () => {
            const { data, error } = await supabase.rpc('alumnos_para_qr', { p_token: token });
            if (error) {
                setError(
                    error.message.includes('QR_INVALIDO_O_VENCIDO')
                        ? 'Este QR ya venció o no es válido. Pídele a tu profesor que genere uno nuevo.'
                        : 'No se pudo cargar la lista. Intenta de nuevo.'
                );
            } else {
                setAlumnos(data || []);
            }
            setCargando(false);
        })();
    }, [token, supabase]);

    async function marcarPresente(alumno: AlumnoQr) {
        setEnviando(alumno.id);
        const { error } = await supabase.rpc('marcar_asistencia_qr', {
            p_token: token,
            p_alumno_id: alumno.id
        });
        setEnviando(null);
        if (error) {
            setError('No se pudo marcar tu asistencia. Pídele ayuda a tu profesor.');
            return;
        }
        setMarcado(alumno.nombre);
    }

    const filtrados = alumnos.filter((a) => a.nombre.toLowerCase().includes(busqueda.toLowerCase()));

    return (
        <section className="min-h-screen flex items-center justify-center bg-bg px-4">
            <div className="bg-white rounded-xl p-8 w-full max-w-[420px] text-center shadow-2xl border border-border">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-gold to-goldDark flex items-center justify-center text-2xl">
                    ✅
                </div>
                <h1 className="text-lg font-bold mb-1">Marca tu asistencia</h1>
                <p className="text-sm text-inkSoft mb-5">Busca tu nombre en la lista y tócalo.</p>

                {cargando && <p className="text-sm text-inkSoft">Cargando…</p>}

                {error && <p className="text-sm text-red mb-4">{error}</p>}

                {marcado ? (
                    <div className="py-6">
                        <div className="text-4xl mb-2">🎉</div>
                        <p className="text-base font-semibold">¡Listo, {marcado}!</p>
                        <p className="text-sm text-inkSoft mt-1">Quedaste marcado presente.</p>
                    </div>
                ) : (
                    !cargando &&
                    !error && (
                        <>
                            <input
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Buscar mi nombre…"
                                className="w-full px-3 py-2.5 border border-border rounded-md text-sm mb-3"
                            />
                            <div className="max-h-[360px] overflow-y-auto flex flex-col gap-1.5">
                                {filtrados.map((a) => (
                                    <button
                                        key={a.id}
                                        onClick={() => marcarPresente(a)}
                                        disabled={enviando === a.id}
                                        className="w-full text-left px-4 py-3 rounded-md border border-border text-sm hover:bg-bg disabled:opacity-50"
                                    >
                                        {enviando === a.id ? 'Marcando…' : a.nombre}
                                    </button>
                                ))}
                                {filtrados.length === 0 && (
                                    <p className="text-sm text-inkSoft py-4">No se encontró ningún nombre.</p>
                                )}
                            </div>
                        </>
                    )
                )}
            </div>
        </section>
    );
}

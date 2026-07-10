'use client';

import { useState } from 'react';

export function QrButton({ grupoId, horas }: { grupoId: string; horas: 1 | 2 }) {
    const [abierto, setAbierto] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [qr, setQr] = useState<{ url: string; qrDataUrl: string; expiraEn: string } | null>(null);
    const [error, setError] = useState('');

    async function generar() {
        setAbierto(true);
        setCargando(true);
        setError('');
        try {
            const res = await fetch(`/api/grupos/${grupoId}/qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ horasClaseDia: horas })
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'No se pudo generar el QR.'); return; }
            setQr(data);
        } finally {
            setCargando(false);
        }
    }

    return (
        <>
            <button onClick={generar} className="px-3.5 py-2 rounded-md border border-border text-sm font-semibold">
                📱 QR de auto-asistencia
            </button>

            {abierto && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setAbierto(false)}>
                    <div className="bg-white rounded-xl p-6 w-[360px] text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="font-bold mb-1">QR de esta clase</h3>
                        <p className="text-xs text-inkSoft mb-4">
                            Válido por 20 minutos. Los alumnos lo escanean y se marcan presentes ellos mismos.
                        </p>

                        {cargando && <p className="text-sm text-inkSoft py-8">Generando…</p>}
                        {error && <p className="text-sm text-red">{error}</p>}

                        {qr && (
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={qr.qrDataUrl} alt="Código QR de asistencia" className="mx-auto mb-3 rounded-md border border-border" />
                                <a href={qr.url} target="_blank" rel="noreferrer" className="text-xs text-goldDark break-all underline">
                                    {qr.url}
                                </a>
                            </>
                        )}

                        <button onClick={() => setAbierto(false)} className="w-full mt-4 py-2 text-sm text-inkSoft">
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

'use client';

import { useState } from 'react';

export type MotivoJustificacion = 'salud' | 'imprevisto' | 'otro';

const MOTIVOS: { valor: MotivoJustificacion; label: string }[] = [
  { valor: 'salud', label: 'Salud' },
  { valor: 'imprevisto', label: 'Imprevisto' },
  { valor: 'otro', label: 'Otro' }
];

export { MOTIVOS };

export function JustificarPopover({
  justificada,
  motivo,
  detalle,
  abierto,
  onAbrir,
  onCerrar,
  onGuardar,
  onQuitar
}: {
  justificada: boolean;
  motivo: MotivoJustificacion | null;
  detalle: string;
  abierto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
  onGuardar: (motivo: MotivoJustificacion, detalle: string) => void;
  onQuitar: () => void;
}) {
  const [motivoLocal, setMotivoLocal] = useState<MotivoJustificacion>(motivo || 'salud');
  const [detalleLocal, setDetalleLocal] = useState(detalle);

  function abrir() {
    setMotivoLocal(motivo || 'salud');
    setDetalleLocal(detalle);
    onAbrir();
  }

  return (
    <div className="relative">
      <button
        onClick={abrir}
        className={`text-xs px-2.5 py-1.5 rounded-full border whitespace-nowrap ${
          justificada ? 'border-green text-green bg-green/10' : 'border-border text-inkSoft'
        }`}
      >
        {justificada ? '✓ Justificada' : 'Justificar'}
      </button>

      {abierto && (
        <div className="absolute right-0 top-8 z-10 bg-white border border-border rounded-md shadow-lg p-3 w-64">
          <div className="text-[11px] text-inkSoft mb-1.5">Motivo</div>
          <div className="flex gap-1.5 mb-2">
            {MOTIVOS.map((m) => (
              <button
                key={m.valor}
                onClick={() => setMotivoLocal(m.valor)}
                className={`text-[11px] px-2.5 py-1 rounded-full border ${
                  motivoLocal === m.valor ? 'bg-navy border-navy text-white font-semibold' : 'border-border text-inkSoft'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-inkSoft mb-1">Detalle (opcional)</div>
          <textarea
            value={detalleLocal}
            onChange={(e) => setDetalleLocal(e.target.value)}
            rows={2}
            placeholder="Ej. Cita médica por la mañana"
            className="w-full text-xs border border-border rounded px-2 py-1.5 mb-2"
          />

          <div className="flex gap-2">
            <button
              onClick={() => onGuardar(motivoLocal, detalleLocal.trim())}
              className="flex-1 text-[11px] px-2 py-1.5 rounded bg-navy text-white font-semibold"
            >
              Guardar
            </button>
            {justificada && (
              <button
                onClick={onQuitar}
                className="text-[11px] px-2 py-1.5 rounded border border-border text-red"
              >
                Quitar
              </button>
            )}
            <button onClick={onCerrar} className="text-[11px] px-2 py-1.5 rounded border border-border text-inkSoft">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

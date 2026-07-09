'use client';

import { Estatus } from '@/lib/types';

const OPCIONES: { estatus: Estatus; label: string }[] = [
  { estatus: 'asistio', label: 'Asistió' },
  { estatus: 'tardanza', label: 'Tardanza' },
  { estatus: 'falto', label: 'Faltó' }
];

const ESTILOS: Record<Estatus, string> = {
  asistio: 'border-green text-green bg-green/10',
  tardanza: 'border-amber text-amber bg-amber/10',
  falto: 'border-red text-red bg-red/10'
};

export function StatusPillGroup({
  value,
  onChange
}: {
  value: Estatus;
  onChange: (v: Estatus) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {OPCIONES.map((op) => (
        <button
          key={op.estatus}
          onClick={() => onChange(op.estatus)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap ${
            value === op.estatus ? ESTILOS[op.estatus] : 'border-border text-inkSoft bg-white'
          }`}
        >
          {op.label}
        </button>
      ))}
    </div>
  );
}

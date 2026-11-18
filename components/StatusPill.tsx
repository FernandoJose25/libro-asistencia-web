'use client';

import { Estatus } from '@/lib/types';

const OPCIONES: { estatus: Estatus; label: string }[] = [
  { estatus: 'asistio', label: 'Asistió' },
  { estatus: 'tardanza', label: 'Retardo' },
  { estatus: 'falto', label: 'Faltó' }
];

const ESTILOS: Record<Estatus, string> = {
  asistio: 'bg-green/[0.12] text-green ring-1 ring-inset ring-green/45',
  tardanza: 'bg-amber/[0.12] text-amber ring-1 ring-inset ring-amber/45',
  falto: 'bg-red/10 text-red ring-1 ring-inset ring-red/40'
};

// Control segmentado: un solo estado activo por alumno, botones de 44px de
// alto en móvil para marcar con el pulgar sin errar.
export function StatusPillGroup({
  value,
  onChange
}: {
  value: Estatus;
  onChange: (v: Estatus) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Estado de asistencia" className="grid grid-cols-3 gap-1 rounded-[10px] bg-bg p-1 w-full md:w-auto">
      {OPCIONES.map((op) => {
        const activo = value === op.estatus;
        return (
          <button
            key={op.estatus}
            role="radio"
            aria-checked={activo}
            onClick={() => onChange(op.estatus)}
            className={`min-h-[44px] md:min-h-[34px] px-3 rounded-[7px] text-[13px] font-bold whitespace-nowrap transition-colors duration-150 active:scale-[0.97] motion-reduce:transition-none ${
              activo ? ESTILOS[op.estatus] : 'text-inkSoft hover:text-ink hover:bg-white/70'
            }`}
          >
            {op.label}
          </button>
        );
      })}
    </div>
  );
}

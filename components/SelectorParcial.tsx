'use client';

import { PARCIALES, type Parcial } from '@/lib/calificaciones';

export function SelectorParcial({ valor, onCambiar }: { valor: Parcial; onCambiar: (p: Parcial) => void }) {
  return (
    <div className="bg-white border border-border rounded-card p-3">
      <div className="text-[12px] text-inkSoft font-bold mb-2 px-0.5">Parcial</div>
      <div role="radiogroup" aria-label="Parcial" className="grid grid-cols-3 gap-1 bg-bg rounded-[10px] p-1">
        {PARCIALES.map((p) => (
          <button
            key={p}
            role="radio"
            aria-checked={valor === p}
            onClick={() => onCambiar(p)}
            className={`min-h-[42px] rounded-[7px] text-[14px] font-bold transition-colors duration-150 ${
              valor === p ? 'bg-navy text-white shadow-sm' : 'text-inkSoft hover:text-ink hover:bg-white/70'
            }`}
          >
            Parcial {p}
          </button>
        ))}
      </div>
    </div>
  );
}

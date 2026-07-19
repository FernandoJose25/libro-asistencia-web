'use client';

import { useState } from 'react';

const DIAS_SEMANA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function toISO(anio: number, mes: number, dia: number) {
  const mm = String(mes + 1).padStart(2, '0');
  const dd = String(dia).padStart(2, '0');
  return `${anio}-${mm}-${dd}`;
}

function parseISO(iso: string) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return { anio, mes: mes - 1, dia };
}

export function MiniCalendario({
  fechaSeleccionada,
  onSeleccionar
}: {
  fechaSeleccionada: string;
  onSeleccionar: (fechaISO: string) => void;
}) {
  const sel = parseISO(fechaSeleccionada);
  const [mesVisible, setMesVisible] = useState({ anio: sel.anio, mes: sel.mes });

  const hoy = new Date();
  const hoyISO = toISO(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const primerDiaSemana = new Date(mesVisible.anio, mesVisible.mes, 1).getDay();
  const totalDias = new Date(mesVisible.anio, mesVisible.mes + 1, 0).getDate();

  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1)
  ];

  function irMesAnterior() {
    setMesVisible((m) => (m.mes === 0 ? { anio: m.anio - 1, mes: 11 } : { anio: m.anio, mes: m.mes - 1 }));
  }

  function irMesSiguiente() {
    setMesVisible((m) => (m.mes === 11 ? { anio: m.anio + 1, mes: 0 } : { anio: m.anio, mes: m.mes + 1 }));
  }

  return (
    <div className="bg-white border border-border rounded-card p-3.5 w-full sm:w-[280px] shrink-0">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={irMesAnterior}
          aria-label="Mes anterior"
          className="w-7 h-7 flex items-center justify-center rounded-md text-inkSoft hover:bg-bg"
        >
          ◄
        </button>
        <span className="text-sm font-semibold">
          {MESES[mesVisible.mes]} {mesVisible.anio}
        </span>
        <button
          onClick={irMesSiguiente}
          aria-label="Mes siguiente"
          className="w-7 h-7 flex items-center justify-center rounded-md text-inkSoft hover:bg-bg"
        >
          ►
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="text-[10.5px] text-inkSoft text-center font-semibold py-1">
            {d}
          </div>
        ))}

        {celdas.map((dia, i) => {
          if (dia === null) return <div key={i} />;
          const iso = toISO(mesVisible.anio, mesVisible.mes, dia);
          const esSeleccionado = iso === fechaSeleccionada;
          const esHoy = iso === hoyISO;
          return (
            <button
              key={i}
              onClick={() => onSeleccionar(iso)}
              className={`text-xs w-full aspect-square rounded-md flex items-center justify-center transition-colors ${
                esSeleccionado
                  ? 'bg-leaf text-white font-semibold'
                  : esHoy
                  ? 'border border-leaf text-leafDark font-semibold'
                  : 'text-ink hover:bg-leafSoft'
              }`}
            >
              {dia}
            </button>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { fechaLocalISO } from '@/lib/utils';
import { Icono } from './Icono';

const DIAS_SEMANA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const MESES = [
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
  onSeleccionar,
  diasConRegistro
}: {
  fechaSeleccionada: string;
  onSeleccionar: (fechaISO: string) => void;
  // Días que ya tienen asistencia guardada: sirve para ver de un vistazo qué
  // días faltan por llenar (p. ej. ponerse al día con un mes atrasado).
  diasConRegistro?: Set<string>;
}) {
  const sel = parseISO(fechaSeleccionada);
  const [mesVisible, setMesVisible] = useState({ anio: sel.anio, mes: sel.mes });
  // "Hoy" solo en el cliente: en el servidor (UTC) puede ser otro día y el
  // resaltado quedaría desfasado tras la hidratación.
  const [hoyISO, setHoyISO] = useState<string | null>(null);

  useEffect(() => setHoyISO(fechaLocalISO()), []);

  useEffect(() => {
    setMesVisible({ anio: sel.anio, mes: sel.mes });
  }, [sel.anio, sel.mes]);

  const primerDiaSemana = new Date(mesVisible.anio, mesVisible.mes, 1).getDay();
  const totalDias = new Date(mesVisible.anio, mesVisible.mes + 1, 0).getDate();

  const celdas: (number | null)[] = [
    ...Array(primerDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1)
  ];

  const registradosEnMes = Array.from({ length: totalDias }, (_, i) =>
    toISO(mesVisible.anio, mesVisible.mes, i + 1)
  ).filter((iso) => diasConRegistro?.has(iso)).length;

  function irMesAnterior() {
    setMesVisible((m) => (m.mes === 0 ? { anio: m.anio - 1, mes: 11 } : { anio: m.anio, mes: m.mes - 1 }));
  }

  function irMesSiguiente() {
    setMesVisible((m) => (m.mes === 11 ? { anio: m.anio + 1, mes: 0 } : { anio: m.anio, mes: m.mes + 1 }));
  }

  return (
    <div className="bg-white border border-border rounded-card p-3.5 w-full sm:w-[284px] shrink-0">
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={irMesAnterior}
          aria-label="Mes anterior"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-inkSoft hover:bg-bg hover:text-ink"
        >
          <Icono nombre="izquierda" />
        </button>
        <span className="font-display text-[17px] font-semibold">
          {MESES[mesVisible.mes]} <span className="text-inkSoft font-medium">{mesVisible.anio}</span>
        </span>
        <button
          onClick={irMesSiguiente}
          aria-label="Mes siguiente"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-inkSoft hover:bg-bg hover:text-ink"
        >
          <Icono nombre="derecha" />
        </button>
      </div>
      <p className="text-[11.5px] text-inkSoft text-center mb-2.5">
        {registradosEnMes === 0
          ? 'Sin días registrados este mes'
          : `${registradosEnMes} día${registradosEnMes === 1 ? '' : 's'} con asistencia guardada`}
      </p>

      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="text-[11px] text-inkSoft text-center font-bold py-1">
            {d}
          </div>
        ))}

        {celdas.map((dia, i) => {
          if (dia === null) return <div key={i} />;
          const iso = toISO(mesVisible.anio, mesVisible.mes, dia);
          const esSeleccionado = iso === fechaSeleccionada;
          const esHoy = iso === hoyISO;
          const registrado = diasConRegistro?.has(iso);
          return (
            <button
              key={i}
              onClick={() => onSeleccionar(iso)}
              aria-label={`${dia} de ${MESES[mesVisible.mes]}${registrado ? ', con asistencia guardada' : ''}`}
              aria-pressed={esSeleccionado}
              className={`relative text-[13px] tabular-nums w-full aspect-square max-h-11 rounded-lg flex items-center justify-center transition-colors duration-150 ${
                esSeleccionado
                  ? 'bg-navy text-white font-bold'
                  : esHoy
                  ? 'ring-2 ring-inset ring-gold text-ink font-bold'
                  : 'text-ink hover:bg-bg'
              }`}
            >
              {dia}
              {registrado && (
                <span
                  className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${esSeleccionado ? 'bg-gold' : 'bg-green'}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

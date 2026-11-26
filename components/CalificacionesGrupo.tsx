'use client';

import { useState } from 'react';
import { Alumno } from '@/lib/types';
import { claveNota, type NotaTrabajo, type Parcial, type Trabajo } from '@/lib/calificaciones';
import type { ExamenGuardado } from '@/lib/cargarCalificaciones';
import { TrabajosClient } from './TrabajosClient';
import { ExamenesClient } from './ExamenesClient';
import { Icono } from './Icono';

export type Vista = 'trabajos' | 'examenes';

const PESTAÑAS = [
  { vista: 'trabajos', label: 'Trabajos', icono: 'lapiz' },
  { vista: 'examenes', label: 'Exámenes', icono: 'examen' }
] as const;

// Trabajos y Exámenes de un grupo en una sola página, para pasar de uno a otro
// alumno por alumno: las dos vistas quedan montadas (la otra, invisible) y así
// cada una conserva su scroll y el trabajo elegido. Trabajos, notas y parcial
// son compartidos para que Exámenes vea al momento lo recién calificado.
export function CalificacionesGrupo({
  vistaInicial,
  grupoId,
  grupoNombre,
  profesorId,
  porcentajeTrabajos,
  alumnos,
  trabajosIniciales,
  notasIniciales,
  examenesIniciales
}: {
  vistaInicial: Vista;
  grupoId: string;
  grupoNombre: string;
  profesorId: string;
  porcentajeTrabajos: number;
  alumnos: Alumno[];
  trabajosIniciales: Trabajo[];
  notasIniciales: NotaTrabajo[];
  examenesIniciales: ExamenGuardado[];
}) {
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const [trabajos, setTrabajos] = useState(trabajosIniciales);
  const [notas, setNotas] = useState(() => new Map(notasIniciales.map((n) => [claveNota(n.alumno_id, n.evaluacion_id), n])));
  // Abre en el último parcial con trabajos o exámenes: suele ser el que está en curso.
  const [parcial, setParcial] = useState<Parcial>(
    () => Math.max(1, ...trabajosIniciales.map((t) => t.parcial), ...examenesIniciales.map((e) => e.parcial)) as Parcial
  );

  function cambiarVista(v: Vista) {
    setVista(v);
    // Si el navegador recarga la página, vuelve a la misma pestaña.
    window.history.replaceState(null, '', v === 'examenes' ? '?vista=examenes' : window.location.pathname);
  }

  const comunes = { grupoId, grupoNombre, profesorId, porcentajeTrabajos, alumnos, parcial, setParcial };

  return (
    <>
      <div role="tablist" className="flex items-end gap-1 px-3 md:px-6 pt-2.5 border-b border-border bg-white shrink-0">
        {PESTAÑAS.map((p) => {
          const activo = vista === p.vista;
          return (
            <button
              key={p.vista}
              role="tab"
              aria-selected={activo}
              onClick={() => cambiarVista(p.vista)}
              className={`relative -mb-px flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[15px] rounded-t-lg border border-b-0 whitespace-nowrap ${
                activo
                  ? 'bg-bg border-border font-bold text-ink before:absolute before:inset-x-3 before:top-0 before:h-[3px] before:rounded-b before:bg-gold'
                  : 'border-transparent text-inkSoft hover:text-ink'
              }`}
            >
              <Icono nombre={p.icono} className="w-4 h-4" />
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="relative flex-1 min-h-0">
        <div role="tabpanel" className={`absolute inset-0 flex flex-col ${vista === 'trabajos' ? '' : 'invisible'}`}>
          <TrabajosClient {...comunes} trabajos={trabajos} setTrabajos={setTrabajos} notas={notas} setNotas={setNotas} />
        </div>
        <div role="tabpanel" className={`absolute inset-0 flex flex-col ${vista === 'examenes' ? '' : 'invisible'}`}>
          <ExamenesClient
            {...comunes}
            trabajos={trabajos}
            notas={notas}
            examenesIniciales={examenesIniciales}
            irATrabajos={() => cambiarVista('trabajos')}
          />
        </div>
      </div>
    </>
  );
}

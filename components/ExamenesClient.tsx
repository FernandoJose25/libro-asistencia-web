'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Alumno } from '@/lib/types';
import { conReintentos, esErrorDeRed, sanitizarNombreArchivo } from '@/lib/utils';
import { copiarTablaParaExcel, exportarTablaExcel } from '@/lib/exportAsistencia';
import {
  calificacionParcial,
  calificacionSistema,
  claveNota,
  formatearNota,
  promedioTrabajos,
  redondearDecima,
  type NotaTrabajo,
  type Parcial,
  type Trabajo
} from '@/lib/calificaciones';
import type { ExamenGuardado } from '@/lib/cargarCalificaciones';
import { SelectorParcial } from './SelectorParcial';
import { Icono } from './Icono';
import { AnalisisCorrelacion } from './AnalisisCorrelacion';

const claveExamen = (alumnoId: string, parcial: Parcial) => `${alumnoId}|${parcial}`;
// Para Excel: número con una decimal como máximo, o celda vacía.
const celda = (n: number | null) => (n === null ? '' : redondearDecima(n));

export function ExamenesClient({
  grupoId,
  grupoNombre,
  profesorId,
  porcentajeTrabajos,
  alumnos,
  trabajos,
  notas,
  parcial,
  setParcial,
  examenesIniciales,
  irATrabajos
}: {
  grupoId: string;
  grupoNombre: string;
  profesorId: string;
  porcentajeTrabajos: number;
  alumnos: Alumno[];
  // Compartidos con Trabajos (ver CalificacionesGrupo).
  trabajos: Trabajo[];
  notas: Map<string, NotaTrabajo>;
  parcial: Parcial;
  setParcial: (p: Parcial) => void;
  examenesIniciales: ExamenGuardado[];
  irATrabajos: () => void;
}) {
  const supabase = supabaseBrowser();
  const [examenes, setExamenes] = useState(
    () => new Map(examenesIniciales.map((e) => [claveExamen(e.alumno_id, e.parcial), e.nota]))
  );
  // Lo que se está escribiendo en cada casilla, antes de salir de ella.
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [pendientes, setPendientes] = useState(0);
  const [copiado, setCopiado] = useState<'ok' | 'error' | null>(null);
  const [analisis, setAnalisis] = useState(false);
  const cerrarAnalisis = useCallback(() => setAnalisis(false), []);

  useEffect(() => {
    if (pendientes === 0) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [pendientes]);

  const trabajosDelParcial = trabajos.filter((t) => t.parcial === parcial);

  // El parcial también se cambia desde Trabajos.
  useEffect(() => {
    setBorradores({});
    setErrores({});
    setCopiado(null);
  }, [parcial]);

  // Se guarda al salir de la casilla (o con Enter). Vacía = sin examen.
  async function guardarExamen(alumno: Alumno, p: Parcial) {
    const escrito = borradores[alumno.id];
    if (escrito === undefined) return;
    const texto = escrito.trim().replace(',', '.');
    let nueva: number | undefined;
    if (texto !== '') {
      const n = Number(texto);
      if (!Number.isFinite(n) || n < 0 || n > 10) {
        setErrores((prev) => ({ ...prev, [alumno.id]: 'Escribe una calificación de 0 a 10.' }));
        return;
      }
      nueva = Math.round(n * 100) / 100;
    }

    const clave = claveExamen(alumno.id, p);
    const anterior = examenes.get(clave);
    setBorradores(({ [alumno.id]: _, ...resto }) => resto);
    setErrores(({ [alumno.id]: _, ...resto }) => resto);
    if (nueva === anterior) return;

    const poner = (n: number | undefined) =>
      setExamenes((prev) => {
        const copia = new Map(prev);
        if (n === undefined) copia.delete(clave);
        else copia.set(clave, n);
        return copia;
      });
    poner(nueva);
    setCopiado(null);
    setPendientes((n) => n + 1);
    const { error } = await conReintentos(() =>
      nueva === undefined
        ? supabase.from('examenes').delete().eq('alumno_id', alumno.id).eq('parcial', p)
        : supabase.from('examenes').upsert(
            {
              alumno_id: alumno.id,
              grupo_id: grupoId,
              profesor_id: profesorId,
              parcial: p,
              nota: nueva,
              actualizado_en: new Date().toISOString()
            },
            { onConflict: 'alumno_id,parcial' }
          )
    );
    setPendientes((n) => n - 1);
    if (error) {
      setExamenes((prev) => {
        if (prev.get(clave) !== nueva) return prev; // ya la cambió otra vez
        const copia = new Map(prev);
        if (anterior === undefined) copia.delete(clave);
        else copia.set(clave, anterior);
        return copia;
      });
      setErrores((prev) => ({
        ...prev,
        [alumno.id]: esErrorDeRed(error) ? 'Sin conexión: no se guardó. Vuelve a escribirla.' : `No se guardó: ${error.message}`
      }));
    }
  }

  const filas = alumnos.map((a) => {
    const trabajosProm = promedioTrabajos(a.id, trabajosDelParcial, notas);
    const examen = examenes.get(claveExamen(a.id, parcial)) ?? null;
    const calificacion = calificacionParcial(trabajosProm, examen, porcentajeTrabajos);
    return {
      alumno: a,
      trabajos: trabajosProm,
      calificados: trabajosDelParcial.filter((t) => notas.has(claveNota(a.id, t.id))).length,
      entregadas: trabajosDelParcial.filter((t) => {
        const n = notas.get(claveNota(a.id, t.id));
        return n && !n.no_entrego;
      }).length,
      examen,
      calificacion,
      sistema: calificacionSistema(calificacion)
    };
  });

  function tabla() {
    return [
      [
        'N°',
        'Alumno',
        `Trabajos (${porcentajeTrabajos}%)`,
        `Examen (${100 - porcentajeTrabajos}%)`,
        `Calificación real P${parcial}`,
        `Calificación sistema P${parcial}`
      ],
      ...filas.map((f, i) => [i + 1, f.alumno.nombre, celda(f.trabajos), celda(f.examen), celda(f.calificacion), f.sistema ?? ''])
    ];
  }

  async function copiar() {
    try {
      await copiarTablaParaExcel(tabla());
      setCopiado('ok');
    } catch {
      setCopiado('error');
    }
  }

  function descargar() {
    exportarTablaExcel(
      `${sanitizarNombreArchivo(grupoNombre)}-calificaciones-parcial-${parcial}`,
      `Parcial ${parcial}`,
      [
        `${grupoNombre} — Calificaciones del parcial ${parcial}`,
        `Calificación = promedio de trabajos × ${porcentajeTrabajos}% + examen × ${100 - porcentajeTrabajos}%. Trabajos NE o sin calificar cuentan como 0.`,
        'Sistema = la calificación real redondeada (desde .5 sube: 5.5 → 6), mínimo 5.'
      ],
      tabla()
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-y-contain">
      <div className="max-w-[920px] mx-auto px-4 md:px-8 pt-5 md:pt-7 pb-10">
        <header className="mb-5">
          <p className="text-[11.5px] uppercase tracking-[0.16em] font-bold text-goldDark">Exámenes y calificación del parcial</p>
          <h1 className="font-display text-[34px] md:text-[42px] font-semibold leading-[1.02] mt-1 break-words">{grupoNombre}</h1>
          <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-inkSoft leading-snug">
            <Icono nombre="ajustes" className="w-3.5 h-3.5 mt-0.5" />
            <span>
              Calificación del parcial = trabajos {porcentajeTrabajos}% + examen {100 - porcentajeTrabajos}% ·{' '}
              <Link href="/dashboard/grupos" className="font-bold text-goldDark underline-offset-2 hover:underline">
                Editar
              </Link>
            </span>
          </p>
        </header>

        <div className="mb-4">
          <SelectorParcial valor={parcial} onCambiar={setParcial} />
        </div>

        <section className="bg-white border border-border rounded-card">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-display text-[22px] font-semibold leading-none">
                Parcial {parcial}{' '}
                <span className="font-sans text-[13px] font-normal text-inkSoft">
                  · {trabajosDelParcial.length} trabajo{trabajosDelParcial.length === 1 ? '' : 's'}
                </span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAnalisis(true)}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-md border border-navy bg-navy text-white text-[13px] font-semibold hover:bg-navyActive"
                >
                  <Icono nombre="dispersion" className="w-4 h-4" />
                  Análisis
                </button>
                <button
                  onClick={copiar}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-md border border-border bg-white text-[13px] font-semibold hover:bg-bg"
                >
                  <Icono nombre={copiado === 'ok' ? 'check' : 'copiar'} className={`w-4 h-4 ${copiado === 'ok' ? 'text-green' : ''}`} />
                  {copiado === 'ok' ? 'Copiado: pégalo en Excel' : 'Copiar para Excel'}
                </button>
                <button
                  onClick={descargar}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-md border border-border bg-white text-[13px] font-semibold hover:bg-bg"
                >
                  <Icono nombre="descargar" className="w-4 h-4" />
                  Descargar Excel
                </button>
              </div>
            </div>
            {copiado === 'error' && <p className="text-[12px] text-red mt-1.5">No se pudo copiar; usa "Descargar Excel".</p>}
            <p className="text-[12px] text-inkSoft mt-2">
              Escribe el examen (0 a 10, acepta decimales) y se guarda al pasar a otra casilla.{' '}
              <span className={pendientes > 0 ? 'text-amber font-bold' : ''}>{pendientes > 0 ? 'Guardando…' : ''}</span>
            </p>
            {trabajosDelParcial.length === 0 && porcentajeTrabajos > 0 && (
              <p className="text-[12.5px] text-amber mt-1.5">
                Este parcial aún no tiene trabajos: la calificación sale cuando haya trabajos.{' '}
                <button onClick={irATrabajos} className="font-bold underline underline-offset-2">
                  Ir a Trabajos
                </button>
              </p>
            )}
          </div>

          <div className="hidden md:grid grid-cols-[3rem_minmax(0,1fr)_6rem_6.5rem_5.5rem_5.5rem] gap-x-3 px-4 py-2 text-[10.5px] uppercase tracking-wide text-inkSoft border-b border-border bg-bg/60">
            <div className="text-right pr-1">N°</div>
            <div>Alumno</div>
            <div className="text-center">Trabajos {porcentajeTrabajos}%</div>
            <div className="text-center">Examen {100 - porcentajeTrabajos}%</div>
            <div className="text-center">Real</div>
            <div className="text-center">Sistema</div>
          </div>

          <ol>
            {filas.map((f, i) => {
              const a = f.alumno;
              const error = errores[a.id];
              const valor = borradores[a.id] ?? (f.examen === null ? '' : String(f.examen));
              return (
                <li key={a.id} className="flex border-b border-rule last:border-b-0">
                  <span className="w-10 md:w-12 shrink-0 pt-[13px] md:pt-0 md:self-center pr-2.5 text-right font-display text-[16px] text-inkSoft tabular-nums select-none">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0 border-l-2 border-red/20 pl-3 pr-3 md:pr-4 py-2.5 grid grid-cols-4 md:grid-cols-[minmax(0,1fr)_6rem_6.5rem_5.5rem_5.5rem] items-center gap-x-2 md:gap-x-3 gap-y-2">
                    <div className="col-span-4 md:col-span-1 min-w-0">
                      <div className="text-[15.5px] leading-snug">{a.nombre}</div>
                      {error && <div className="text-[12px] text-red font-semibold">{error}</div>}
                    </div>
                    <div className="text-center">
                      <div className="md:hidden text-[10.5px] uppercase tracking-wide text-inkSoft">Trab. {porcentajeTrabajos}%</div>
                      <div className="text-[15px] tabular-nums">{formatearNota(f.trabajos)}</div>
                      {trabajosDelParcial.length > 0 && f.calificados < trabajosDelParcial.length && (
                        <div className="text-[11px] text-amber">
                          {f.calificados}/{trabajosDelParcial.length} calificados
                        </div>
                      )}
                    </div>
                    <label className="text-center">
                      <span className="md:hidden block text-[10.5px] uppercase tracking-wide text-inkSoft">Exam. {100 - porcentajeTrabajos}%</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valor}
                        placeholder="—"
                        aria-label={`Examen del parcial ${parcial} de ${a.nombre}`}
                        onChange={(e) => setBorradores((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        onBlur={() => guardarExamen(a, parcial)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        className={`w-full max-w-[5.5rem] mx-auto block min-h-[42px] px-2 rounded-[10px] border bg-white text-[16px] font-bold text-center tabular-nums ${
                          error ? 'border-red' : 'border-navy/30'
                        }`}
                      />
                    </label>
                    <div className="text-center">
                      <div className="md:hidden text-[10.5px] uppercase tracking-wide text-inkSoft">Real</div>
                      <div className="font-display text-[20px] leading-tight tabular-nums text-inkSoft">{formatearNota(f.calificacion)}</div>
                    </div>
                    <div className="text-center">
                      <div className="md:hidden text-[10.5px] uppercase tracking-wide text-inkSoft">Sistema</div>
                      <div className="font-display text-[24px] leading-tight font-semibold tabular-nums text-navy">{f.sistema ?? '—'}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {alumnos.length === 0 && (
            <div className="px-4 py-8 text-sm text-inkSoft text-center">Este grupo no tiene alumnos todavía.</div>
          )}
        </section>

        <p className="text-[11.5px] text-inkSoft mt-3">
          Trabajos = promedio de todos los trabajos del parcial: NE y — (sin calificar) cuentan como 0. Real = la calificación con
          una decimal. Sistema = la que se captura en la escuela: la real redondeada (desde .5 sube: 5.5 → 6) y nunca menor a 5.
        </p>
      </div>

      {analisis && (
        <AnalisisCorrelacion
          parcial={parcial}
          porcentajeTrabajos={porcentajeTrabajos}
          totalTrabajos={trabajosDelParcial.length}
          filas={filas.map((f) => ({ nombre: f.alumno.nombre, entregadas: f.entregadas, examen: f.examen, calificacion: f.calificacion }))}
          onCerrar={cerrarAnalisis}
        />
      )}
    </div>
  );
}

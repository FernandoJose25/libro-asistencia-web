'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Alumno } from '@/lib/types';
import { conReintentos, esErrorDeRed } from '@/lib/utils';
import {
  OPCIONES_NOTA_TRABAJO,
  PARCIALES,
  claveNota,
  formatearNota,
  promedioTrabajos,
  valorNotaTrabajo,
  type NotaTrabajo,
  type Parcial,
  type Trabajo
} from '@/lib/calificaciones';
import { SelectorParcial } from './SelectorParcial';
import { Icono } from './Icono';

// El título de un trabajo es único dentro de su parcial (índice en la base).
function mensajeError(error: { code?: string; message: string }, parcial: Parcial) {
  return error.code === '23505' ? `Ya hay un trabajo con ese título en el parcial ${parcial}.` : error.message;
}

export function TrabajosClient({
  grupoId,
  grupoNombre,
  profesorId,
  porcentajeTrabajos,
  alumnos,
  trabajos,
  setTrabajos,
  notas,
  setNotas,
  parcial,
  setParcial
}: {
  grupoId: string;
  grupoNombre: string;
  profesorId: string;
  porcentajeTrabajos: number;
  alumnos: Alumno[];
  // Compartidos con Exámenes (ver CalificacionesGrupo).
  trabajos: Trabajo[];
  setTrabajos: Dispatch<SetStateAction<Trabajo[]>>;
  notas: Map<string, NotaTrabajo>;
  setNotas: Dispatch<SetStateAction<Map<string, NotaTrabajo>>>;
  parcial: Parcial;
  setParcial: (p: Parcial) => void;
}) {
  const supabase = supabaseBrowser();
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevoParcial, setNuevoParcial] = useState<Parcial>(parcial);
  const [creando, setCreando] = useState(false);
  const [errorNuevo, setErrorNuevo] = useState('');
  const [edicion, setEdicion] = useState<{ nombre: string; parcial: Parcial } | null>(null);
  const [errorEdicion, setErrorEdicion] = useState('');
  const [pendientes, setPendientes] = useState(0);
  const [errorGuardar, setErrorGuardar] = useState('');

  const trabajosDelParcial = trabajos.filter((t) => t.parcial === parcial);
  // Sin uno elegido (o si se eligió en otro parcial) se muestra el más reciente.
  const seleccionado =
    trabajosDelParcial.find((t) => t.id === seleccionadoId) ?? trabajosDelParcial[trabajosDelParcial.length - 1] ?? null;

  // Aviso del navegador si intenta salir con calificaciones aún enviándose.
  useEffect(() => {
    if (pendientes === 0) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [pendientes]);

  // El parcial también se cambia desde Exámenes.
  useEffect(() => {
    setNuevoParcial(parcial);
    setEdicion(null);
  }, [parcial]);

  function cambiarParcial(p: Parcial) {
    setParcial(p);
    setSeleccionadoId(null);
  }

  async function crearTrabajo() {
    const nombre = nuevoTitulo.trim();
    if (!nombre) {
      setErrorNuevo('Escribe el título del trabajo.');
      return;
    }
    setCreando(true);
    setErrorNuevo('');
    const { data, error } = await supabase
      .from('evaluaciones')
      .insert({ grupo_id: grupoId, profesor_id: profesorId, nombre, parcial: nuevoParcial })
      .select('id, nombre, parcial')
      .single();
    setCreando(false);
    if (error || !data) {
      setErrorNuevo(error ? mensajeError(error, nuevoParcial) : 'No se pudo crear el trabajo.');
      return;
    }
    setTrabajos((prev) => [...prev, data as Trabajo]);
    setParcial(nuevoParcial);
    setSeleccionadoId(data.id);
    setNuevoTitulo('');
    setEdicion(null);
  }

  async function guardarEdicion(t: Trabajo) {
    if (!edicion) return;
    const nombre = edicion.nombre.trim();
    if (!nombre) {
      setErrorEdicion('El título no puede quedar vacío.');
      return;
    }
    setErrorEdicion('');
    const { error } = await supabase.from('evaluaciones').update({ nombre, parcial: edicion.parcial }).eq('id', t.id);
    if (error) {
      setErrorEdicion(mensajeError(error, edicion.parcial));
      return;
    }
    setTrabajos((prev) => prev.map((x) => (x.id === t.id ? { ...x, nombre, parcial: edicion.parcial } : x)));
    setParcial(edicion.parcial);
    setNuevoParcial(edicion.parcial);
    setSeleccionadoId(t.id);
    setEdicion(null);
  }

  async function eliminarTrabajo(t: Trabajo) {
    if (!confirm(`¿Eliminar "${t.nombre}"? También se borran sus calificaciones.`)) return;
    const { error } = await supabase.from('evaluaciones').delete().eq('id', t.id);
    if (error) {
      setErrorGuardar(`No se pudo eliminar el trabajo: ${error.message}`);
      return;
    }
    setTrabajos((prev) => prev.filter((x) => x.id !== t.id));
    setNotas((prev) => new Map(Array.from(prev).filter(([, n]) => n.evaluacion_id !== t.id)));
    setSeleccionadoId(null);
    setEdicion(null);
  }

  // Cada calificación se guarda al elegirla. Si falla, vuelve al valor anterior.
  async function calificar(alumno: Alumno, t: Trabajo, valor: string) {
    const clave = claveNota(alumno.id, t.id);
    const anterior = notas.get(clave);
    const nueva: NotaTrabajo | undefined =
      valor === '' ? undefined : { alumno_id: alumno.id, evaluacion_id: t.id, nota: valor === 'NE' ? 0 : Number(valor), no_entrego: valor === 'NE' };
    const poner = (n: NotaTrabajo | undefined) =>
      setNotas((prev) => {
        const copia = new Map(prev);
        if (n) copia.set(clave, n);
        else copia.delete(clave);
        return copia;
      });

    poner(nueva);
    setErrorGuardar('');
    setPendientes((n) => n + 1);
    const { error } = await conReintentos(() =>
      nueva
        ? supabase
            .from('notas')
            .upsert(
              { ...nueva, grupo_id: grupoId, profesor_id: profesorId, actualizado_en: new Date().toISOString() },
              { onConflict: 'alumno_id,evaluacion_id' }
            )
        : supabase.from('notas').delete().eq('alumno_id', alumno.id).eq('evaluacion_id', t.id)
    );
    setPendientes((n) => n - 1);
    if (error) {
      setNotas((prev) => {
        if (prev.get(clave) !== nueva) return prev; // ya la cambió otra vez
        const copia = new Map(prev);
        if (anterior) copia.set(clave, anterior);
        else copia.delete(clave);
        return copia;
      });
      setErrorGuardar(
        esErrorDeRed(error)
          ? `Sin conexión: no se guardó la calificación de ${alumno.nombre}. Vuelve a elegirla.`
          : `No se guardó la calificación de ${alumno.nombre}: ${error.message}`
      );
    }
  }

  const notasDelSeleccionado = seleccionado ? alumnos.map((a) => notas.get(claveNota(a.id, seleccionado.id))) : [];
  const calificados = notasDelSeleccionado.filter(Boolean).length;
  const noEntregaron = notasDelSeleccionado.filter((n) => n?.no_entrego).length;

  return (
    <div className="flex-1 overflow-y-auto overscroll-y-contain">
      <div className="max-w-[920px] mx-auto px-4 md:px-8 pt-5 md:pt-7 pb-10">
        <header className="mb-5">
          <p className="text-[11.5px] uppercase tracking-[0.16em] font-bold text-goldDark">Tareas y trabajos</p>
          <h1 className="font-display text-[34px] md:text-[42px] font-semibold leading-[1.02] mt-1 break-words">{grupoNombre}</h1>
          <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-inkSoft leading-snug">
            <Icono nombre="ajustes" className="w-3.5 h-3.5 mt-0.5" />
            <span>
              Los trabajos valen el {porcentajeTrabajos}% de la calificación del parcial y el examen el {100 - porcentajeTrabajos}% ·{' '}
              <Link href="/dashboard/grupos" className="font-bold text-goldDark underline-offset-2 hover:underline">
                Editar
              </Link>
            </span>
          </p>
        </header>

        <div className="mb-4">
          <SelectorParcial valor={parcial} onCambiar={cambiarParcial} />
        </div>

        <section className="bg-white border border-border rounded-card mb-4">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-display text-[22px] font-semibold leading-none">
              Trabajos del parcial {parcial}{' '}
              <span className="font-sans text-[13px] font-normal text-inkSoft">· {trabajosDelParcial.length}</span>
            </h2>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              crearTrabajo();
            }}
            className="px-4 py-3 border-b border-rule flex flex-wrap items-end gap-2"
          >
            <label className="flex-1 min-w-[180px] flex flex-col gap-1 text-[12px] font-bold text-inkSoft">
              Título del trabajo revisado
              <input
                value={nuevoTitulo}
                onChange={(e) => setNuevoTitulo(e.target.value)}
                placeholder="Ej. Tarea 3: Leyes de Newton"
                maxLength={120}
                className="w-full px-3 py-2 border border-border rounded-md text-[16px] sm:text-sm font-normal text-ink bg-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-bold text-inkSoft">
              Parcial
              <select
                value={nuevoParcial}
                onChange={(e) => setNuevoParcial(Number(e.target.value) as Parcial)}
                className="px-3 py-2 border border-border rounded-md text-[16px] sm:text-sm font-normal text-ink bg-white"
              >
                {PARCIALES.map((p) => (
                  <option key={p} value={p}>
                    Parcial {p}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={creando}
              className="min-h-[40px] px-4 rounded-md bg-navy text-white text-sm font-semibold disabled:opacity-60"
            >
              {creando ? 'Agregando…' : '+ Agregar'}
            </button>
            {errorNuevo && <p className="w-full text-[12.5px] text-red">{errorNuevo}</p>}
          </form>

          <div className="px-4 py-3">
            {trabajosDelParcial.length === 0 ? (
              <p className="text-sm text-inkSoft">Aún no hay trabajos en el parcial {parcial}. Agrega el primero arriba.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {trabajosDelParcial.map((t) => {
                  const activo = seleccionado?.id === t.id;
                  const hechos = alumnos.filter((a) => notas.has(claveNota(a.id, t.id))).length;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSeleccionadoId(t.id);
                        setEdicion(null);
                      }}
                      aria-pressed={activo}
                      className={`max-w-full min-h-[40px] inline-flex items-center gap-2 px-3 rounded-[10px] border text-[13.5px] font-semibold ${
                        activo ? 'bg-navy border-navy text-white' : 'bg-white border-border text-ink hover:bg-bg'
                      }`}
                    >
                      <span className="truncate">{t.nombre}</span>
                      <span className={`shrink-0 text-[11.5px] tabular-nums ${activo ? 'text-gold' : 'text-inkSoft'}`}>
                        {hechos}/{alumnos.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {seleccionado && (
          <section className="bg-white border border-border rounded-card">
            <div className="px-4 py-3 border-b border-border">
              {edicion ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    guardarEdicion(seleccionado);
                  }}
                  className="flex flex-wrap items-end gap-2"
                >
                  <label className="flex-1 min-w-[180px] flex flex-col gap-1 text-[12px] font-bold text-inkSoft">
                    Título
                    <input
                      autoFocus
                      value={edicion.nombre}
                      onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })}
                      maxLength={120}
                      className="w-full px-3 py-2 border border-gold rounded-md text-[16px] sm:text-sm font-normal text-ink"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-bold text-inkSoft">
                    Parcial
                    <select
                      value={edicion.parcial}
                      onChange={(e) => setEdicion({ ...edicion, parcial: Number(e.target.value) as Parcial })}
                      className="px-3 py-2 border border-border rounded-md text-[16px] sm:text-sm font-normal text-ink bg-white"
                    >
                      {PARCIALES.map((p) => (
                        <option key={p} value={p}>
                          Parcial {p}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="min-h-[40px] px-4 rounded-md bg-navy text-white text-sm font-semibold">
                    Guardar
                  </button>
                  <button type="button" onClick={() => setEdicion(null)} className="min-h-[40px] px-3 rounded-md border border-border text-sm">
                    Cancelar
                  </button>
                  {errorEdicion && <p className="w-full text-[12.5px] text-red">{errorEdicion}</p>}
                </form>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-[22px] font-semibold leading-tight break-words">{seleccionado.nombre}</h2>
                    <p className="text-[12.5px] text-inkSoft mt-0.5">
                      Parcial {seleccionado.parcial} · {calificados} de {alumnos.length} calificados
                      {noEntregaron > 0 && <> · <span className="text-red font-semibold">{noEntregaron} NE</span></>}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEdicion({ nombre: seleccionado.nombre, parcial: seleccionado.parcial });
                      setErrorEdicion('');
                    }}
                    title="Editar título o parcial"
                    aria-label="Editar título o parcial"
                    className="w-10 h-10 shrink-0 flex items-center justify-center rounded-md text-inkSoft hover:text-ink hover:bg-bg"
                  >
                    <Icono nombre="lapiz" />
                  </button>
                  <button
                    onClick={() => eliminarTrabajo(seleccionado)}
                    title="Eliminar trabajo"
                    aria-label="Eliminar trabajo"
                    className="w-10 h-10 shrink-0 flex items-center justify-center rounded-md text-red hover:bg-red/10"
                  >
                    <Icono nombre="basura" />
                  </button>
                </div>
              )}
              <p className="text-[12px] text-inkSoft mt-2">
                NE = no entregó · — = sin calificar · los dos cuentan como 0 en el promedio.{' '}
                <span className={pendientes > 0 ? 'text-amber font-bold' : ''}>
                  {pendientes > 0 ? 'Guardando…' : 'Cada calificación se guarda al elegirla.'}
                </span>
              </p>
              {errorGuardar && (
                <p role="alert" className="mt-2 text-[12.5px] text-red bg-red/10 border border-red/30 rounded-[8px] px-2.5 py-1.5">
                  {errorGuardar}
                </p>
              )}
            </div>

            <ol>
              {alumnos.map((a, i) => {
                const valor = valorNotaTrabajo(notas.get(claveNota(a.id, seleccionado.id)));
                const promedio = promedioTrabajos(a.id, trabajosDelParcial, notas);
                return (
                  <li key={a.id} className="flex items-center border-b border-rule last:border-b-0">
                    <span className="w-10 md:w-12 shrink-0 pr-2.5 text-right font-display text-[16px] text-inkSoft tabular-nums select-none">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0 border-l-2 border-red/20 pl-3 pr-3 md:pr-4 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-[15.5px] leading-snug">{a.nombre}</div>
                        <div className="text-[12px] text-inkSoft">
                          Promedio de trabajos del parcial: <b className="text-ink tabular-nums">{formatearNota(promedio)}</b>
                        </div>
                      </div>
                      <select
                        value={valor}
                        onChange={(e) => calificar(a, seleccionado, e.target.value)}
                        aria-label={`Calificación de ${a.nombre}`}
                        className={`w-[5.25rem] shrink-0 min-h-[44px] px-2 rounded-[10px] border bg-white text-[16px] font-bold text-center tabular-nums ${
                          valor === 'NE' ? 'text-red border-red/40' : valor === '' ? 'text-inkSoft border-border' : 'text-ink border-navy/30'
                        }`}
                      >
                        {OPCIONES_NOTA_TRABAJO.map((o) => (
                          <option key={o} value={o}>
                            {o === '' ? '—' : o}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                );
              })}
            </ol>

            {alumnos.length === 0 && (
              <div className="px-4 py-8 text-sm text-inkSoft text-center">Este grupo no tiene alumnos todavía.</div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

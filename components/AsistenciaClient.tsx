'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Alumno, Estatus } from '@/lib/types';
import { sanitizarNombreArchivo } from '@/lib/utils';
import { exportarAsistenciaExcel, exportarAsistenciaPDF } from '@/lib/exportAsistencia';
import { formatearObservacion } from '@/lib/formatearAsistenciaExport';
import { StatusPillGroup } from './StatusPill';
import { SyncButton } from './SyncButton';
import { AttendanceHeatmap } from './AttendanceHeatmap';
import { AiSummaryButton } from './AiSummaryButton';
import { JustificarPopover, type MotivoJustificacion } from './JustificarPopover';
import { MiniCalendario } from './MiniCalendario';
import { SeleccionarCarpetaDriveModal } from './SeleccionarCarpetaDriveModal';

interface RegistroInicial {
  estatus: Estatus;
  marcado_en: string;
  justificada: boolean;
  justificacion_motivo: MotivoJustificacion | null;
  justificacion_detalle: string | null;
}

interface Riesgo {
  porcentajeFalta: number;
  enRiesgo: boolean;
}

interface Fila {
  alumno: Alumno;
  estatus: Estatus;
  marcadoEn: string | null;
  justificada: boolean;
  justificacionMotivo: MotivoJustificacion | null;
  justificacionDetalle: string;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatearFecha(fechaISO: string) {
  const [anio, mes, dia] = fechaISO.split('-');
  return `${dia}/${mes}/${anio}`;
}

function formatearHora(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function AsistenciaClient({
  grupoId,
  grupoNombre,
  alumnosIniciales,
  registrosIniciales,
  umbralInicial,
  horasClaseSemanaInicial,
  faltasPermitidasSemestreInicial,
  riesgoPorAlumno,
  diasHeatmap
}: {
  grupoId: string;
  grupoNombre: string;
  alumnosIniciales: Alumno[];
  registrosIniciales: Record<string, RegistroInicial>;
  umbralInicial: number;
  horasClaseSemanaInicial: number;
  faltasPermitidasSemestreInicial: number;
  riesgoPorAlumno: Record<string, Riesgo>;
  diasHeatmap: { fecha: string; tasaAsistencia: number }[];
}) {
  const supabase = supabaseBrowser();
  const nombreArchivoBase = sanitizarNombreArchivo(grupoNombre);

  const umbral = umbralInicial;
  const horasClaseSemana = horasClaseSemanaInicial;
  const faltasPermitidasSemestre = faltasPermitidasSemestreInicial;

  const [fecha, setFecha] = useState(hoyISO());
  const [clase, setClase] = useState<1 | 2>(1);
  const [filas, setFilas] = useState<Fila[]>(
    alumnosIniciales.map((a) => ({
      alumno: a,
      estatus: registrosIniciales[a.id]?.estatus || 'falto',
      marcadoEn: registrosIniciales[a.id]?.marcado_en || null,
      justificada: registrosIniciales[a.id]?.justificada || false,
      justificacionMotivo: registrosIniciales[a.id]?.justificacion_motivo || null,
      justificacionDetalle: registrosIniciales[a.id]?.justificacion_detalle || ''
    }))
  );
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [online, setOnline] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [errorSync, setErrorSync] = useState('');
  const [justificandoId, setJustificandoId] = useState<string | null>(null);
  const [menuGuardarAbierto, setMenuGuardarAbierto] = useState(false);
  const [modalCarpetaAbierto, setModalCarpetaAbierto] = useState(false);
  const [guardandoManual, setGuardandoManual] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => { setOnline(true); if (dirty) sincronizarTodo(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  useEffect(() => {
    localStorage.setItem('ultimoGrupoAsistencia', grupoId);
  }, [grupoId]);

  async function cargarFechaClase(nuevaFecha: string, nuevaClase: 1 | 2) {
    setCargando(true);
    const { data: registros } = await supabase
      .from('asistencia_registros')
      .select('alumno_id, estatus, marcado_en, justificada, justificacion_motivo, justificacion_detalle')
      .eq('grupo_id', grupoId)
      .eq('fecha', nuevaFecha)
      .eq('clase', nuevaClase);

    const mapa = new Map((registros || []).map((r) => [r.alumno_id, r]));
    setFilas((prev) =>
      prev.map((f) => ({
        ...f,
        estatus: (mapa.get(f.alumno.id)?.estatus as Estatus) || 'falto',
        marcadoEn: mapa.get(f.alumno.id)?.marcado_en || null,
        justificada: mapa.get(f.alumno.id)?.justificada || false,
        justificacionMotivo: (mapa.get(f.alumno.id)?.justificacion_motivo as MotivoJustificacion) || null,
        justificacionDetalle: mapa.get(f.alumno.id)?.justificacion_detalle || ''
      }))
    );
    setDirty(false);
    setCargando(false);
  }

  function cambiarFecha(nuevaFecha: string) {
    setFecha(nuevaFecha);
    cargarFechaClase(nuevaFecha, clase);
  }

  function cambiarClase(nuevaClase: 1 | 2) {
    setClase(nuevaClase);
    cargarFechaClase(fecha, nuevaClase);
  }

  function cambiarEstatus(alumnoId: string, estatus: Estatus) {
    setFilas((prev) =>
      prev.map((f) =>
        f.alumno.id === alumnoId
          ? {
              ...f,
              estatus,
              marcadoEn: new Date().toISOString(),
              justificada: estatus === 'falto' ? f.justificada : false,
              justificacionMotivo: estatus === 'falto' ? f.justificacionMotivo : null,
              justificacionDetalle: estatus === 'falto' ? f.justificacionDetalle : ''
            }
          : f
      )
    );
    setDirty(true);
    if (estatus !== 'falto') setJustificandoId(null);
  }

  function guardarJustificacion(alumnoId: string, motivo: MotivoJustificacion, detalle: string) {
    setFilas((prev) =>
      prev.map((f) =>
        f.alumno.id === alumnoId
          ? { ...f, justificada: true, justificacionMotivo: motivo, justificacionDetalle: detalle }
          : f
      )
    );
    setDirty(true);
    setJustificandoId(null);
  }

  function quitarJustificacion(alumnoId: string) {
    setFilas((prev) =>
      prev.map((f) =>
        f.alumno.id === alumnoId
          ? { ...f, justificada: false, justificacionMotivo: null, justificacionDetalle: '' }
          : f
      )
    );
    setDirty(true);
  }

  function marcarTodosPresentes() {
    const ahora = new Date().toISOString();
    setFilas((prev) =>
      prev.map((f) => ({
        ...f,
        estatus: 'asistio' as Estatus,
        marcadoEn: ahora,
        justificada: false,
        justificacionMotivo: null,
        justificacionDetalle: ''
      }))
    );
    setDirty(true);
    setJustificandoId(null);
  }

  async function guardarEnSupabase() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No hay sesión activa');

    const registros = filas.map((f) => ({
      alumno_id: f.alumno.id,
      grupo_id: grupoId,
      profesor_id: user.id,
      fecha,
      clase,
      estatus: f.estatus,
      marcado_en: f.marcadoEn || new Date().toISOString(),
      justificada: f.estatus === 'falto' ? f.justificada : false,
      justificacion_motivo: f.estatus === 'falto' && f.justificada ? f.justificacionMotivo : null,
      justificacion_detalle: f.estatus === 'falto' && f.justificada ? f.justificacionDetalle : null
    }));
    const { error } = await supabase.from('asistencia_registros').upsert(registros, { onConflict: 'alumno_id,fecha,clase' });
    if (error) throw new Error(`No se pudo guardar en la base de datos: ${error.message}`);
  }

  async function sincronizarConDrive(carpetaDestinoId?: string) {
    const res = await fetch(`/api/asistencia/sync/${grupoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, clase, carpetaDestinoId })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || 'No se pudo sincronizar con Drive.');
    }
  }

  async function sincronizarTodo() {
    if (!navigator.onLine) return;
    setGuardando(true);
    setErrorSync('');
    try {
      await guardarEnSupabase();
      await sincronizarConDrive();
      setDirty(false);
    } catch (e: any) {
      setErrorSync(e.message || 'No se pudo sincronizar.');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEnCarpetaElegida(carpetaId: string) {
    setModalCarpetaAbierto(false);
    setGuardandoManual(true);
    setErrorSync('');
    try {
      await guardarEnSupabase();
      await sincronizarConDrive(carpetaId);
      setDirty(false);
    } catch (e: any) {
      setErrorSync(e.message || 'No se pudo guardar en la carpeta elegida.');
    } finally {
      setGuardandoManual(false);
    }
  }

  function guardarLocalmente() {
    exportarExcel();
    setMenuGuardarAbierto(false);
  }

  function filasExport() {
    return filas.map((f) => ({
      nombre: f.alumno.nombre,
      estatus: f.estatus,
      observacion: formatearObservacion(f.estatus, f.justificada, f.justificacionMotivo, f.justificacionDetalle),
      fecha: formatearFecha(fecha),
      hora: formatearHora(f.marcadoEn)
    }));
  }

  function exportarExcel() {
    exportarAsistenciaExcel(`${nombreArchivoBase}-${fecha}-clase${clase}`, filasExport());
  }

  function exportarPDF() {
    exportarAsistenciaPDF(`${grupoNombre} — ${formatearFecha(fecha)} — Clase ${clase}`, filasExport());
  }

  const estadoSync = !online ? 'sin_conexion' : guardando ? 'guardando' : dirty ? 'pendiente' : 'sincronizado';
  const enRiesgoCount = Object.values(riesgoPorAlumno).filter((r) => r.enRiesgo).length;

  const resumen = {
    total: filas.length,
    presentes: filas.filter((f) => f.estatus === 'asistio' || f.estatus === 'tardanza').length,
    aTiempo: filas.filter((f) => f.estatus === 'asistio').length,
    tardanzas: filas.filter((f) => f.estatus === 'tardanza').length,
    ausentes: filas.filter((f) => f.estatus === 'falto').length,
    justificados: filas.filter((f) => f.estatus === 'falto' && f.justificada).length
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-4 md:px-8 py-5 md:py-6 pb-14">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2.5">
          <h2 className="text-xl font-bold">{grupoNombre}</h2>
          <div className="flex items-center gap-2.5 flex-wrap">
            <SyncButton estado={estadoSync} onSync={sincronizarTodo} />
            <div className="relative">
              <button
                onClick={() => setMenuGuardarAbierto((v) => !v)}
                disabled={guardando || guardandoManual}
                className="text-sm px-4 py-2 rounded-md bg-leaf text-white font-semibold disabled:opacity-60"
              >
                {guardandoManual ? 'Guardando…' : 'Guardar asistencia'}
              </button>
              {menuGuardarAbierto && (
                <div className="absolute right-0 top-10 z-20 bg-white border border-border rounded-md shadow-lg w-64 py-1.5">
                  <button
                    onClick={() => { setMenuGuardarAbierto(false); sincronizarTodo(); }}
                    className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-leafSoft"
                  >
                    📁 Guardar en Drive (ruta automática)
                  </button>
                  <button
                    onClick={() => { setMenuGuardarAbierto(false); setModalCarpetaAbierto(true); }}
                    className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-leafSoft"
                  >
                    🗂 Elegir carpeta en Drive…
                  </button>
                  <button
                    onClick={guardarLocalmente}
                    className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-leafSoft"
                  >
                    ⬇ Guardar localmente (Excel)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <SeleccionarCarpetaDriveModal
          abierto={modalCarpetaAbierto}
          onCerrar={() => setModalCarpetaAbierto(false)}
          onConfirmar={(carpetaId) => guardarEnCarpetaElegida(carpetaId)}
        />

        {errorSync && (
          <div className="mt-3 mb-1 bg-red/10 border border-red/30 rounded-card px-3.5 py-2.5 text-sm text-red">
            ⚠️ {errorSync}
          </div>
        )}

        {enRiesgoCount > 0 && (
          <div className="flex items-center justify-between gap-2 mt-3 mb-1 bg-red/10 border border-red/30 rounded-card px-3.5 py-2.5">
            <span className="text-sm text-red">
              ⚠️ <b>{enRiesgoCount}</b> alumno(s) en riesgo (superan el {umbral}% de falta configurado para este grupo).
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 mb-2 bg-white border border-border rounded-card px-3.5 py-2.5 flex-wrap mt-3">
          <span className="text-[11.5px] text-inkSoft">
            ⚙ Umbral: {umbral}% · Horas/semana: {horasClaseSemana} · Faltas permitidas/semestre: {faltasPermitidasSemestre}
          </span>
          <Link href="/dashboard/grupos" className="text-[11.5px] text-goldDark font-semibold hover:underline ml-1">
            Editar en Grupos →
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-4 mt-3">
          <MiniCalendario fechaSeleccionada={fecha} onSeleccionar={cambiarFecha} />

          <div className="flex-1 flex flex-col gap-3">
            <div className="flex items-center gap-2 bg-white border border-border rounded-card px-3.5 py-2.5 flex-wrap">
              <span className="text-xs text-inkSoft mr-1">Clase:</span>
              <button
                onClick={() => cambiarClase(1)}
                className={`text-xs px-3.5 py-1.5 rounded-full border ${clase === 1 ? 'bg-leaf border-leaf text-white font-semibold' : 'border-border text-inkSoft'}`}
              >
                Clase 1
              </button>
              <button
                onClick={() => cambiarClase(2)}
                className={`text-xs px-3.5 py-1.5 rounded-full border ${clase === 2 ? 'bg-leaf border-leaf text-white font-semibold' : 'border-border text-inkSoft'}`}
              >
                Clase 2
              </button>

              <button
                onClick={marcarTodosPresentes}
                className="text-xs px-3.5 py-1.5 rounded-full border border-border text-inkSoft hover:bg-bg font-semibold ml-3"
              >
                ✓ Marcar todos presentes
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="bg-white border border-border rounded-card px-3.5 py-2.5 flex items-center justify-between">
                <div className="text-[10.5px] uppercase tracking-wide text-inkSoft">Total</div>
                <div className="text-xl font-bold">{resumen.total}</div>
              </div>

              <div className="bg-white border border-border rounded-card px-3.5 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10.5px] uppercase tracking-wide text-inkSoft">Presentes</div>
                  <div className="text-xl font-bold text-green">{resumen.presentes}</div>
                </div>
                <div className="flex gap-4 mt-1.5 text-[11.5px]">
                  <div className="text-inkSoft">A tiempo <span className="font-semibold text-green">{resumen.aTiempo}</span></div>
                  <div className="text-inkSoft">Retardos <span className="font-semibold text-amber">{resumen.tardanzas}</span></div>
                </div>
              </div>

              <div className="bg-white border border-border rounded-card px-3.5 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10.5px] uppercase tracking-wide text-inkSoft">Faltas</div>
                  <div className="text-xl font-bold text-red">{resumen.ausentes}</div>
                </div>
                <div className="flex gap-4 mt-1.5 text-[11.5px]">
                  <div className="text-inkSoft">Totales <span className="font-semibold text-red">{resumen.ausentes}</span></div>
                  <div className="text-inkSoft">Justificadas <span className="font-semibold text-amber">{resumen.justificados}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`bg-white border border-border rounded-card overflow-x-auto ${cargando ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="min-w-[620px]">
            <div className="grid grid-cols-[1fr_220px_260px] px-4 py-2.5 text-[11px] uppercase tracking-wide text-inkSoft border-b border-border">
              <span>Alumno</span><span>Estado</span><span>Observación</span>
            </div>
            {filas.map((f) => {
              const riesgo = riesgoPorAlumno[f.alumno.id];
              const observacion = formatearObservacion(f.estatus, f.justificada, f.justificacionMotivo, f.justificacionDetalle);
              return (
              <div
                key={f.alumno.id}
                className="grid grid-cols-[1fr_220px_260px] items-center px-4 py-2.5 border-b border-border last:border-b-0"
              >
                <span className="text-sm flex items-center gap-1.5">
                  {f.alumno.nombre}
                  {riesgo?.enRiesgo && (
                    <span title={`${riesgo.porcentajeFalta}% de falta acumulada`} className="text-red text-xs">⚠️</span>
                  )}
                </span>
                <StatusPillGroup value={f.estatus} onChange={(v) => cambiarEstatus(f.alumno.id, v)} />
                {f.estatus === 'falto' ? (
                  <div className="flex items-center gap-2">
                    {observacion && (
                      <span className="text-xs text-leafDark truncate flex-1" title={observacion}>
                        {observacion}
                      </span>
                    )}
                    <JustificarPopover
                      justificada={f.justificada}
                      motivo={f.justificacionMotivo}
                      detalle={f.justificacionDetalle}
                      abierto={justificandoId === f.alumno.id}
                      onAbrir={() => setJustificandoId(f.alumno.id)}
                      onCerrar={() => setJustificandoId(null)}
                      onGuardar={(motivo, detalle) => guardarJustificacion(f.alumno.id, motivo, detalle)}
                      onQuitar={() => { quitarJustificacion(f.alumno.id); setJustificandoId(null); }}
                    />
                  </div>
                ) : (
                  <span className="text-xs text-inkSoft">—</span>
                )}
              </div>
              );
            })}

            {filas.length === 0 && (
              <div className="px-4 py-6 text-sm text-inkSoft text-center">
                Este grupo no tiene alumnos todavía. Ve a "Alumnos" para agregarlos.
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2.5 mt-6">
          <button onClick={exportarExcel} className="px-4 py-2 rounded-md border border-border text-sm">
            Exportar Excel
          </button>
          <button onClick={exportarPDF} className="px-4 py-2 rounded-md border border-border text-sm">
            Exportar PDF
          </button>
        </div>

        <div className="mt-6">
          <AttendanceHeatmap dias={diasHeatmap} />
        </div>

        <div className="mt-6">
          <AiSummaryButton grupoId={grupoId} />
        </div>
      </div>
    </div>
  );
}

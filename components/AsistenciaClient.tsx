'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Alumno, Estatus } from '@/lib/types';
import { sanitizarNombreArchivo } from '@/lib/utils';
import { exportarAsistenciaExcel, exportarAsistenciaPDF } from '@/lib/exportAsistencia';
import { StatusPillGroup } from './StatusPill';
import { SyncButton } from './SyncButton';
import { AttendanceHeatmap } from './AttendanceHeatmap';
import { AiSummaryButton } from './AiSummaryButton';

interface RegistroInicial {
  estatus: Estatus;
  marcado_en: string;
  justificada: boolean;
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

  const [umbral, setUmbral] = useState(umbralInicial);
  const [horasClaseSemana, setHorasClaseSemana] = useState(horasClaseSemanaInicial);
  const [faltasPermitidasSemestre, setFaltasPermitidasSemestre] = useState(faltasPermitidasSemestreInicial);
  const [editandoConfig, setEditandoConfig] = useState(false);
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  const [fecha, setFecha] = useState(hoyISO());
  const [clase, setClase] = useState<1 | 2>(1);
  const [filas, setFilas] = useState<Fila[]>(
    alumnosIniciales.map((a) => ({
      alumno: a,
      estatus: registrosIniciales[a.id]?.estatus || 'falto',
      marcadoEn: registrosIniciales[a.id]?.marcado_en || null,
      justificada: registrosIniciales[a.id]?.justificada || false
    }))
  );
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [online, setOnline] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [errorSync, setErrorSync] = useState('');

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
      .select('alumno_id, estatus, marcado_en, justificada')
      .eq('grupo_id', grupoId)
      .eq('fecha', nuevaFecha)
      .eq('clase', nuevaClase);

    const mapa = new Map((registros || []).map((r) => [r.alumno_id, r]));
    setFilas((prev) =>
      prev.map((f) => ({
        ...f,
        estatus: (mapa.get(f.alumno.id)?.estatus as Estatus) || 'falto',
        marcadoEn: mapa.get(f.alumno.id)?.marcado_en || null,
        justificada: mapa.get(f.alumno.id)?.justificada || false
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
          ? { ...f, estatus, marcadoEn: new Date().toISOString(), justificada: estatus === 'falto' ? f.justificada : false }
          : f
      )
    );
    setDirty(true);
  }

  function alternarJustificada(alumnoId: string) {
    setFilas((prev) =>
      prev.map((f) => (f.alumno.id === alumnoId ? { ...f, justificada: !f.justificada } : f))
    );
    setDirty(true);
  }

  function marcarTodosPresentes() {
    const ahora = new Date().toISOString();
    setFilas((prev) => prev.map((f) => ({ ...f, estatus: 'asistio' as Estatus, marcadoEn: ahora, justificada: false })));
    setDirty(true);
  }

  async function guardarConfig() {
    setGuardandoConfig(true);
    const res = await fetch(`/api/grupos/${grupoId}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        umbralFaltaPorcentaje: umbral,
        horasClaseSemana,
        faltasPermitidasSemestre
      })
    });
    setGuardandoConfig(false);
    if (res.ok) setEditandoConfig(false);
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
      justificada: f.estatus === 'falto' ? f.justificada : false
    }));
    const { error } = await supabase.from('asistencia_registros').upsert(registros, { onConflict: 'alumno_id,fecha,clase' });
    if (error) throw new Error(`No se pudo guardar en la base de datos: ${error.message}`);
  }

  async function sincronizarConDrive() {
    await fetch(`/api/asistencia/sync/${grupoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha, clase })
    });
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

  function filasExport() {
    return filas.map((f) => ({
      nombre: f.alumno.nombre,
      estatus: f.estatus === 'falto' && f.justificada ? 'falto (justificada)' : f.estatus,
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

  const faltas = filas.filter((f) => f.estatus === 'falto').length;
  const estadoSync = !online ? 'sin_conexion' : guardando ? 'guardando' : dirty ? 'pendiente' : 'sincronizado';
  const enRiesgoCount = Object.values(riesgoPorAlumno).filter((r) => r.enRiesgo).length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-8 py-6 pb-14">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2.5">
          <h2 className="text-xl font-bold">{grupoNombre}</h2>
          <SyncButton estado={estadoSync} onSync={sincronizarTodo} />
        </div>

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
          {editandoConfig ? (
            <>
              <span className="text-[11.5px] text-inkSoft">Umbral de riesgo:</span>
              <input
                type="number"
                min={1}
                max={100}
                value={umbral}
                onChange={(e) => setUmbral(Number(e.target.value))}
                className="w-16 text-xs border border-border rounded px-2 py-1"
              />
              <span className="text-[11.5px] text-inkSoft">%</span>

              <span className="text-[11.5px] text-inkSoft ml-3">Horas de clase/semana:</span>
              <input
                type="number"
                min={0}
                value={horasClaseSemana}
                onChange={(e) => setHorasClaseSemana(Number(e.target.value))}
                className="w-16 text-xs border border-border rounded px-2 py-1"
              />

              <span className="text-[11.5px] text-inkSoft ml-3">Faltas permitidas/semestre:</span>
              <input
                type="number"
                min={0}
                value={faltasPermitidasSemestre}
                onChange={(e) => setFaltasPermitidasSemestre(Number(e.target.value))}
                className="w-16 text-xs border border-border rounded px-2 py-1"
              />

              <button
                onClick={guardarConfig}
                disabled={guardandoConfig}
                className="text-[11.5px] px-2 py-1 rounded bg-navy text-white font-semibold ml-2"
              >
                {guardandoConfig ? '...' : 'Guardar'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditandoConfig(true)} className="text-[11.5px] text-inkSoft hover:underline">
              ⚙ Umbral: {umbral}% · Horas/semana: {horasClaseSemana} · Faltas permitidas/semestre: {faltasPermitidasSemestre}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 mb-4 bg-white border border-border rounded-card px-3.5 py-2.5 flex-wrap">
          <span className="text-xs text-inkSoft mr-1">Fecha:</span>
          <input
            type="date"
            value={fecha}
            onChange={(e) => cambiarFecha(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1.5"
          />

          <span className="text-xs text-inkSoft ml-3 mr-1">Clase:</span>
          <button
            onClick={() => cambiarClase(1)}
            className={`text-xs px-3.5 py-1.5 rounded-full border ${clase === 1 ? 'bg-navy border-navy text-white font-semibold' : 'border-border text-inkSoft'}`}
          >
            Clase 1
          </button>
          <button
            onClick={() => cambiarClase(2)}
            className={`text-xs px-3.5 py-1.5 rounded-full border ${clase === 2 ? 'bg-navy border-navy text-white font-semibold' : 'border-border text-inkSoft'}`}
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

        <div className={`bg-white border border-border rounded-card overflow-hidden ${cargando ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="grid grid-cols-[1fr_300px_120px] px-4 py-2.5 text-[11px] uppercase tracking-wide text-inkSoft border-b border-border">
            <span>Alumno</span><span>Asistencia</span><span>Justificar</span>
          </div>
          {filas.map((f) => {
            const riesgo = riesgoPorAlumno[f.alumno.id];
            return (
            <div
              key={f.alumno.id}
              className="grid grid-cols-[1fr_300px_120px] items-center px-4 py-2.5 border-b border-border last:border-b-0"
            >
              <span className="text-sm flex items-center gap-1.5">
                {f.alumno.nombre}
                {riesgo?.enRiesgo && (
                  <span title={`${riesgo.porcentajeFalta}% de falta acumulada`} className="text-red text-xs">⚠️</span>
                )}
                {f.estatus === 'falto' && f.justificada && (
                  <span title="Falta justificada" className="text-green text-xs">✓ justificada</span>
                )}
              </span>
              <StatusPillGroup value={f.estatus} onChange={(v) => cambiarEstatus(f.alumno.id, v)} />
              {f.estatus === 'falto' && (
                <button
                  onClick={() => alternarJustificada(f.alumno.id)}
                  className={`text-xs px-2.5 py-1.5 rounded-full border whitespace-nowrap ${f.justificada ? 'border-green text-green bg-green/10' : 'border-border text-inkSoft'}`}
                >
                  {f.justificada ? '✓ Justificada' : 'Justificar'}
                </button>
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

        <div className="text-xs text-inkSoft mt-3">
          <b>{faltas}</b> falta(s) — {formatearFecha(fecha)}, Clase {clase}.
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

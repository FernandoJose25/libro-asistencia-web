'use client';

import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Alumno, Estatus } from '@/lib/types';
import { StatusPillGroup } from './StatusPill';
import { SyncButton } from './SyncButton';

interface Fila {
  alumno: Alumno;
  estatus: Estatus;
}

export function AttendanceClient({
  grupoId,
  grupoNombre,
  alumnosIniciales,
  estatusIniciales,
  horasIniciales
}: {
  grupoId: string;
  grupoNombre: string;
  alumnosIniciales: Alumno[];
  estatusIniciales: Record<string, Estatus>;
  horasIniciales: 1 | 2;
}) {
  const supabase = supabaseBrowser();
  const hoy = new Date().toISOString().slice(0, 10);

  const [filas, setFilas] = useState<Fila[]>(
    alumnosIniciales.map((a) => ({ alumno: a, estatus: estatusIniciales[a.id] || 'falto' }))
  );
  const [horas, setHoras] = useState<1 | 2>(horasIniciales);
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [online, setOnline] = useState(true);
  const [gestionando, setGestionando] = useState(false);
  const [nuevoAlumno, setNuevoAlumno] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEdit, setNombreEdit] = useState('');

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

  function cambiarEstatus(alumnoId: string, estatus: Estatus) {
    setFilas((prev) => prev.map((f) => (f.alumno.id === alumnoId ? { ...f, estatus } : f)));
    setDirty(true);
  }

  function cambiarHoras(h: 1 | 2) {
    setHoras(h);
    setDirty(true);
  }

  async function agregarAlumno() {
    const nombre = nuevoAlumno.trim();
    if (!nombre) return;
    const orden = filas.length;
    const { data, error } = await supabase
      .from('alumnos')
      .insert({ grupo_id: grupoId, nombre, orden })
      .select('id, grupo_id, nombre, orden')
      .single();
    if (error || !data) return;
    setFilas((prev) => [...prev, { alumno: data, estatus: 'falto' }]);
    setNuevoAlumno('');
  }

  function empezarEdicion(alumno: Alumno) {
    setEditandoId(alumno.id);
    setNombreEdit(alumno.nombre);
  }

  async function guardarNombre(alumnoId: string) {
    const nombre = nombreEdit.trim();
    setEditandoId(null);
    if (!nombre) return;
    await supabase.from('alumnos').update({ nombre }).eq('id', alumnoId);
    setFilas((prev) => prev.map((f) => (f.alumno.id === alumnoId ? { ...f, alumno: { ...f.alumno, nombre } } : f)));
  }

  async function eliminarAlumno(alumnoId: string) {
    if (!confirm('¿Eliminar a este alumno? También se borra su historial de asistencia.')) return;
    await supabase.from('alumnos').delete().eq('id', alumnoId);
    setFilas((prev) => prev.filter((f) => f.alumno.id !== alumnoId));
  }

  async function moverAlumno(index: number, direccion: -1 | 1) {
    const destino = index + direccion;
    if (destino < 0 || destino >= filas.length) return;
    const copia = [...filas];
    [copia[index], copia[destino]] = [copia[destino], copia[index]];
    setFilas(copia);
    await Promise.all(
      copia.map((f, i) => supabase.from('alumnos').update({ orden: i }).eq('id', f.alumno.id))
    );
  }

  async function guardarEnSupabase() {
    const registros = filas.map((f) => ({
      alumno_id: f.alumno.id,
      fecha: hoy,
      estatus: f.estatus,
      horas_clase_dia: horas
    }));
    await supabase.from('registros_asistencia').upsert(registros, { onConflict: 'alumno_id,fecha' });
  }

  async function sincronizarConDrive() {
    await fetch(`/api/drive/sync-file/${grupoId}`, { method: 'POST' });
  }

  async function sincronizarTodo() {
    if (!navigator.onLine) return;
    setGuardando(true);
    try {
      await guardarEnSupabase();
      await sincronizarConDrive();
      setDirty(false);
    } finally {
      setGuardando(false);
    }
  }

  const faltas = filas.filter((f) => f.estatus === 'falto').length;

  function exportarExcel() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Alumno', 'Estatus'],
      ...filas.map((f) => [f.alumno.nombre, f.estatus])
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, grupoNombre);
    XLSX.writeFile(wb, `${grupoNombre}-${hoy}.xlsx`);
  }

  function exportarPDF() {
    // Genera una vista imprimible y abre el diálogo de impresión del navegador (Guardar como PDF).
    const ventana = window.open('', '_blank');
    if (!ventana) return;
    const filasHtml = filas
      .map((f) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #ddd;">${f.alumno.nombre}</td><td style="padding:6px 10px;border-bottom:1px solid #ddd;">${f.estatus}</td></tr>`)
      .join('');
    ventana.document.write(`
      <html><head><title>${grupoNombre} — ${hoy}</title></head>
      <body style="font-family:sans-serif;padding:24px;">
        <h2>${grupoNombre} — ${hoy}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr><th style="text-align:left;padding:6px 10px;">Alumno</th><th style="text-align:left;padding:6px 10px;">Estatus</th></tr></thead>
          <tbody>${filasHtml}</tbody>
        </table>
        <script>window.onload = () => window.print();</script>
      </body></html>
    `);
    ventana.document.close();
  }

  const estadoSync = !online ? 'sin_conexion' : guardando ? 'guardando' : dirty ? 'pendiente' : 'sincronizado';

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-8 py-6 pb-14">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2.5">
          <h2 className="text-xl font-bold">{grupoNombre}</h2>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setGestionando((v) => !v)}
              className={`px-3.5 py-2 rounded-md border text-sm font-semibold ${
                gestionando ? 'bg-navy border-navy text-white' : 'border-border text-inkSoft'
              }`}
            >
              👥 Gestionar alumnos
            </button>
            <SyncButton estado={estadoSync} onSync={sincronizarTodo} />
          </div>
        </div>
        <div className="text-xs text-inkSoft font-mono mb-4">{hoy}</div>

        <div className="flex items-center gap-2 mb-4 bg-white border border-border rounded-card px-3.5 py-2.5">
          <span className="text-xs text-inkSoft mr-1">Clase de hoy:</span>
          <button
            onClick={() => cambiarHoras(1)}
            className={`text-xs px-3.5 py-1.5 rounded-full border ${horas === 1 ? 'bg-navy border-navy text-white font-semibold' : 'border-border text-inkSoft'}`}
          >
            1 hora
          </button>
          <button
            onClick={() => cambiarHoras(2)}
            className={`text-xs px-3.5 py-1.5 rounded-full border ${horas === 2 ? 'bg-navy border-navy text-white font-semibold' : 'border-border text-inkSoft'}`}
          >
            2 horas
          </button>
          <span className="text-[11.5px] text-inkSoft ml-auto">Las faltas de un día de 2h cuentan doble.</span>
        </div>

        <div className="bg-white border border-border rounded-card overflow-hidden">
          <div className={`grid ${gestionando ? 'grid-cols-[24px_1fr_300px_84px]' : 'grid-cols-[1fr_300px]'} px-4 py-2.5 text-[11px] uppercase tracking-wide text-inkSoft border-b border-border`}>
            {gestionando && <span />}
            <span>Alumno</span><span>Asistencia</span>
            {gestionando && <span>Acciones</span>}
          </div>
          {filas.map((f, i) => (
            <div
              key={f.alumno.id}
              className={`grid ${gestionando ? 'grid-cols-[24px_1fr_300px_84px]' : 'grid-cols-[1fr_300px]'} items-center px-4 py-2.5 border-b border-border last:border-b-0`}
            >
              {gestionando && (
                <div className="flex flex-col text-inkSoft text-[10px] leading-none">
                  <button onClick={() => moverAlumno(i, -1)} disabled={i === 0} className="disabled:opacity-20">▲</button>
                  <button onClick={() => moverAlumno(i, 1)} disabled={i === filas.length - 1} className="disabled:opacity-20">▼</button>
                </div>
              )}

              {editandoId === f.alumno.id ? (
                <input
                  autoFocus
                  value={nombreEdit}
                  onChange={(e) => setNombreEdit(e.target.value)}
                  onBlur={() => guardarNombre(f.alumno.id)}
                  onKeyDown={(e) => e.key === 'Enter' && guardarNombre(f.alumno.id)}
                  className="text-sm border border-gold rounded px-2 py-1 w-full max-w-[260px]"
                />
              ) : (
                <span
                  className={`text-sm ${gestionando ? 'cursor-text hover:underline' : ''}`}
                  onClick={() => gestionando && empezarEdicion(f.alumno)}
                >
                  {f.alumno.nombre}
                </span>
              )}

              <StatusPillGroup value={f.estatus} onChange={(v) => cambiarEstatus(f.alumno.id, v)} />

              {gestionando && (
                <div className="flex gap-2 justify-end">
                  <button onClick={() => empezarEdicion(f.alumno)} title="Renombrar" className="text-inkSoft hover:text-ink">✎</button>
                  <button onClick={() => eliminarAlumno(f.alumno.id)} title="Eliminar" className="text-red">🗑</button>
                </div>
              )}
            </div>
          ))}

          {gestionando && (
            <div className="flex gap-2 items-center px-4 py-3 bg-bg/60">
              <input
                value={nuevoAlumno}
                onChange={(e) => setNuevoAlumno(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && agregarAlumno()}
                placeholder="Nombre del nuevo alumno…"
                className="flex-1 text-sm border border-border rounded-md px-3 py-2"
              />
              <button onClick={agregarAlumno} className="px-4 py-2 rounded-md bg-navy text-white text-sm font-semibold">
                + Agregar
              </button>
            </div>
          )}

          {filas.length === 0 && !gestionando && (
            <div className="px-4 py-6 text-sm text-inkSoft text-center">
              Este grupo no tiene alumnos todavía. Click en "Gestionar alumnos" para agregarlos.
            </div>
          )}
        </div>

        <div className="text-xs text-inkSoft mt-3">
          <b>{faltas}</b> falta(s) hoy × <b>{horas}h</b> = <b>{faltas * horas}</b> hora(s) de falta acumuladas para este grupo.
        </div>

        <div className="flex gap-2.5 mt-6">
          <button onClick={exportarExcel} className="px-4 py-2 rounded-md border border-border text-sm">
            Exportar Excel
          </button>
          <button onClick={exportarPDF} className="px-4 py-2 rounded-md border border-border text-sm">
            Exportar PDF
          </button>
        </div>
      </div>
    </div>
  );
}

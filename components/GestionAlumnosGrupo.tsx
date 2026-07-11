'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Alumno } from '@/lib/types';
import { NuevoGrupoModal } from './NuevoGrupoModal';

// Lee la primera columna de un .xlsx/.csv (sin encabezado) como nombres de
// alumnos — mismo criterio que lib/drive.ts:leerAlumnosDeArchivo, pero
// leyendo un archivo subido desde el navegador en vez de uno de Drive.
async function leerNombresDeArchivoLocal(archivo: File): Promise<string[]> {
  const buffer = await archivo.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  return rows
    .slice(1)
    .map((r) => (r[0] || '').toString().trim())
    .filter((n) => n.length > 0);
}

interface GrupoConAlumnos {
  id: string;
  nombre: string;
  activo: boolean;
  umbral_falta_porcentaje: number;
  horas_clase_semana: number;
  faltas_permitidas_semestre: number;
  alumnos: Alumno[];
}

interface ConfigEdit {
  umbral: number;
  horasClaseSemana: number;
  faltasPermitidasSemestre: number;
}

export function GestionAlumnosGrupo({ grupos }: { grupos: GrupoConAlumnos[] }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [nuevoAlumno, setNuevoAlumno] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEdit, setNombreEdit] = useState('');
  const [configEdit, setConfigEdit] = useState<Record<string, ConfigEdit>>({});
  const [guardandoConfig, setGuardandoConfig] = useState<string | null>(null);
  const [importando, setImportando] = useState<string | null>(null);
  const [errorImport, setErrorImport] = useState<Record<string, string>>({});
  const inputArchivoRef = useRef<Record<string, HTMLInputElement | null>>({});

  async function agregarAlumno(grupoId: string, orden: number) {
    const nombre = nuevoAlumno.trim();
    if (!nombre) return;
    await supabase.from('alumnos').insert({ grupo_id: grupoId, nombre, orden });
    setNuevoAlumno('');
    router.refresh();
  }

  async function importarExcel(grupoId: string, orden: number, archivo: File) {
    setImportando(grupoId);
    setErrorImport((prev) => ({ ...prev, [grupoId]: '' }));
    try {
      const nombres = await leerNombresDeArchivoLocal(archivo);
      if (nombres.length === 0) {
        setErrorImport((prev) => ({ ...prev, [grupoId]: 'No se encontraron nombres en la primera columna del archivo.' }));
        return;
      }
      const filas = nombres.map((nombre, i) => ({ grupo_id: grupoId, nombre, orden: orden + i }));
      const { error } = await supabase.from('alumnos').insert(filas);
      if (error) {
        setErrorImport((prev) => ({ ...prev, [grupoId]: error.message }));
        return;
      }
      router.refresh();
    } catch (e: any) {
      setErrorImport((prev) => ({ ...prev, [grupoId]: e.message || 'No se pudo leer el archivo.' }));
    } finally {
      setImportando(null);
    }
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
    router.refresh();
  }

  async function eliminarAlumno(alumnoId: string) {
    if (!confirm('¿Eliminar a este alumno? También se borra su historial de asistencia.')) return;
    await supabase.from('alumnos').delete().eq('id', alumnoId);
    router.refresh();
  }

  async function moverAlumno(alumnos: Alumno[], index: number, direccion: -1 | 1) {
    const destino = index + direccion;
    if (destino < 0 || destino >= alumnos.length) return;
    const copia = [...alumnos];
    [copia[index], copia[destino]] = [copia[destino], copia[index]];
    await Promise.all(copia.map((a, i) => supabase.from('alumnos').update({ orden: i }).eq('id', a.id)));
    router.refresh();
  }

  async function alternarActivo(grupoId: string, activo: boolean) {
    await supabase.from('grupos').update({ activo: !activo }).eq('id', grupoId);
    router.refresh();
  }

  async function guardarConfigGrupo(grupoId: string, config: ConfigEdit) {
    setGuardandoConfig(grupoId);
    await fetch(`/api/grupos/${grupoId}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        umbralFaltaPorcentaje: config.umbral,
        horasClaseSemana: config.horasClaseSemana,
        faltasPermitidasSemestre: config.faltasPermitidasSemestre
      })
    });
    setGuardandoConfig(null);
    router.refresh();
  }

  return (
    <div className="bg-white border border-border rounded-card overflow-hidden mb-6">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-bold">Grupos</h3>
        <NuevoGrupoModal />
      </div>

      {grupos.length === 0 && (
        <div className="px-4 py-6 text-sm text-inkSoft text-center">
          Aún no tienes grupos. Crea uno con "+ Nuevo grupo".
        </div>
      )}

      {grupos.map((g) => {
        const expandido = expandidoId === g.id;
        const config = configEdit[g.id] ?? {
          umbral: g.umbral_falta_porcentaje,
          horasClaseSemana: g.horas_clase_semana,
          faltasPermitidasSemestre: g.faltas_permitidas_semestre
        };
        const setConfig = (cambios: Partial<ConfigEdit>) =>
          setConfigEdit((prev) => ({ ...prev, [g.id]: { ...config, ...cambios } }));
        return (
          <div key={g.id} className="border-b border-border last:border-b-0">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => setExpandidoId(expandido ? null : g.id)}
                className="text-sm font-semibold text-left flex items-center gap-2"
              >
                <span className="text-inkSoft text-xs">{expandido ? '▾' : '▸'}</span>
                {g.nombre}
                {!g.activo && <span className="text-[10px] text-inkSoft font-normal">(inactivo)</span>}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-inkSoft">{g.alumnos.length} alumno(s)</span>
                <button
                  onClick={() => alternarActivo(g.id, g.activo)}
                  className="text-[11px] px-2.5 py-1 rounded border border-border text-inkSoft"
                >
                  {g.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>

            {expandido && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  <span className="text-[11.5px] text-inkSoft">Umbral de riesgo:</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={config.umbral}
                    onChange={(e) => setConfig({ umbral: Number(e.target.value) })}
                    className="w-16 text-xs border border-border rounded px-2 py-1"
                  />
                  <span className="text-[11.5px] text-inkSoft">%</span>

                  <span className="text-[11.5px] text-inkSoft ml-3">Horas de clase/semana:</span>
                  <input
                    type="number"
                    min={0}
                    value={config.horasClaseSemana}
                    onChange={(e) => setConfig({ horasClaseSemana: Number(e.target.value) })}
                    className="w-16 text-xs border border-border rounded px-2 py-1"
                  />

                  <span className="text-[11.5px] text-inkSoft ml-3">Faltas permitidas/semestre:</span>
                  <input
                    type="number"
                    min={0}
                    value={config.faltasPermitidasSemestre}
                    onChange={(e) => setConfig({ faltasPermitidasSemestre: Number(e.target.value) })}
                    className="w-16 text-xs border border-border rounded px-2 py-1"
                  />

                  <button
                    onClick={() => guardarConfigGrupo(g.id, config)}
                    disabled={guardandoConfig === g.id}
                    className="text-[11.5px] px-2 py-1 rounded bg-navy text-white font-semibold ml-2"
                  >
                    {guardandoConfig === g.id ? '...' : 'Guardar'}
                  </button>
                </div>

                <div className="border border-border rounded-md overflow-hidden">
                  {g.alumnos.map((a, i) => (
                    <div
                      key={a.id}
                      className="grid grid-cols-[24px_1fr_84px] items-center px-3 py-2 border-b border-border last:border-b-0"
                    >
                      <div className="flex flex-col text-inkSoft text-[10px] leading-none">
                        <button onClick={() => moverAlumno(g.alumnos, i, -1)} disabled={i === 0} className="disabled:opacity-20">▲</button>
                        <button onClick={() => moverAlumno(g.alumnos, i, 1)} disabled={i === g.alumnos.length - 1} className="disabled:opacity-20">▼</button>
                      </div>

                      {editandoId === a.id ? (
                        <input
                          autoFocus
                          value={nombreEdit}
                          onChange={(e) => setNombreEdit(e.target.value)}
                          onBlur={() => guardarNombre(a.id)}
                          onKeyDown={(e) => e.key === 'Enter' && guardarNombre(a.id)}
                          className="text-sm border border-gold rounded px-2 py-1 w-full max-w-[260px]"
                        />
                      ) : (
                        <span className="text-sm cursor-text hover:underline" onClick={() => empezarEdicion(a)}>
                          {a.nombre}
                        </span>
                      )}

                      <div className="flex gap-2 justify-end">
                        <button onClick={() => empezarEdicion(a)} title="Renombrar" className="text-inkSoft hover:text-ink">✎</button>
                        <button onClick={() => eliminarAlumno(a.id)} title="Eliminar" className="text-red">🗑</button>
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2 items-center px-3 py-2.5 bg-bg/60">
                    <input
                      value={nuevoAlumno}
                      onChange={(e) => setNuevoAlumno(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && agregarAlumno(g.id, g.alumnos.length)}
                      placeholder="Nombre del nuevo alumno…"
                      className="flex-1 text-sm border border-border rounded-md px-3 py-2"
                    />
                    <button
                      onClick={() => agregarAlumno(g.id, g.alumnos.length)}
                      className="px-4 py-2 rounded-md bg-navy text-white text-sm font-semibold"
                    >
                      + Agregar
                    </button>
                    <input
                      ref={(el) => { inputArchivoRef.current[g.id] = el; }}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const archivo = e.target.files?.[0];
                        if (archivo) importarExcel(g.id, g.alumnos.length, archivo);
                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={() => inputArchivoRef.current[g.id]?.click()}
                      disabled={importando === g.id}
                      className="px-4 py-2 rounded-md border border-border text-sm font-semibold whitespace-nowrap disabled:opacity-60"
                    >
                      {importando === g.id ? 'Importando…' : '📄 Importar Excel'}
                    </button>
                  </div>
                  {errorImport[g.id] && <p className="text-xs text-red px-3 pb-2">{errorImport[g.id]}</p>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Alumno } from '@/lib/types';
import { NuevoGrupoModal } from './NuevoGrupoModal';

interface GrupoConAlumnos {
  id: string;
  nombre: string;
  activo: boolean;
  umbral_falta_porcentaje: number;
  alumnos: Alumno[];
}

export function GestionAlumnosGrupo({ grupos }: { grupos: GrupoConAlumnos[] }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [nuevoAlumno, setNuevoAlumno] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEdit, setNombreEdit] = useState('');
  const [umbralEdit, setUmbralEdit] = useState<Record<string, number>>({});
  const [guardandoUmbral, setGuardandoUmbral] = useState<string | null>(null);

  async function agregarAlumno(grupoId: string, orden: number) {
    const nombre = nuevoAlumno.trim();
    if (!nombre) return;
    await supabase.from('alumnos').insert({ grupo_id: grupoId, nombre, orden });
    setNuevoAlumno('');
    router.refresh();
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

  async function guardarUmbral(grupoId: string) {
    setGuardandoUmbral(grupoId);
    await fetch(`/api/grupos/${grupoId}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ umbralFaltaPorcentaje: umbralEdit[grupoId] })
    });
    setGuardandoUmbral(null);
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
        const umbral = umbralEdit[g.id] ?? g.umbral_falta_porcentaje;
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
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-[11.5px] text-inkSoft">Umbral de riesgo:</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={umbral}
                    onChange={(e) => setUmbralEdit((prev) => ({ ...prev, [g.id]: Number(e.target.value) }))}
                    className="w-16 text-xs border border-border rounded px-2 py-1"
                  />
                  <span className="text-[11.5px] text-inkSoft">%</span>
                  <button
                    onClick={() => guardarUmbral(g.id)}
                    disabled={guardandoUmbral === g.id}
                    className="text-[11.5px] px-2 py-1 rounded bg-navy text-white font-semibold"
                  >
                    {guardandoUmbral === g.id ? '...' : 'Guardar'}
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
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

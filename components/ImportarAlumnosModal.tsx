'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { leerAlumnosDeArchivoLocal, resolverGrupoPorNombre, type FilaAlumnoImportado } from '@/lib/importarAlumnosExcel';

interface GrupoOpcion {
  id: string;
  nombre: string;
}

export function ImportarAlumnosModal({ grupos }: { grupos: GrupoOpcion[] }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<FilaAlumnoImportado[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [grupoPorDefecto, setGrupoPorDefecto] = useState('');
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const gruposEnArchivo = new Set(filas.map((f) => f.grupoNombre).filter(Boolean));
  const necesitaGrupoPorDefecto = filas.some((f) => !f.grupoNombre);

  async function elegirArchivo(archivo: File) {
    setError('');
    setNombreArchivo(archivo.name);
    try {
      const leidas = await leerAlumnosDeArchivoLocal(archivo);
      if (leidas.length === 0) {
        setError('No se encontraron alumnos en el archivo.');
        setFilas([]);
        return;
      }
      setFilas(leidas);
    } catch (e: any) {
      setError(e.message || 'No se pudo leer el archivo.');
      setFilas([]);
    }
  }

  async function confirmarImportacion() {
    if (filas.length === 0) return;
    if (necesitaGrupoPorDefecto && !grupoPorDefecto) {
      setError('El archivo tiene alumnos sin grupo indicado. Elige un grupo por defecto.');
      return;
    }
    setImportando(true);
    setError('');
    try {
      const cacheGrupos = new Map<string, string>();
      const ordenPorGrupo = new Map<string, number>();

      for (const fila of filas) {
        const nombreGrupo = fila.grupoNombre || grupos.find((g) => g.id === grupoPorDefecto)?.nombre || '';
        const { id: grupoId } = await resolverGrupoPorNombre(nombreGrupo, grupos, cacheGrupos);

        if (!ordenPorGrupo.has(grupoId)) {
          const { count } = await supabase
            .from('alumnos')
            .select('id', { count: 'exact', head: true })
            .eq('grupo_id', grupoId);
          ordenPorGrupo.set(grupoId, count || 0);
        }
        const orden = ordenPorGrupo.get(grupoId)!;
        ordenPorGrupo.set(grupoId, orden + 1);

        const { error: insertError } = await supabase.from('alumnos').insert({
          grupo_id: grupoId,
          nombre: fila.nombreCompleto,
          apellidos: fila.apellidos,
          nombres: fila.nombres,
          orden
        });
        if (insertError) throw new Error(insertError.message);
      }

      setAbierto(false);
      setFilas([]);
      setNombreArchivo('');
      setGrupoPorDefecto('');
      router.refresh();
    } catch (e: any) {
      setError(e.message || 'No se pudo completar la importación.');
    } finally {
      setImportando(false);
    }
  }

  function cerrar() {
    setAbierto(false);
    setFilas([]);
    setNombreArchivo('');
    setGrupoPorDefecto('');
    setError('');
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="px-4 py-2 text-sm rounded-md border border-dashed border-border text-goldDark font-semibold whitespace-nowrap hover:bg-gold/5"
      >
        📥 Importar Excel
      </button>

      {abierto && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={cerrar}>
          <div className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-[560px] max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-1">Importar alumnos desde Excel</h3>
            <p className="text-xs text-inkSoft mb-4">
              Reconoce columnas <strong>Nro, Apellidos, Nombres y Grupo</strong> en cualquier orden. Si el archivo no
              trae columna de Grupo, se asignan todos al grupo que elijas abajo.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) elegirArchivo(archivo);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full px-4 py-2.5 rounded-md border border-border text-sm font-semibold mb-3"
            >
              {nombreArchivo ? `📄 ${nombreArchivo}` : 'Elegir archivo…'}
            </button>

            {filas.length > 0 && (
              <>
                <p className="text-xs text-inkSoft mb-2">
                  {filas.length} alumno(s) detectado(s)
                  {gruposEnArchivo.size > 0 ? `, ${gruposEnArchivo.size} grupo(s) en el archivo` : ''}.
                </p>

                {necesitaGrupoPorDefecto && (
                  <div className="mb-3">
                    <label className="block text-xs text-inkSoft mb-1">
                      Grupo por defecto (para filas sin columna Grupo)
                    </label>
                    <select
                      value={grupoPorDefecto}
                      onChange={(e) => setGrupoPorDefecto(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm bg-white"
                    >
                      <option value="">Elige un grupo…</option>
                      {grupos.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="border border-border rounded-md mb-3 max-h-[240px] overflow-auto">
                  <div className="min-w-[420px]">
                  <div className="grid grid-cols-[40px_1fr_1fr_1fr] gap-2 px-3 py-1.5 text-[10px] uppercase text-inkSoft bg-bg/60 border-b border-border sticky top-0">
                    <div>Nro</div>
                    <div>Apellidos</div>
                    <div>Nombres</div>
                    <div>Grupo</div>
                  </div>
                  {filas.map((f, i) => (
                    <div key={i} className="grid grid-cols-[40px_1fr_1fr_1fr] gap-2 px-3 py-1.5 text-xs border-b border-border last:border-b-0">
                      <div className="text-inkSoft">{i + 1}</div>
                      <div>{f.apellidos || '—'}</div>
                      <div>{f.nombres || f.nombreCompleto}</div>
                      <div className="text-inkSoft">{f.grupoNombre || '(por defecto)'}</div>
                    </div>
                  ))}
                  </div>
                </div>
              </>
            )}

            {error && <p className="text-sm text-red mb-3">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={confirmarImportacion}
                disabled={importando || filas.length === 0}
                className="flex-1 py-2.5 rounded-md bg-navy text-white text-sm font-semibold disabled:opacity-60"
              >
                {importando ? 'Importando…' : `Importar ${filas.length || ''} alumno(s)`}
              </button>
              <button onClick={cerrar} className="px-4 py-2.5 rounded-md border border-border text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

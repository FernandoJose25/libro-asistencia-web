'use client';

import { useCallback, useEffect, useState } from 'react';

interface ItemCarpeta {
  id: string;
  nombre: string;
  esCarpeta: boolean;
}

interface Crumb {
  id: string;
  nombre: string;
}

export function SeleccionarCarpetaDriveModal({
  abierto,
  onCerrar,
  onConfirmar
}: {
  abierto: boolean;
  onCerrar: () => void;
  onConfirmar: (carpetaId: string, carpetaNombre: string) => void;
}) {
  const [carpetaId, setCarpetaId] = useState<string | undefined>(undefined);
  const [carpetas, setCarpetas] = useState<ItemCarpeta[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<Crumb[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async (id?: string) => {
    setCargando(true);
    setError('');
    try {
      const res = await fetch(`/api/drive/browse${id ? `?carpetaId=${id}` : ''}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCarpetas((data.items || []).filter((i: ItemCarpeta) => i.esCarpeta));
      setBreadcrumb(data.breadcrumb || []);
    } catch {
      setError('No se pudo leer tu Drive. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (abierto) {
      setCarpetaId(undefined);
      cargar(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  if (!abierto) return null;

  const nombreActual = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].nombre : 'Mi unidad';

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onCerrar}>
      <div
        className="bg-white rounded-xl p-5 w-full max-w-[420px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-sm mb-3">Elegí dónde guardar</h3>

        <div className="flex items-center gap-1.5 text-xs text-inkSoft mb-3 flex-wrap">
          <button onClick={() => { setCarpetaId(undefined); cargar(undefined); }} className="hover:text-ink hover:underline">
            Mi unidad
          </button>
          {breadcrumb.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5">
              <span>/</span>
              <button onClick={() => { setCarpetaId(c.id); cargar(c.id); }} className="hover:text-ink hover:underline">
                {c.nombre}
              </button>
            </span>
          ))}
        </div>

        {error && <p className="text-xs text-red mb-3">{error}</p>}

        <div className="flex-1 overflow-y-auto border border-border rounded-md min-h-[180px]">
          {cargando ? (
            <div className="flex items-center gap-2 text-xs text-inkSoft py-8 justify-center">
              <span className="w-3 h-3 border-2 border-border border-t-leaf rounded-full animate-spin" />
              Cargando…
            </div>
          ) : carpetas.length === 0 ? (
            <div className="text-xs text-inkSoft py-8 text-center">No hay carpetas aquí.</div>
          ) : (
            carpetas.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCarpetaId(c.id); cargar(c.id); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-leafSoft border-b border-border last:border-b-0 flex items-center gap-2"
              >
                📁 {c.nombre}
              </button>
            ))
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onConfirmar(carpetaId || 'root', nombreActual)}
            className="flex-1 py-2.5 rounded-md bg-leaf text-white text-sm font-semibold"
          >
            Guardar aquí ({nombreActual})
          </button>
          <button onClick={onCerrar} className="px-4 py-2.5 rounded-md border border-border text-sm text-inkSoft">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

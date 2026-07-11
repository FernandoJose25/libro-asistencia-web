'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ItemDrive {
  id: string;
  nombre: string;
  mimeType: string;
  esCarpeta: boolean;
  esAsistencia: boolean;
  iconLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

interface Crumb {
  id: string;
  nombre: string;
}

function iconoPara(item: ItemDrive) {
  if (item.esCarpeta) return '📁';
  if (item.esAsistencia) return '📊';
  if (item.mimeType.includes('image')) return '🖼️';
  if (item.mimeType.includes('pdf')) return '📕';
  if (item.mimeType.includes('document') || item.mimeType.includes('word')) return '📄';
  if (item.mimeType.includes('presentation')) return '📽️';
  if (item.mimeType.includes('video')) return '🎞️';
  if (item.mimeType.includes('audio')) return '🎵';
  return '📦';
}

export function DriveExplorer({ carpetaInicial }: { carpetaInicial?: string }) {
  const router = useRouter();
  const [carpetaId, setCarpetaId] = useState<string | undefined>(carpetaInicial);
  const [items, setItems] = useState<ItemDrive[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<Crumb[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seleccionado, setSeleccionado] = useState<ItemDrive | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [creandoCarpeta, setCreandoCarpeta] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async (id?: string) => {
    setCargando(true);
    setError('');
    setSeleccionado(null);
    try {
      const res = await fetch(`/api/drive/browse${id ? `?carpetaId=${id}` : ''}`);
      if (res.status === 409) {
        router.push('/dashboard/conectar-drive');
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items);
      setBreadcrumb(data.breadcrumb);
    } catch {
      setError('No se pudo leer tu Drive. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => { cargar(carpetaId); }, [carpetaId, cargar]);

  function entrarACarpeta(id: string) {
    setCarpetaId(id);
  }

  async function usarParaAsistencia(item: ItemDrive) {
    const res = await fetch('/api/drive/create-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivoId: item.id, nombre: item.nombre, mimeType: item.mimeType })
    });
    if (!res.ok) { setError('No se pudo preparar este archivo para asistencia.'); return; }
    const data = await res.json();
    router.push(`/dashboard/grupo/${data.grupoId}`);
  }

  async function subirArchivos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setSubiendo(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('archivo', file);
      if (carpetaId) form.append('carpetaId', carpetaId);
      await fetch('/api/drive/upload', { method: 'POST', body: form });
    }
    setSubiendo(false);
    cargar(carpetaId);
  }

  async function crearCarpeta() {
    const nombre = prompt('Nombre de la nueva carpeta:');
    if (!nombre) return;
    setCreandoCarpeta(true);
    await fetch('/api/drive/create-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, carpetaId })
    });
    setCreandoCarpeta(false);
    cargar(carpetaId);
  }

  async function renombrar(item: ItemDrive) {
    const nuevoNombre = prompt('Nuevo nombre:', item.nombre);
    if (!nuevoNombre || nuevoNombre === item.nombre) return;
    await fetch('/api/drive/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivoId: item.id, nuevoNombre })
    });
    cargar(carpetaId);
  }

  async function guardarComoCopia(item: ItemDrive) {
    const nuevoNombre = prompt('Nombre de la copia:', `Copia de ${item.nombre}`);
    if (!nuevoNombre) return;
    await fetch('/api/drive/copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivoId: item.id, nuevoNombre, carpetaId })
    });
    cargar(carpetaId);
  }

  async function mover(item: ItemDrive) {
    const destino = prompt('Pega el link o el ID de la carpeta de destino:');
    if (!destino) return;
    const m = destino.match(/folders\/([a-zA-Z0-9_-]+)/);
    const nuevaCarpetaId = m ? m[1] : destino.trim();
    await fetch('/api/drive/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivoId: item.id, nuevaCarpetaId })
    });
    cargar(carpetaId);
  }

  async function eliminar(item: ItemDrive) {
    if (!confirm(`¿Enviar "${item.nombre}" a la papelera de Drive?`)) return;
    await fetch('/api/drive/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivoId: item.id })
    });
    cargar(carpetaId);
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!busqueda.trim()) { cargar(carpetaId); return; }
    setCargando(true);
    const res = await fetch(`/api/drive/search?q=${encodeURIComponent(busqueda)}`);
    const data = await res.json();
    setItems(data.items || []);
    setBreadcrumb([]);
    setCargando(false);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 md:px-8 py-5 md:py-6 pb-14">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <form onSubmit={buscar} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en Drive…"
              className="px-3 py-2 border border-border rounded-md text-sm w-full sm:w-64"
            />
          </form>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={inputArchivoRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => subirArchivos(e.target.files)}
            />
            <button
              onClick={() => inputArchivoRef.current?.click()}
              disabled={subiendo}
              className="px-4 py-2 rounded-md border border-border text-sm font-semibold hover:bg-black/[0.02]"
            >
              {subiendo ? 'Subiendo…' : '⬆ Subir archivo'}
            </button>
            <button
              onClick={crearCarpeta}
              disabled={creandoCarpeta}
              className="px-4 py-2 rounded-md border border-border text-sm font-semibold hover:bg-black/[0.02]"
            >
              📁 Nueva carpeta
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-inkSoft mb-4 flex-wrap">
          <button onClick={() => setCarpetaId(undefined)} className="hover:text-ink hover:underline">
            Mi unidad
          </button>
          {breadcrumb.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5">
              <span>/</span>
              <button onClick={() => setCarpetaId(c.id)} className="hover:text-ink hover:underline">
                {c.nombre}
              </button>
            </span>
          ))}
        </div>

        {error && <p className="text-sm text-red mb-4">{error}</p>}

        {cargando ? (
          <div className="flex items-center gap-2.5 text-sm text-inkSoft py-10 justify-center">
            <span className="w-3.5 h-3.5 border-2 border-border border-t-gold rounded-full animate-spin" />
            Cargando…
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-inkSoft py-10 text-center">Esta carpeta está vacía.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((item) => (
              <button
                key={item.id}
                onDoubleClick={() => item.esCarpeta && entrarACarpeta(item.id)}
                onClick={() => (item.esCarpeta ? entrarACarpeta(item.id) : setSeleccionado(item))}
                className={`text-left bg-white border rounded-lg p-3 hover:shadow-md transition-shadow ${
                  seleccionado?.id === item.id ? 'border-gold ring-1 ring-gold' : 'border-border'
                }`}
              >
                <div className="text-3xl mb-2">{iconoPara(item)}</div>
                <div className="text-sm font-medium truncate" title={item.nombre}>{item.nombre}</div>
                {item.esAsistencia && (
                  <div className="text-[10.5px] text-goldDark font-semibold mt-1">Hoja de asistencia</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {seleccionado && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setSeleccionado(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-[380px] max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-3xl mb-2">{iconoPara(seleccionado)}</div>
            <h3 className="font-bold mb-1 break-words">{seleccionado.nombre}</h3>
            <p className="text-xs text-inkSoft mb-4">{seleccionado.mimeType}</p>

            <div className="flex flex-col gap-2">
              {seleccionado.esAsistencia && (
                <button
                  onClick={() => usarParaAsistencia(seleccionado)}
                  className="w-full py-2.5 rounded-md bg-navy text-white text-sm font-semibold"
                >
                  ✅ Usar para asistencia
                </button>
              )}
              {seleccionado.webViewLink && (
                <a
                  href={seleccionado.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full text-center py-2.5 rounded-md border border-border text-sm font-semibold"
                >
                  ✏️ Abrir y editar en Google Drive
                </a>
              )}
              <a
                href={`/api/drive/download?archivoId=${seleccionado.id}&mimeType=${encodeURIComponent(seleccionado.mimeType)}`}
                className="w-full text-center py-2.5 rounded-md border border-border text-sm font-semibold"
              >
                ⬇ Guardar localmente
              </a>
              <button onClick={() => renombrar(seleccionado)} className="w-full py-2.5 rounded-md border border-border text-sm font-semibold">
                ✎ Renombrar
              </button>
              <button onClick={() => guardarComoCopia(seleccionado)} className="w-full py-2.5 rounded-md border border-border text-sm font-semibold">
                ⧉ Guardar una copia
              </button>
              <button onClick={() => mover(seleccionado)} className="w-full py-2.5 rounded-md border border-border text-sm font-semibold">
                📂 Mover a otra carpeta
              </button>
              <button onClick={() => eliminar(seleccionado)} className="w-full py-2.5 rounded-md border border-border text-sm font-semibold text-red">
                🗑 Eliminar
              </button>
              <button onClick={() => setSeleccionado(null)} className="w-full py-2 text-sm text-inkSoft mt-1">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

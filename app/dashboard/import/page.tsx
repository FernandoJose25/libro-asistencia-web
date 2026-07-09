'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { Topbar } from '@/components/Topbar';

type Estado = 'idle' | 'escaneando' | 'listo' | 'importando';

interface ArchivoEncontrado {
  id: string;
  nombre: string;
  mimeType: string;
}

function extraerCarpetaId(input: string): string {
  const m = input.match(/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : input.trim();
}

export default function ImportPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [link, setLink] = useState('');
  const [estado, setEstado] = useState<Estado>('idle');
  const [archivos, setArchivos] = useState<ArchivoEncontrado[]>([]);
  const [error, setError] = useState('');

  async function escanear() {
    setError('');
    const carpetaId = extraerCarpetaId(link);
    if (!carpetaId) { setError('Pega el link o el ID de la carpeta.'); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.provider_token) {
      setError('Tu sesión de Google expiró. Vuelve a iniciar sesión para renovar el acceso a Drive.');
      return;
    }

    setEstado('escaneando');
    const res = await fetch('/api/drive/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carpetaId, accessToken: session.provider_token })
    });

    if (!res.ok) {
      setError('No se pudo leer la carpeta. Revisa el link/ID y que tu cuenta tenga acceso.');
      setEstado('idle');
      return;
    }
    const data = await res.json();
    setArchivos(data.archivos);
    setEstado('listo');
  }

  async function importarTodo() {
    setEstado('importando');
    const { data: { session } } = await supabase.auth.getSession();
    const carpetaId = extraerCarpetaId(link);

    await fetch('/api/drive/list', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carpetaId,
        carpetaNombre: link,
        accessToken: session?.provider_token,
        archivos
      })
    });

    router.push('/dashboard');
    router.refresh();
  }

  const inicial = 'P';

  return (
    <>
      <Topbar breadcrumb="Archivos / Importar de Drive" inicial={inicial} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] px-10 py-8 pb-14">
          <button onClick={() => router.push('/dashboard')} className="text-sm text-inkSoft hover:text-ink mb-4">
            ← Volver al dashboard
          </button>
          <h2 className="text-2xl font-bold mb-2">Importar carpeta de Google Drive</h2>
          <p className="text-sm text-inkSoft leading-relaxed max-w-[560px] mb-6">
            Pega el link de la carpeta de Drive donde guardas tus archivos de asistencia (uno por grupo). La app lee
            los nombres de archivo y los alumnos de cada uno; tú confirmas antes de traerlos.
          </p>

          <div className="bg-white border border-border rounded-xl p-6">
            {estado === 'idle' && (
              <>
                <label className="block text-xs text-inkSoft mb-1.5">Link o ID de la carpeta</label>
                <input
                  type="text"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full px-3 py-2.5 border border-border rounded-md font-mono text-sm mb-4"
                />
                {error && <p className="text-sm text-red mb-3">{error}</p>}
                <button onClick={escanear} className="px-5 py-2.5 rounded-md bg-navy text-white text-sm font-semibold">
                  Escanear carpeta
                </button>
              </>
            )}

            {estado === 'escaneando' && (
              <div className="flex items-center gap-2.5 text-sm text-inkSoft">
                <span className="w-3.5 h-3.5 border-2 border-border border-t-gold rounded-full animate-spin" />
                Buscando archivos reconocibles en la carpeta…
              </div>
            )}

            {(estado === 'listo' || estado === 'importando') && (
              <>
                <div className="flex items-center gap-2 text-sm text-green mb-4">
                  <span className="w-2 h-2 rounded-full bg-green" />
                  Se encontraron {archivos.length} archivo(s) reconocibles
                </div>
                <div className="border border-border rounded-md p-3 mb-4 max-h-56 overflow-y-auto bg-bg">
                  {archivos.map((a) => (
                    <div key={a.id} className="text-sm py-1 text-inkSoft">📄 {a.nombre}</div>
                  ))}
                  {archivos.length === 0 && (
                    <div className="text-sm text-inkSoft">No se encontraron archivos .xlsx, .csv o Google Sheets en esta carpeta.</div>
                  )}
                </div>
                <div className="flex gap-2.5">
                  <button
                    onClick={() => { setEstado('idle'); setArchivos([]); }}
                    className="px-4 py-2 rounded-md border border-border text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={importarTodo}
                    disabled={archivos.length === 0 || estado === 'importando'}
                    className="px-4 py-2 rounded-md bg-navy text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {estado === 'importando' ? 'Importando…' : 'Importar todo'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

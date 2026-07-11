'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function MigrarAsistenciaButton() {
  const router = useRouter();
  const [migrando, setMigrando] = useState(false);
  const [resultado, setResultado] = useState<{ movidos: number; errores: string[] } | null>(null);
  const [error, setError] = useState('');

  async function migrar() {
    if (
      !confirm(
        '¿Mover todos los archivos de asistencia que tengas en la carpeta "ASISTENCIA" hacia la nueva carpeta "GRUPOS" (organizada por curso)? Esto reorganiza archivos reales de tu Drive.'
      )
    ) {
      return;
    }
    setMigrando(true);
    setError('');
    setResultado(null);
    try {
      const res = await fetch('/api/drive/migrar-asistencia', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo migrar.');
        return;
      }
      setResultado(data);
      router.refresh();
    } finally {
      setMigrando(false);
    }
  }

  return (
    <div className="bg-white border border-border rounded-card px-4 py-3 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold">Migrar mi Drive a la nueva estructura</div>
          <p className="text-xs text-inkSoft mt-0.5">
            Mueve lo que tengas en "ASISTENCIA" (organizado por fecha) hacia "GRUPOS" (organizado por curso). Se puede
            correr varias veces sin duplicar nada.
          </p>
        </div>
        <button
          onClick={migrar}
          disabled={migrando}
          className="px-4 py-2 rounded-md border border-border text-sm font-semibold whitespace-nowrap disabled:opacity-60"
        >
          {migrando ? 'Migrando…' : 'Migrar ahora'}
        </button>
      </div>

      {error && <p className="text-sm text-red mt-2">{error}</p>}

      {resultado && (
        <div className="mt-2 text-xs text-inkSoft">
          {resultado.movidos} archivo(s) movido(s).
          {resultado.errores.length > 0 && (
            <ul className="mt-1 text-red">
              {resultado.errores.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

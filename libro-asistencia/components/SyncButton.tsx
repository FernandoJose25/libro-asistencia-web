'use client';

type Estado = 'sincronizado' | 'pendiente' | 'guardando' | 'sin_conexion';

const ESTILOS: Record<Estado, { texto: string; clase: string }> = {
  sincronizado: { texto: 'Sincronizado', clase: 'text-green border-green' },
  pendiente: { texto: 'Cambios sin guardar', clase: 'text-amber border-amber' },
  guardando: { texto: 'Sincronizando…', clase: 'text-amber border-amber' },
  sin_conexion: { texto: 'Sin conexión — se guardará al reconectar', clase: 'text-inkSoft border-border' }
};

export function SyncButton({
  estado,
  onSync
}: {
  estado: Estado;
  onSync: () => void;
}) {
  const s = ESTILOS[estado];
  return (
    <div className="flex items-center gap-2.5">
      <span className={`text-[11px] font-mono px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${s.clase}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {s.texto}
      </span>
      <button
        onClick={onSync}
        disabled={estado === 'sincronizado' || estado === 'guardando'}
        className="text-sm px-3.5 py-2 rounded-md border border-border disabled:opacity-45 hover:bg-black/[0.03]"
      >
        Sincronizar ahora
      </button>
    </div>
  );
}

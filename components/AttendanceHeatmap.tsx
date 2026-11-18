interface DiaSesion {
    fecha: string; // YYYY-MM-DD
    tasaAsistencia: number; // 0 a 1
}

// Escala de la paleta (de baja a excelente asistencia).
const NIVELES = [
    { desde: 0.9, color: '#1b5e3a', label: 'Excelente' },
    { desde: 0.75, color: '#4f9a6c', label: 'Buena' },
    { desde: 0.5, color: '#d29a3a', label: 'Media' },
    { desde: 0, color: '#b23346', label: 'Baja' }
];

function colorPara(tasa: number) {
    return (NIVELES.find((n) => tasa >= n.desde) || NIVELES[NIVELES.length - 1]).color;
}

function fechaCorta(iso: string) {
    const [anio, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${anio}`;
}

// Puramente de servidor (sin hooks) — se calcula todo en la página que lo
// llama y aquí solo se pinta. El "title" de cada cuadrito hace de tooltip
// nativo del navegador, sin necesitar JavaScript en el cliente.
export function AttendanceHeatmap({ dias }: { dias: DiaSesion[] }) {
    if (dias.length === 0) {
        return (
            <div className="bg-white border border-border rounded-card p-4 text-sm text-inkSoft">
                Todavía no hay suficientes clases registradas para mostrar el calendario de asistencia.
            </div>
        );
    }

    return (
        <div className="bg-white border border-border rounded-card p-4">
            <div className="flex items-baseline justify-between gap-2 mb-3">
                <h3 className="font-display text-lg font-semibold">Historial de asistencia</h3>
                <span className="text-[12px] text-inkSoft">{dias.length} clases</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {/* Una fecha puede tener Hora 1 y Hora 2: el índice evita keys repetidas. */}
                {dias.map((d, i) => (
                    <div
                        key={`${d.fecha}-${i}`}
                        title={`${fechaCorta(d.fecha)}: ${Math.round(d.tasaAsistencia * 100)}% de asistencia`}
                        className="w-5 h-5 rounded-[5px]"
                        style={{ backgroundColor: colorPara(d.tasaAsistencia) }}
                    />
                ))}
            </div>
            <div className="flex items-center gap-3 mt-3 text-[11.5px] text-inkSoft flex-wrap">
                {[...NIVELES].reverse().map((n) => (
                    <span key={n.label} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: n.color }} />
                        {n.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

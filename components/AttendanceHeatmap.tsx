interface DiaSesion {
    fecha: string; // YYYY-MM-DD
    tasaAsistencia: number; // 0 a 1
}

function colorPara(tasa: number) {
    if (tasa >= 0.9) return '#1e7e34';
    if (tasa >= 0.75) return '#5cb85c';
    if (tasa >= 0.5) return '#f0ad4e';
    return '#d9534f';
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
            <div className="text-[11px] uppercase tracking-wide text-inkSoft mb-3">
                Calendario de asistencia (últimas {dias.length} clases)
            </div>
            <div className="flex flex-wrap gap-1.5">
                {dias.map((d) => (
                    <div
                        key={d.fecha}
                        title={`${d.fecha}: ${Math.round(d.tasaAsistencia * 100)}% de asistencia`}
                        className="w-5 h-5 rounded-[4px]"
                        style={{ backgroundColor: colorPara(d.tasaAsistencia) }}
                    />
                ))}
            </div>
            <div className="flex items-center gap-3 mt-3 text-[10.5px] text-inkSoft">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#d9534f' }} />Baja</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#f0ad4e' }} />Media</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#5cb85c' }} />Buena</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#1e7e34' }} />Excelente</span>
            </div>
        </div>
    );
}

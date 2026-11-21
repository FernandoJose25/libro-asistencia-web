'use client';

import * as XLSX from 'xlsx';

export interface FilaExportAsistencia {
  nombre: string;
  estatus: string;
  observacion: string;
  fecha: string; // dd/mm/aaaa
  hora: string; // HH:mm
}

export function exportarAsistenciaExcel(nombreArchivo: string, filas: FilaExportAsistencia[]) {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Nombre', 'Estado', 'Observación', 'Fecha', 'Hora'],
    ...filas.map((f) => [f.nombre, f.estatus, f.observacion, f.fecha, f.hora])
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}

// Lista del "Resumen con IA" (asistencias por periodo para reportar a la escuela).
export interface FilaResumenPeriodo {
  nombre: string;
  asistencias: number; // asistió + retardos + justificadas
  retardos: number;
  justificadas: number;
  faltas: number;
}

export function filasResumenPeriodo(filas: FilaResumenPeriodo[]): (string | number)[][] {
  return [
    ['N°', 'Alumno', 'Asistencias', 'Retardos', 'Justificadas', 'Faltas'],
    ...filas.map((f, i) => [i + 1, f.nombre, f.asistencias, f.retardos, f.justificadas, f.faltas])
  ];
}

export function exportarResumenPeriodoExcel(nombreArchivo: string, titulo: string, filas: FilaResumenPeriodo[]) {
  exportarTablaExcel(
    nombreArchivo,
    'Asistencias',
    [titulo, 'Asistencias = asistió + retardos + faltas justificadas, por hora de clase. Faltas = solo las no justificadas.'],
    filasResumenPeriodo(filas)
  );
}

// Tabla con líneas de encabezado arriba (curso, periodo, notas). La columna
// 2 es el nombre del alumno: más ancha.
export function exportarTablaExcel(nombreArchivo: string, hoja: string, encabezado: string[], tabla: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet([...encabezado.map((linea) => [linea]), [], ...tabla]);
  ws['!cols'] = (tabla[0] || []).map((_, i) => ({ wch: i === 1 ? 40 : i === 0 ? 5 : 12 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja);
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}

// Texto separado por tabuladores: al pegarlo en Excel cada dato cae en su columna.
export async function copiarTablaParaExcel(tabla: (string | number)[][]) {
  await navigator.clipboard.writeText(tabla.map((fila) => fila.join('\t')).join('\n'));
}

export function exportarAsistenciaPDF(titulo: string, filas: FilaExportAsistencia[]) {
  const ventana = window.open('', '_blank');
  if (!ventana) return;
  const filasHtml = filas
    .map(
      (f) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #ddd;">${f.nombre}</td><td style="padding:6px 10px;border-bottom:1px solid #ddd;">${f.estatus}</td><td style="padding:6px 10px;border-bottom:1px solid #ddd;">${f.observacion}</td><td style="padding:6px 10px;border-bottom:1px solid #ddd;">${f.fecha}</td><td style="padding:6px 10px;border-bottom:1px solid #ddd;">${f.hora}</td></tr>`
    )
    .join('');
  ventana.document.write(`
    <html><head><title>${titulo}</title></head>
    <body style="font-family:sans-serif;padding:24px;">
      <h2>${titulo}</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr><th style="text-align:left;padding:6px 10px;">Nombre</th><th style="text-align:left;padding:6px 10px;">Estado</th><th style="text-align:left;padding:6px 10px;">Observación</th><th style="text-align:left;padding:6px 10px;">Fecha</th><th style="text-align:left;padding:6px 10px;">Hora</th></tr></thead>
        <tbody>${filasHtml}</tbody>
      </table>
      <script>window.onload = () => window.print();</script>
    </body></html>
  `);
  ventana.document.close();
}

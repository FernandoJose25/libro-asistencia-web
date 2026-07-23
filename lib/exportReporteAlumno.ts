'use client';

export interface ReporteAlumnoPDF {
  nombre: string;
  grupoNombre: string;
  diasAsistio: number;
  diasTardanza: number;
  diasFalto: number;
  horasFaltaAcumuladas: number;
  horasFaltaRestantes: number;
  faltasPermitidasSemestre: number;
  faltas: string[]; // fechas ya formateadas
  tardanzas: string[];
}

// Reporte individual listo para entregar a un padre/apoderado: mismo patrón
// de impresión que el resto de exportaciones PDF de la app.
export function exportarReporteAlumnoPDF(r: ReporteAlumnoPDF) {
  const ventana = window.open('', '_blank');
  if (!ventana) return;

  const filasFaltas = r.faltas.length
    ? r.faltas.map((f) => `<li>${f}</li>`).join('')
    : '<li style="color:#888;">Sin faltas registradas.</li>';
  const filasTardanzas = r.tardanzas.length
    ? r.tardanzas.map((f) => `<li>${f}</li>`).join('')
    : '<li style="color:#888;">Sin retardos registrados.</li>';

  ventana.document.write(`
    <html><head><title>Reporte de asistencia — ${r.nombre}</title></head>
    <body style="font-family:sans-serif;padding:24px;">
      <h2>Reporte de asistencia</h2>
      <p><b>Alumno:</b> ${r.nombre}<br/><b>Grupo:</b> ${r.grupoNombre}</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tbody>
          <tr><td style="padding:6px 10px;border-bottom:1px solid #ddd;">Días asistidos</td><td style="padding:6px 10px;border-bottom:1px solid #ddd;">${r.diasAsistio}</td></tr>
          <tr><td style="padding:6px 10px;border-bottom:1px solid #ddd;">Retardos</td><td style="padding:6px 10px;border-bottom:1px solid #ddd;">${r.diasTardanza}</td></tr>
          <tr><td style="padding:6px 10px;border-bottom:1px solid #ddd;">Faltas</td><td style="padding:6px 10px;border-bottom:1px solid #ddd;">${r.diasFalto}</td></tr>
          <tr><td style="padding:6px 10px;border-bottom:1px solid #ddd;">Horas de falta acumuladas</td><td style="padding:6px 10px;border-bottom:1px solid #ddd;">${r.horasFaltaAcumuladas}</td></tr>
          <tr><td style="padding:6px 10px;border-bottom:1px solid #ddd;">Faltas restantes permitidas</td><td style="padding:6px 10px;border-bottom:1px solid #ddd;">${r.horasFaltaRestantes} / ${r.faltasPermitidasSemestre}</td></tr>
        </tbody>
      </table>

      <h3 style="color:#b91c1c;">Faltó (${r.faltas.length})</h3>
      <ul>${filasFaltas}</ul>

      <h3 style="color:#b45309;">Retardos (${r.tardanzas.length})</h3>
      <ul>${filasTardanzas}</ul>

      <script>window.onload = () => window.print();</script>
    </body></html>
  `);
  ventana.document.close();
}

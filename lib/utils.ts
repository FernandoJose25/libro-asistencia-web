// Los nombres de grupo vienen del nombre original del archivo en Drive, que
// puede traer caracteres inválidos para un nombre de archivo local (el caso
// más común: fechas con "/", como "ASISTENCIA - 02/06/2021"). Un "/" en el
// nombre de descarga hace que el navegador falle en silencio (lo interpreta
// como separador de carpetas) — por eso "Exportar Excel" no hacía nada.
export function sanitizarNombreArchivo(nombre: string): string {
    return nombre
        .replace(/[/\\?%*:|"<>]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

// Zona de los profesores. El servidor (Vercel) corre en UTC, así que la usa
// como mejor estimación; en el navegador manda la zona del dispositivo.
export const ZONA_HORARIA = 'America/Lima';

// Fecha YYYY-MM-DD del calendario local. No usar toISOString().slice(0, 10):
// devuelve la fecha UTC y en Perú (UTC-5) desde las 19:00 ya marca el día
// siguiente, así que la asistencia tomada de noche se guardaba en otro día.
export function fechaLocalISO(fecha: Date = new Date(), timeZone?: string): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}

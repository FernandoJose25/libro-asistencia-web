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

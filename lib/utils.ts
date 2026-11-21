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

// Supabase devuelve como máximo 1000 filas por consulta: pide páginas hasta
// terminar. La consulta debe tener un orden estable (por ejemplo .order('id')).
export async function leerTodo<T>(
    pedirPagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
    const filas: T[] = [];
    for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await pedirPagina(inicio, inicio + 999);
        if (error) throw new Error(error.message);
        filas.push(...(data || []));
        if (!data || data.length < 1000) return filas;
    }
}

// "Failed to fetch" (Chrome/Brave), "NetworkError…" (Firefox), "Load failed"
// (Safari): la petición no llegó a Supabase o se cortó la respuesta. Pasa con
// señal inestable en el celular, no es un error de los datos.
export function esErrorDeRed(error: { message: string } | null): boolean {
    return !!error && /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(error.message);
}

// Repite una escritura que se puede repetir sin efecto doble (upsert o delete)
// cuando falla por la red.
export async function conReintentos<T extends { error: { message: string } | null }>(
    enviar: () => PromiseLike<T>,
    esperasMs = [800, 2000]
): Promise<T> {
    let resultado = await enviar();
    for (const ms of esperasMs) {
        if (!esErrorDeRed(resultado.error)) break;
        await new Promise((r) => setTimeout(r, ms));
        resultado = await enviar();
    }
    return resultado;
}

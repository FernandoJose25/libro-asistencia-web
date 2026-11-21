// Calificaciones por parcial: trabajos (0-10 o NE) y examen (0-10).
// Calificación del parcial = promedio de trabajos × % trabajos + examen × % restante.

export type Parcial = 1 | 2 | 3;
export const PARCIALES: Parcial[] = [1, 2, 3];

export interface Trabajo {
    id: string;
    nombre: string;
    parcial: Parcial;
}

export interface NotaTrabajo {
    alumno_id: string;
    evaluacion_id: string;
    nota: number;
    no_entrego: boolean;
}

// Opciones del desplegable de cada trabajo. '' = sin calificar y NE = no
// entregó: los dos cuentan como 0 en el promedio.
export const OPCIONES_NOTA_TRABAJO = ['', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'NE'] as const;

export function valorNotaTrabajo(n: NotaTrabajo | undefined): string {
    if (!n) return '';
    return n.no_entrego ? 'NE' : String(Number(n.nota));
}

// Promedio de todos los trabajos del parcial: la escuela promedia cada trabajo,
// entregado o no, así que NE y sin calificar cuentan como 0. null si el
// parcial no tiene trabajos.
export function promedioTrabajos(
    alumnoId: string,
    trabajosDelParcial: Trabajo[],
    notas: Map<string, NotaTrabajo> // clave: `${alumno_id}|${evaluacion_id}`
): number | null {
    if (!trabajosDelParcial.length) return null;
    let suma = 0;
    trabajosDelParcial.forEach((t) => {
        const n = notas.get(claveNota(alumnoId, t.id));
        if (n && !n.no_entrego) suma += Number(n.nota);
    });
    return suma / trabajosDelParcial.length;
}

export function claveNota(alumnoId: string, evaluacionId: string) {
    return `${alumnoId}|${evaluacionId}`;
}

export function calificacionParcial(trabajos: number | null, examen: number | null, porcentajeTrabajos: number): number | null {
    const p = porcentajeTrabajos / 100;
    if (p >= 1) return trabajos;
    if (p <= 0) return examen;
    if (trabajos === null || examen === null) return null;
    return trabajos * p + examen * (1 - p);
}

// Una decimal como máximo: 8, 7.5, 6.3. El épsilon evita que 6.45 quede en
// 6.4 por cómo se guardan los decimales.
export function redondearDecima(n: number): number {
    return Math.round(n * 10 + 1e-9) / 10;
}

export function formatearNota(n: number | null): string {
    if (n === null) return '—';
    return String(redondearDecima(n));
}

// Lo que acepta el sistema de la escuela: entero (desde .5 sube: 5.5 → 6) y
// nunca menor a 5. Se redondea la calificación real ya mostrada con una
// decimal, para que lo que ve la docente y lo que se captura coincidan.
export const CALIFICACION_MINIMA_SISTEMA = 5;

export function calificacionSistema(n: number | null): number | null {
    if (n === null) return null;
    return Math.max(CALIFICACION_MINIMA_SISTEMA, Math.round(redondearDecima(n)));
}

export function nombreAlumno(a: { nombre: string; apellidos: string | null; nombres: string | null }) {
    return a.apellidos && a.nombres ? `${a.apellidos}, ${a.nombres}` : a.nombre;
}

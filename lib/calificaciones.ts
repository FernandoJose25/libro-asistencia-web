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

// Opciones del desplegable de cada trabajo. '' = sin calificar (no cuenta en
// el promedio); NE = no entregó (cuenta como 0).
export const OPCIONES_NOTA_TRABAJO = ['', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'NE'] as const;

export function valorNotaTrabajo(n: NotaTrabajo | undefined): string {
    if (!n) return '';
    return n.no_entrego ? 'NE' : String(Number(n.nota));
}

// Promedio de los trabajos calificados del parcial (NE = 0). null si ninguno
// está calificado todavía.
export function promedioTrabajos(
    alumnoId: string,
    trabajosDelParcial: Trabajo[],
    notas: Map<string, NotaTrabajo> // clave: `${alumno_id}|${evaluacion_id}`
): number | null {
    let suma = 0;
    let cantidad = 0;
    trabajosDelParcial.forEach((t) => {
        const n = notas.get(claveNota(alumnoId, t.id));
        if (!n) return;
        suma += n.no_entrego ? 0 : Number(n.nota);
        cantidad++;
    });
    return cantidad ? suma / cantidad : null;
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

// Una decimal como máximo: 8, 7.5, 6.3.
export function formatearNota(n: number | null): string {
    if (n === null) return '—';
    return String(Math.round(n * 10) / 10);
}

export function nombreAlumno(a: { nombre: string; apellidos: string | null; nombres: string | null }) {
    return a.apellidos && a.nombres ? `${a.apellidos}, ${a.nombres}` : a.nombre;
}

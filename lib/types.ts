export type Estatus = 'asistio' | 'tardanza' | 'falto';

export interface Grupo {
  id: string;
  profesor_id: string;
  archivo_id_nube: string;
  nombre: string;
  activo: boolean;
  ultima_sync: string | null;
}

export interface Alumno {
  id: string;
  grupo_id: string;
  nombre: string;
  apellidos: string | null;
  nombres: string | null;
  orden: number;
}

// Registro de la sección "Asistencia". Permite 2 clases el mismo día.
export interface AsistenciaRegistro {
  id?: string;
  alumno_id: string;
  grupo_id: string;
  fecha: string; // YYYY-MM-DD
  clase: 1 | 2;
  estatus: Estatus;
  marcado_en: string; // ISO timestamp
  justificada: boolean;
}

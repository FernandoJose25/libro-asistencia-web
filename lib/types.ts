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
  orden: number;
}

export interface RegistroAsistencia {
  id?: string;
  alumno_id: string;
  fecha: string; // YYYY-MM-DD
  estatus: Estatus;
  horas_clase_dia: 1 | 2;
}

// Estado en memoria de la vista de un grupo: alumno + su registro de hoy
export interface FilaAsistencia {
  alumno: Alumno;
  estatus: Estatus;
  dirty: boolean;
}

// Registro de la sección "Asistencia" (independiente de RegistroAsistencia,
// que pertenece a la vista clásica de Grupos). Permite 2 clases el mismo día.
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

import type { MotivoJustificacion } from '@/components/JustificarPopover';
import type { Estatus } from '@/lib/types';

export const MOTIVO_LABEL: Record<MotivoJustificacion, string> = {
  salud: 'Salud',
  imprevisto: 'Imprevisto',
  otro: 'Otro',
  sin_clases: 'Sin clases'
};

// Columna "Estado" de Excel/PDF/Drive. La falta justificada no cuenta como
// falta, así que no se escribe "Faltó".
export function formatearEstado(estatus: Estatus, justificada: boolean): string {
  if (estatus === 'asistio') return 'Asistió';
  if (estatus === 'tardanza') return 'Retardo';
  return justificada ? 'Justificada' : 'Faltó';
}

export function formatearObservacion(
  estatus: Estatus,
  justificada: boolean,
  motivo: MotivoJustificacion | null,
  detalle: string | null
): string {
  if (estatus !== 'falto' || !justificada) return '';
  const label = MOTIVO_LABEL[motivo || 'otro'] || 'Otro';
  return detalle ? `${label} — ${detalle}` : label;
}

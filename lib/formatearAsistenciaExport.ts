import type { MotivoJustificacion } from '@/components/JustificarPopover';
import type { Estatus } from '@/lib/types';

export const MOTIVO_LABEL: Record<MotivoJustificacion, string> = {
  salud: 'Salud',
  imprevisto: 'Imprevisto',
  otro: 'Otro'
};

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

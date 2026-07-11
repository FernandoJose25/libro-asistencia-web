import { NextResponse } from 'next/server';
import { contextoDrive } from '@/lib/driveContext';
import { migrarAsistenciaAGrupos } from '@/lib/driveAsistencia';

// Dispara manualmente la reorganización de ASISTENCIA/<fecha>/Clase N/Grupo.xlsx
// hacia GRUPOS/<Grupo>/<fecha>/Clase N.xlsx. Nunca se llama automáticamente.
export async function POST() {
  const ctx = await contextoDrive();
  if (ctx.error) return ctx.error;
  const { accessToken } = ctx;

  try {
    const resultado = await migrarAsistenciaAGrupos(accessToken);
    return NextResponse.json(resultado);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudo migrar' }, { status: 502 });
  }
}

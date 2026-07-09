import { NextResponse } from 'next/server';
import { contextoDrive } from '@/lib/driveContext';
import { eliminarArchivo } from '@/lib/drive';

export async function POST(request: Request) {
  const ctx = await contextoDrive();
  if (ctx.error) return ctx.error;

  const { archivoId } = await request.json();
  if (!archivoId) return NextResponse.json({ error: 'Falta archivoId' }, { status: 400 });

  try {
    await eliminarArchivo(ctx.accessToken, archivoId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudo eliminar' }, { status: 502 });
  }
}
